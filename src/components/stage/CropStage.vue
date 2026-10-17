<script setup lang="ts">
import { computed, ref } from 'vue'

import { useCropQuality } from '@/composables/useCropQuality'
import { useStageViewport } from '@/composables/useStageViewport'
import { useCropStore } from '@/stores/crop'
import { CROP_ZOOM_STEP, MAX_CROP_ZOOM } from '@/utils/cropGeometry'

import CropCanvas from './CropCanvas.vue'
import StageZoomBar from './StageZoomBar.vue'

/**
 * 图片裁剪预览区。
 *
 * 这里有**两层缩放**，必须分清（否则用户会以为工具坏了）：
 *   预览缩放 —— 画布在屏幕上多大，走 useStageViewport，与其他工作台一致
 *   裁剪缩放 —— 源图在画框内多大，走 cropGeometry
 * 分工：
 *   拖拽画布上的图  → 调整构图（裁剪平移）
 *   画布上的滚轮    → 调整构图（裁剪缩放）
 *   ⌘/Ctrl + 滚轮   → 预览缩放
 *   画布外的滚轮/拖拽 → 预览平移（仅预览被放大到超出窗口时有效）
 */
const store = useCropStore()

const hostEl = ref<HTMLElement | null>(null)

const {
  scale,
  offset,
  canPan,
  panning,
  isFit,
  atMinZoom,
  atMaxZoom,
  zoomIn,
  zoomOut,
  zoomFit,
  zoomActual,
  onWheel: onViewportWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
} = useStageViewport(hostEl, () => store.canvasSize)

const boxStyle = computed(() => {
  const { width, height } = store.canvasSize
  return {
    width: `${Math.round(width * scale.value)}px`,
    height: `${Math.round(height * scale.value)}px`,
  }
})

const canvasStyle = computed(() => ({
  transform: `scale(${scale.value})`,
  transformOrigin: 'top left',
}))

/** 居中 + 平移：用 translate(-50%,-50%) 而不是 flex 居中，避免内容超出时首尾被裁掉 */
const panStyle = computed(() => ({
  transform: `translate(-50%, -50%) translate(${offset.value.x}px, ${offset.value.y}px)`,
}))

/* ── 裁剪：拖拽构图 ── */

const hasImage = computed(() => !!store.activeItem?.image)

const dragState = ref(false)
let drag: { id: number; x: number; y: number } | null = null

function onCanvasPointerDown(e: PointerEvent) {
  if (e.button !== 0 || !hasImage.value) return
  // preventDefault 顺手挡掉「拖拽选择文本 / 启动原生图片拖拽」这两件事，
  // 否则一次构图拖拽会顺带选中界面上的文字
  e.preventDefault()
  // 按在图上 = 调整构图，因此不把这次按下交给预览平移（stopPropagation 后
  // 宿主上的 useStageViewport.onPointerDown 收不到）
  e.stopPropagation()
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY }
  dragState.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onCanvasPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  // 屏幕位移 ÷ 预览缩放 = 画框坐标系位移
  const dx = (e.clientX - drag.x) / scale.value
  const dy = (e.clientY - drag.y) / scale.value
  drag.x = e.clientX
  drag.y = e.clientY
  store.nudge(dx, dy)
}

function onCanvasPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  drag = null
  dragState.value = false
}

/** 画布上的普通滚轮 = 缩放源图；带 ⌘/Ctrl 才是缩放预览 */
function onStageWheel(e: WheelEvent) {
  const overCanvas = !!(e.target as HTMLElement | null)?.closest('[data-canvas]')
  if (overCanvas && hasImage.value && !e.ctrlKey && !e.metaKey) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? CROP_ZOOM_STEP : 1 / CROP_ZOOM_STEP
    store.setZoom((store.activeItem?.zoom ?? 1) * factor)
    return
  }
  onViewportWheel(e)
}

const zoomPercent = computed(() => Math.round((store.activeItem?.zoom ?? 1) * 100))

const sizeLabel = computed(() => {
  const { width, height } = store.canvasSize
  return `${width} × ${height}`
})

const placementLabel = computed(() => `${store.placement.name} · ${store.canvas.aspect}`)

/**
 * 画质提示：该构图实际用到的源图像素够不够画框用。
 *
 * 裁剪工具最隐蔽的失败模式就是「构图对了但分辨率不够」，而它在上传到
 * App Store Connect 之前完全看不出来。这里量化到顶栏，不必等被驳回。
 */
const quality = useCropQuality()

function canvasCursor() {
  if (!hasImage.value) return ''
  if (dragState.value) return 'cursor-grabbing'
  return store.cropLocked ? '' : 'cursor-grab'
}
</script>

