<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useProjectStore } from '@/stores/project'

import ScreenshotCanvas from './ScreenshotCanvas.vue'

const store = useProjectStore()
const hostEl = ref<HTMLElement | null>(null)

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

const zoomLabel = computed(() => `${Math.round(scale.value * 100)}%`)

const sizeLabel = computed(() => {
  const { width, height } = store.canvasSize
  return `${width} × ${height}`
})
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
      class="pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line-700 bg-surface-900/90 px-4 py-1.5 text-xs text-ink-300 backdrop-blur"
    >
      <span class="font-medium text-ink-100">{{ sizeLabel }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ store.size.display }} {{ store.size.group === 'iphone' ? 'iPhone' : 'iPad' }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ store.orientation === 'portrait' ? '竖屏' : '横屏' }}</span>
      <span class="text-ink-500">·</span>
      <span>{{ zoomLabel }}</span>
    </div>

    <!-- 未上传图片的提示 -->
    <div
      v-if="!store.activeItem?.image"
      class="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-full border border-dashed border-brand-500/50 bg-surface-900/80 px-4 py-1.5 text-xs text-brand-300 backdrop-blur"
    >
      拖拽或 ⌘V 粘贴你的 App 截图，当前显示的是示例界面
    </div>
  </div>
</template>
