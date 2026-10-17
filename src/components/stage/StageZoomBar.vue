<script setup lang="ts">
import { computed } from 'vue'

/**
 * 画布缩放控件（右下角浮层）。
 *
 * 只影响预览，不参与导出 —— 导出走 App.vue 里 1:1 的隐藏容器。
 */
const props = defineProps<{
  /** 最终渲染缩放（0.24 = 24%） */
  scale: number
  /** 已在「适应窗口」档位 */
  isFit: boolean
  atMinZoom: boolean
  atMaxZoom: boolean
}>()

const emit = defineEmits<{
  zoomIn: []
  zoomOut: []
  fit: []
  actual: []
}>()

const percent = computed(() => `${Math.round(props.scale * 100)}%`)

const BUTTON =
  'flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs text-ink-300 transition hover:bg-surface-700 hover:text-ink-100 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-300'
</script>

<template>
  <div
    data-zoom-ui
    class="flex items-center gap-0.5 rounded-full border border-line-700 bg-surface-900/90 px-1 py-1 backdrop-blur"
  >
    <button
      type="button"
      data-zoom-out
      :class="BUTTON"
      :disabled="atMinZoom"
      title="缩小（⌘/Ctrl + 滚轮）"
      @click="emit('zoomOut')"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 6h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>

    <span data-zoom-label class="w-11 text-center text-xs tabular-nums text-ink-200">
      {{ percent }}
    </span>

    <button
      type="button"
      data-zoom-in
      :class="BUTTON"
      :disabled="atMaxZoom"
      title="放大（⌘/Ctrl + 滚轮）"
      @click="emit('zoomIn')"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
    </button>

    <span class="mx-0.5 h-4 w-px bg-line-700" />

    <button
      type="button"
      data-zoom-fit
      :class="BUTTON"
      :disabled="isFit"
      title="适应窗口（切尺寸时自动回到此档位）"
      @click="emit('fit')"
    >
      适应
    </button>
    <button
      type="button"
      data-zoom-actual
      :class="BUTTON"
      title="100%：画布像素与屏幕像素 1:1"
      @click="emit('actual')"
    >
      1:1
    </button>
  </div>
</template>
