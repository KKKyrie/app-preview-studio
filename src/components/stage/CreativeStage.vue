<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { checkSafeArea, type CheckableRole } from '@/composables/useSafeArea'
import {
  flashRole,
  publishSafeAreaReport,
  safeAreaReport,
} from '@/composables/useCreativeChecks'
import { useCreativeStore } from '@/stores/creative'

import CreativeCanvas from './CreativeCanvas.vue'

const store = useCreativeStore()

const hostEl = ref<HTMLElement | null>(null)
const canvasWrapEl = ref<HTMLElement | null>(null)

const PAD = 56
const scale = ref(0.2)

function fit() {
  const el = hostEl.value
  if (!el) return
  const { width, height } = store.canvasSize
  const availW = el.clientWidth - PAD * 2
  const availH = el.clientHeight - PAD * 2
  if (availW <= 0 || availH <= 0) return
  scale.value = Math.min(availW / width, availH / height, 1)
}

let ro: ResizeObserver | null = null

onMounted(() => {
  fit()
  ro = new ResizeObserver(fit)
  if (hostEl.value) ro.observe(hostEl.value)
  void measure()
})

onBeforeUnmount(() => ro?.disconnect())

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

const sizeLabel = computed(() => {
  const { width, height } = store.canvasSize
  return `${width} × ${height}`
})

const placementLabel = computed(() => `${store.placement.name} · ${store.canvas.aspect}`)

/* ── 安全区测量 ── */

/** 主体图默认不检查：出血是设计意图，用户可主动开启 */
const checkTargets = computed<CheckableRole[]>(() => {
  const list: CheckableRole[] = [
    { role: 'brand', label: '品牌 Logo' },
    { role: 'headline', label: '主标题' },
    { role: 'subtitle', label: '副标题' },
  ]
  if (store.checkImage) list.push({ role: 'image', label: '主体图' })
  return list
})

function measure() {
  const root = canvasWrapEl.value?.querySelector<HTMLElement>('[data-canvas]')
  if (!root) return
  publishSafeAreaReport(
    checkSafeArea({
      rootEl: root,
      canvasW: store.canvasSize.width,
      safe: store.safeArea,
      targets: checkTargets.value,
    }),
  )
}

async function scheduleMeasure() {
  await nextTick()
  // 图片解码完成会改变版式几何，等一拍再测
  await new Promise((r) => setTimeout(r, 0))
  measure()
}

// 文案 / 版式 / 坑位 / 检查开关变化后都需要重新测量
watch(
  () => [
    store.activeItemId,
    store.placementId,
    store.canvasId,
    store.checkImage,
    store.activeItem?.headline.text,
    store.activeItem?.headline.size,
    store.activeItem?.headline.font,
    store.activeItem?.subtitle.text,
    store.activeItem?.subtitle.size,
    store.activeItem?.subtitle.font,
    store.activeItem?.bannerLayoutId,
    store.activeItem?.image,
    store.activeItem?.params,
    store.brand.logo,
    store.brand.name,
    store.brand.logoSize,
    store.brand.nameSize,
  ],
  () => void scheduleMeasure(),
  { deep: true },
)
</script>

<template>
  <div
    ref="hostEl"
    class="relative h-full w-full overflow-hidden"
    style="background-image: radial-gradient(circle, #23252f 1px, transparent 1px); background-size: 24px 24px"
  >
    <div class="flex h-full w-full items-center justify-center">
      <div
        :style="boxStyle"
        class="relative overflow-hidden ring-1 ring-white/10"
        style="box-shadow: 0 24px 80px rgba(0, 0, 0, 0.55)"
      >
        <div ref="canvasWrapEl" :style="canvasStyle">
          <CreativeCanvas
            :item="store.activeItem"
            :width="store.canvasSize.width"
            :height="store.canvasSize.height"
            :safe="store.safeArea"
            :brand="store.brand"
            :overlay="store.showSafeArea"
            :violations="safeAreaReport.violations"
            :boxes="safeAreaReport.boxes"
            :flash-role="flashRole"
          />
        </div>
      </div>
    </div>

    <!-- 底部信息条 -->
    <div
      class="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line-700 bg-surface-900/90 px-4 py-1.5 text-xs text-ink-300 backdrop-blur"
    >
      <span class="font-medium text-ink-100">{{ sizeLabel }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ placementLabel }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ Math.round(scale * 100) }}%</span>
    </div>

    <!-- 空状态引导：明确「这不是截图」 -->
    <div
      class="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-dashed border-brand-500/50 bg-surface-900/80 px-4 py-1.5 text-xs text-brand-300 backdrop-blur"
    >
      {{ store.placement.name }}：表达品牌与季节内容，不是 App 截图
    </div>

    <div
      v-if="!store.activeItem?.image"
      class="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full border border-line-700 bg-surface-900/70 px-3.5 py-1 text-[11px] text-ink-400 backdrop-blur"
    >
      未上传主体图 · 纯品牌排版同样合规
    </div>
  </div>
</template>