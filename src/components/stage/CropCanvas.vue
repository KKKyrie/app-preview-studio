<script setup lang="ts">
import { computed } from 'vue'

import type { CropItem, Rect, SafeAreaViolation } from '@/types'
import { resolveCropBox } from '@/utils/cropGeometry'

import SafeAreaOverlay from './SafeAreaOverlay.vue'

/** 未提供实测矩形时的占位（避免模板里每次渲染新建 Map） */
const NO_BOXES: Map<string, Rect> = new Map()
const NO_VIOLATIONS: SafeAreaViolation[] = []

/**
 * 裁剪画布：画框锁定官方比例，源图按构图在框内平移 / 缩放。
 *
 * 与另外两个画布的关键差异：
 *  - 没有文案 / 主题 / 品牌，只有一张图片 —— 本工作台只做裁剪，不做设计
 *  - 源图**恒为 cover**：任何构图下图片都铺满画框，绝不露底
 *    （理由见 utils/cropGeometry.ts 文件头）
 *
 * 预览与导出共用本组件，通过 `overlay` 开关区分：
 * - overlay=true 仅预览：叠加安全区可视化（Apple 要求素材不含额外图层）
 * - overlay=false 用于导出容器
 */
const props = defineProps<{
  /** 当前条目；`undefined` = 列表已空（只画空画框，不画图） */
  item?: CropItem
  width: number
  height: number
  /** 安全区（画布坐标系的像素矩形）；仅 overlay 时使用 */
  safe?: Rect
  /** 是否渲染安全区叠加层（导出时必须为 false） */
  overlay?: boolean
}>()

/** 源图在画框坐标系里的绘制矩形；null = 还没导入图片（或列表为空） */
const box = computed(() =>
  props.item
    ? resolveCropBox(props.width, props.height, props.item.width, props.item.height, {
        zoom: props.item.zoom,
        offset: props.item.offset,
      })
    : null,
)

const hasImage = computed(() => {
  const it = props.item
  return !!it?.image && it.width > 0 && it.height > 0
})

const rootStyle = computed(() => ({
  position: 'relative' as const,
  width: `${props.width}px`,
  height: `${props.height}px`,
  overflow: 'hidden' as const,
  // 兜底底色：图片未就绪时画框不应该是透明的
  background: '#0b0c10',
}))

/**
 * 图片按**显式几何**绘制（不用 object-fit，也不用 transform）。
 *
 * 导出走 DOM 序列化后再光栅化，显式宽高 + 绝对定位是这条链路上最不容易
 * 失真的写法；transform 与 object-fit 都要依赖光栅化器对它们的还原程度。
 *
 * ⚠️ `maxWidth / maxHeight: none` 是**必需的**，不是保险：Tailwind preflight 给
 * 所有 `<img>` 设了 `max-width: 100%`，而本工作台的图片按设计**必然超出画框**
 * （铺满之后再放大），于是被裁到「画框宽度」为止 —— 实测放大到 180% 时右侧
 * 31% 变成空白，只有逐像素比对导出成品才能发现。另外两个画布撞不到这条，
 * 因为它们的图片始终在画布范围内。
 *
 * 尺寸向外取整：浮点几何会在边缘留下亚像素缝隙，露出画框底色。
 */
const imageStyle = computed(() => {
  const b = box.value
  if (!hasImage.value || !b) return { display: 'none' as const }
  const x = Math.floor(b.x)
  const y = Math.floor(b.y)
  return {
    position: 'absolute' as const,
    left: `${x}px`,
    top: `${y}px`,
    width: `${Math.ceil(b.x + b.width) - x}px`,
    height: `${Math.ceil(b.y + b.height) - y}px`,
    maxWidth: 'none' as const,
    maxHeight: 'none' as const,
    // 画布组件不许依赖外部 CSS，图片本身也不能被浏览器默认样式影响
    display: 'block' as const,
  }
})

const safeRect = computed<Rect>(
  () => props.safe ?? { x: 0, y: 0, width: props.width, height: props.height },
)
</script>

<template>
  <div :style="rootStyle" data-canvas data-crop-canvas>
    <!--
      draggable="false" 在裁剪工作台是**必需的**，不只是防御：
      在画布上拖图的默认行为会被浏览器当成原生拖拽（dragstart），
      于是拖动构图会变成「拖出一张图再 drop 回来」，凭空多导入一条。
    -->
    <img
      v-if="hasImage"
      data-role="image"
      data-crop-image
      draggable="false"
      :src="item?.image ?? undefined"
      :alt="item?.imageName ?? '待裁剪图片'"
      :style="imageStyle"
    />
    <SafeAreaOverlay
      v-if="overlay"
      :canvas-w="width"
      :canvas-h="height"
      :safe="safeRect"
      :violations="NO_VIOLATIONS"
      :boxes="NO_BOXES"
      :flash-role="null"
    />
  </div>
</template>
