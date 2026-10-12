<script setup lang="ts">
import { computed } from 'vue'

import type { Rect, SafeAreaViolation } from '@/types'

/**
 * 安全区可视化叠加层。
 *
 * 只在预览区渲染，**绝不进入导出画布** —— Apple 要求素材只含设计本身，
 * 叠加层属于工具的辅助信息。
 *
 * 结构：安全区外的四块区域各铺一层淡黑（降低对比而非遮挡），安全区边界画虚线，
 * 越界元素描红并高亮。
 */
const props = defineProps<{
  canvasW: number
  canvasH: number
  safe: Rect
  /** 越界元素，用于高亮 */
  violations: SafeAreaViolation[]
  /** 各元素的实测矩形（画布坐标系） */
  boxes: Map<string, Rect>
  /** 需要闪烁定位的元素 role */
  flashRole: string | null
}>()

/** 线宽按画布尺寸等比，任何导出尺寸下视觉粗细一致 */
const u = computed(() => props.canvasW / 3840)
const lw = computed(() => Math.max(1, 2 * u.value))

/**
 * 安全区外压暗。
 *
 * 强度要克制：极简白等浅色主题下，0.36 的黑会把整块画布压成中灰，
 * 用户会误以为主题坏了。这里用 0.18——足以读出「这里是画布之外」，
 * 又不会盖过画面本身。边界则用品牌蓝 + 白色描边，保证在深浅两种主题上都可见。
 */
const DIM_BG = 'rgba(8, 10, 16, 0.18)'

/** 安全区外的四块遮罩（上下左右） */
const dimPanes = computed(() => {
  const s = props.safe
  const W = props.canvasW
  const H = props.canvasH
  return [
    { key: 'top', x: 0, y: 0, w: W, h: s.y },
    { key: 'bottom', x: 0, y: s.y + s.height, w: W, h: Math.max(0, H - s.y - s.height) },
    { key: 'left', x: 0, y: s.y, w: s.x, h: s.height },
    { key: 'right', x: s.x + s.width, y: s.y, w: Math.max(0, W - s.x - s.width), h: s.height },
  ].filter((p) => p.w > 0 && p.h > 0)
})

const borderStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${props.safe.x}px`,
  top: `${props.safe.y}px`,
  width: `${props.safe.width}px`,
  height: `${props.safe.height}px`,
  border: `${lw.value}px dashed #7aa2ff`,
  // 白色内发光：浅色主题上也能看清这条边界
  boxShadow: `0 0 0 ${lw.value * 0.6}px rgba(255, 255, 255, 0.55)`,
  boxSizing: 'border-box' as const,
}))

/** 越界元素的高亮框 */
const highlights = computed(() =>
  props.violations
    .map((v) => ({ role: v.role as string, box: props.boxes.get(v.role) }))
    .filter((h) => !!h.box)
    .map((h) => ({ role: h.role, box: h.box as Rect })),
)

function boxStyle(box: Rect, flashing: boolean) {
  return {
    position: 'absolute' as const,
    left: `${box.x}px`,
    top: `${box.y}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
    boxSizing: 'border-box' as const,
    border: `${lw.value}px solid ${flashing ? '#fca5a5' : 'rgba(248,113,113,0.85)'}`,
    background: flashing ? 'rgba(248,113,113,0.28)' : 'rgba(248,113,113,0.16)',
    transition: 'background 120ms linear',
  }
}
</script>

<template>
  <div aria-hidden="true" style="position: absolute; inset: 0; pointer-events: none">
    <!-- 安全区外压暗（留出安全区本身） -->
    <div
      v-for="p in dimPanes"
      :key="p.key"
      :style="{
        position: 'absolute',
        left: `${p.x}px`,
        top: `${p.y}px`,
        width: `${p.w}px`,
        height: `${p.h}px`,
        background: DIM_BG,
      }"
    />

    <!-- 安全区边界 -->
    <div :style="borderStyle" />

    <!-- 越界元素高亮 -->
    <div
      v-for="h in highlights"
      :key="h.role"
      :style="boxStyle(h.box, flashRole === h.role)"
    />
  </div>
</template>