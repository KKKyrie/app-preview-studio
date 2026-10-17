<script setup lang="ts">
import { computed, ref } from 'vue'

import { useStageViewport } from '@/composables/useStageViewport'
import { useProjectStore } from '@/stores/project'

import ScreenshotCanvas from './ScreenshotCanvas.vue'
import StageZoomBar from './StageZoomBar.vue'

const store = useProjectStore()
const hostEl = ref<HTMLElement | null>(null)

/** 缩放 / 平移：画布尺寸（含横竖屏切换）变化时自动回到「适应窗口」，见 useStageViewport */
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
  onWheel,
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

const sizeLabel = computed(() => {
  const { width, height } = store.canvasSize
  return `${width} × ${height}`
})
</script>

<template>
  <div
    ref="hostEl"
    class="relative h-full w-full touch-none overflow-hidden"
    :class="canPan ? (panning ? 'cursor-grabbing' : 'cursor-grab') : ''"
    style="background-image: radial-gradient(circle, #23252f 1px, transparent 1px); background-size: 24px 24px"
    @wheel="onWheel"
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
          <ScreenshotCanvas
            v-if="store.activeItem"
            :item="store.activeItem"
            :width="store.canvasSize.width"
            :height="store.canvasSize.height"
            :brand="store.brand"
          />
        </div>
      </div>
    </div>

    <!-- 底部信息条 -->
    <div
      class="pointer-events-none absolute bottom-4 left-4 flex items-center gap-2.5 rounded-full border border-line-700 bg-surface-900/90 px-4 py-1.5 text-xs text-ink-300 backdrop-blur"
    >
      <span class="font-medium text-ink-100">{{ sizeLabel }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ store.size.display }} {{ store.size.group === 'iphone' ? 'iPhone' : 'iPad' }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ store.orientation === 'portrait' ? '竖屏' : '横屏' }}</span>
      <span v-if="canPan" class="text-ink-500">·</span>
      <span v-if="canPan" class="text-ink-400">拖拽可平移</span>
    </div>

    <!-- 缩放控件 -->
    <div class="absolute right-4 bottom-4">
      <StageZoomBar
        :scale="scale"
        :is-fit="isFit"
        :at-min-zoom="atMinZoom"
        :at-max-zoom="atMaxZoom"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @fit="zoomFit"
        @actual="zoomActual"
      />
    </div>

    <!-- 未上传图片的提示：仅在「适应」档位显示，放大核对细节时不遮挡画布 -->
    <div
      v-if="isFit && !store.activeItem?.image"
      class="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-dashed border-brand-500/50 bg-surface-900/80 px-4 py-1.5 text-xs text-brand-300 backdrop-blur"
    >
      拖拽或 ⌘V 粘贴你的 App 截图，当前显示的是示例界面
    </div>
  </div>
</template>