<template>
  <div
    ref="hostEl"
    class="relative h-full w-full touch-none overflow-hidden"
    :class="canPan ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''"
    style="background-image: radial-gradient(circle, #23252f 1px, transparent 1px); background-size: 24px 24px"
    @wheel="onStageWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
    <div class="absolute top-1/2 left-1/2" :style="panStyle">
      <div
        :style="boxStyle"
        class="relative overflow-hidden ring-1 ring-white/10"
        style="box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55)"
      >
        <div :style="canvasStyle">
          <!-- 拖拽 / 滚轮都在这一层：它是用户的「画框」 -->
          <div
            :class="canvasCursor()"
            @pointerdown="onCanvasPointerDown"
            @pointermove="onCanvasPointerMove"
            @pointerup="onCanvasPointerUp"
            @pointercancel="onCanvasPointerUp"
          >
            <CropCanvas
              :item="store.activeItem"
              :width="store.canvasSize.width"
              :height="store.canvasSize.height"
              :safe="store.safeArea"
              :overlay="store.showSafeArea"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 空状态：列表里全部是空位时给出下一步 -->
    <div v-if="!hasImage" class="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p
        class="rounded-xl border border-dashed border-line-700 bg-surface-900/85 px-5 py-3.5 text-center text-xs leading-relaxed text-ink-400 backdrop-blur"
      >
        把成品图拖进来 · 或 ⌘V 粘贴 · 或在左侧导入<br />
        <span class="text-ink-500">
          画框已锁定 {{ store.canvas.aspect }}（{{ sizeLabel }}），导入后拖动调整构图
        </span>
      </p>
    </div>

    <!-- 画质：裁剪最隐蔽的失败模式，必须贴在画布边上 -->
    <div
      v-if="hasImage"
      data-crop-quality
      class="pointer-events-none absolute top-4 left-4 rounded-full border px-3 py-1.5 text-[11px] backdrop-blur"
      :class="quality.cls"
    >
      {{ quality.text }}
    </div>

    <!-- 底部信息条 -->
    <div
      class="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2.5 rounded-full border border-line-700 bg-surface-900/90 px-4 py-1.5 text-xs text-ink-300 backdrop-blur"
    >
      <span class="font-medium text-ink-100">{{ sizeLabel }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ placementLabel }}</span>
      <template v-if="hasImage && !store.cropLocked">
        <span class="text-ink-500">·</span>
        <span class="text-ink-400">拖动图片或滚轮缩放</span>
      </template>
    </div>

    <!-- 预览缩放控件 -->
    <div class="absolute right-4 bottom-4">
      <StageZoomBar
        :scale="scale"
        :is-fit="isFit"
        :at-min-zoom="atMinZoom"
        :at-max-zoom="atMaxZoom"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @fit="zoomFit"
        @actual="zoomActual(store.safeArea)"
      />
    </div>

    <!-- 裁剪控件：调的是**源图**在画框内的缩放，与上面的预览缩放是两回事 -->
    <div
      v-if="hasImage"
      data-crop-bar
      class="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-line-700 bg-surface-900/90 py-1 pr-1.5 pl-3 text-xs text-ink-300 backdrop-blur"
      @pointerdown.stop
    >
      <span class="mr-1 text-[11px] text-ink-500">源图</span>
      <button
        type="button"
        data-crop-out
        class="h-6 w-6 rounded-full text-ink-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="(store.activeItem?.zoom ?? 1) <= 1.0001"
        title="缩小源图（下限 = 刚好铺满画框）"
        @click="store.zoomCropOut()"
      >
        −
      </button>
      <span data-crop-zoom class="w-12 text-center tabular-nums text-ink-100">{{ zoomPercent }}%</span>
      <button
        type="button"
        data-crop-in
        class="h-6 w-6 rounded-full text-ink-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="store.atMaxZoom"
        :title="`放大源图（上限 ${MAX_CROP_ZOOM * 100}% = ${MAX_CROP_ZOOM} 倍铺满）`"
        @click="store.zoomCropIn()"
      >
        ＋
      </button>
      <span class="mx-1 h-4 w-px bg-line-700" />
      <button
        type="button"
        data-crop-center
        class="rounded-full px-2 py-1 text-[11px] text-ink-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="Math.abs(store.activeItem?.offset.x ?? 0) < 1e-6 && Math.abs(store.activeItem?.offset.y ?? 0) < 1e-6"
        @click="store.centerCrop()"
      >
        居中
      </button>
      <button
        type="button"
        data-crop-reset
        class="rounded-full px-2 py-1 text-[11px] text-ink-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="store.isDefaultCrop"
        @click="store.resetCrop()"
      >
        重置
      </button>
    </div>

    <!-- 空状态引导：仅在「适应」档位显示，放大核对细节时不遮挡画布 -->
    <div
      v-if="isFit && !hasImage"
      class="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-dashed border-brand-500/50 bg-surface-900/80 px-4 py-1.5 text-xs text-brand-300 backdrop-blur"
    >
      导入成品图 → 按官方比例裁开，不做设计
    </div>
  </div>
</template>
