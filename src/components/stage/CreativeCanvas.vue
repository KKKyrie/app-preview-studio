<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { getBannerLayout, type BannerCtx } from '@/data/bannerLayouts'
import { resolveTokens } from '@/data/themes'
import { useAspectRatio } from '@/composables/useAspectRatio'
import type { BrandSpec, CreativeItem, Rect, SafeAreaViolation, ThemeTokens } from '@/types'

import SafeAreaOverlay from './SafeAreaOverlay.vue'
import TextLayer from './TextLayer.vue'

/** 未提供实测矩形时的占位（避免模板里每次渲染新建 Map） */
const NO_BOXES: Map<string, Rect> = new Map()
const NO_VIOLATIONS: SafeAreaViolation[] = []

/**
 * 文字行间距（**占安全区宽度**的比例）。
 *
 * TextLayer 收到的 canvasW 是安全区宽度，所以这里的比例也跟着安全区走，
 * 五个尺寸的疏朗程度一致。若沿用截图模式的 0.032，在 5244×2950 上会是
 * 0.032 × 1402 = 45px，相对 112px 的标题字号过宽，视觉松散。
 */
const GAP_RATIO = 0.02
const LOGO_GAP_RATIO = 0.014

/**
 * 创意素材画布（产品页头 / 搜索结果 / 通用素材）。
 *
 * 与 ScreenshotCanvas 的关键差异：**版式几何以安全区为基准**，背景与主体图
 * 相对画布，因此版式本身不会越界，越界只可能来自文案过长或字号过大。
 *
 * 预览与导出共用本组件，通过 `overlay` 开关区分：
 * - overlay=true 仅预览：叠加安全区可视化（Apple 要求素材不含额外图层）
 * - overlay=false 用于导出容器
 */
const props = defineProps<{
  item: CreativeItem
  width: number
  height: number
  /** 安全区（画布坐标系的像素矩形） */
  safe: Rect
  /** 项目级品牌（logo + 名字） */
  brand?: BrandSpec | null
  /** 是否渲染安全区叠加层（导出时必须为 false） */
  overlay?: boolean
  /** 越界元素（仅 overlay 时使用） */
  violations?: SafeAreaViolation[]
  /** 元素实测矩形（仅 overlay 时使用） */
  boxes?: Map<string, Rect>
  flashRole?: string | null
}>()

const layout = computed(() => getBannerLayout(props.item.bannerLayoutId))

/** 主体图原始宽高比；加载完成前为 0，版式据此先不绘制图片 */
const imageSrc = computed(() => props.item.image)
const imageAspect = useAspectRatio(imageSrc)

const rawTokens = computed(() => resolveTokens(props.item.themeId, props.item.themeOverrides))

/**
 * 满幅图底版式下必须反色文字。
 *
 * 主题 token 假定背景是自己的浅色/深色渐变，而满幅版式的背景是用户上传的图片
 * + 一层深色遮罩。沿用浅色主题的深色文字会直接糊在深色遮罩上（实测副标题几乎
 * 不可读）。因此满幅时把默认文字色换成浅色；用户仍可用颜色控件逐段覆盖。
 */
const tokens = computed<ThemeTokens>(() => {
  const t = rawTokens.value
  if (!result.value.image?.fullBleed) return t
  return {
    ...t,
    headline: '#ffffff',
    subtitle: 'rgba(255,255,255,0.82)',
  }
})

/**
 * 文案块实测底边（画布坐标系）。
 *
 * 文本块高度随字体 / 字号 / 换行而变，只能测量得知。「上文下图」版式据此
 * 把主体图压到文案下方，避免图文重叠。
 *
 * 测量 → 回填 → 重排 → 再测量 会形成反馈环，但因为文本框**宽度固定**，
 * 高度与图片位置无关，所以一轮即收敛：用 0.5px 阈值抑制抖动，避免无限重排。
 */
const textBottom = ref(0)

const rootEl = ref<HTMLElement | null>(null)

async function measureTextBottom() {
  await nextTick()
  const el = rootEl.value
  if (!el) {
    textBottom.value = 0
    return
  }
  // 预览区对画布做了 transform: scale()，getBoundingClientRect 返回缩放后的值。
  // 必须用**同一个**视觉尺度去除：rootRect.height 同样是缩放后的，
  // 因此 rootRect.height / props.height 才是真实缩放比。
  // （不能用 offsetHeight——它返回未缩放的布局值，会让比例恒为 1。）
  const rootRect = el.getBoundingClientRect()
  const scale = rootRect.height > 0 ? rootRect.height / props.height : 0
  if (!Number.isFinite(scale) || scale <= 0) return

  // 用块内元素的最大底边作为文案块底部（品牌行 / 主标题 / 副标题）
  let bottom = -Infinity
  for (const role of ['brand', 'headline', 'subtitle']) {
    const child = el.querySelector<HTMLElement>(`[data-role="${role}"]`)
    if (!child || !child.textContent?.trim()) continue
    const r = child.getBoundingClientRect()
    if (r.height === 0) continue
    bottom = Math.max(bottom, (r.bottom - rootRect.top) / scale)
  }
  const next = Number.isFinite(bottom) ? bottom : 0
  if (Math.abs(next - textBottom.value) > 0.5) textBottom.value = next
}

onMounted(() => void measureTextBottom())

watch(
  () => [
    props.item.headline.text,
    props.item.headline.size,
    props.item.headline.font,
    props.item.subtitle.text,
    props.item.subtitle.size,
    props.item.bannerLayoutId,
    props.width,
    props.height,
    props.brand?.name,
    props.brand?.logoSize,
  ],
  () => void measureTextBottom(),
)

const ctx = computed<BannerCtx>(() => ({
  w: props.width,
  h: props.height,
  safeX: props.safe.x,
  safeY: props.safe.y,
  safeW: props.safe.width,
  safeH: props.safe.height,
  imageAspect: imageAspect.value,
  textBottom: textBottom.value,
}))

const result = computed(() =>
  layout.value.resolve(ctx.value, { ...layout.value.defaults, ...props.item.params }, radiusPx.value),
)

/** 圆角以画布宽度比例存储，切换坑位时等比缩放 */
const radiusPx = computed(() => props.item.imageRadius * props.width)

const rootStyle = computed(() => ({
  position: 'relative' as const,
  boxSizing: 'border-box' as const,
  width: `${props.width}px`,
  height: `${props.height}px`,
  overflow: 'hidden',
  background: tokens.value.background,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', Arial, sans-serif",
}))

const imageStyle = computed(() => {
  const img = result.value.image
  if (!img) return null
  return {
    position: 'absolute' as const,
    left: `${img.x}px`,
    top: `${img.y}px`,
    width: `${img.width}px`,
    height: `${img.height}px`,
    objectFit: 'cover' as const,
    borderRadius: img.fullBleed ? '0' : `${img.radius}px`,
    display: 'block',
  }
})

/** 满幅图底版式需要在图上压一层渐变遮罩，保证文字可读 */
const scrimStyle = computed(() => {
  const img = result.value.image
  if (!img?.fullBleed) return null
  const scrim = Number(props.item.params.scrim ?? 0.55)
  if (scrim <= 0) return null
  return {
    position: 'absolute' as const,
    left: '0',
    top: '0',
    right: '0',
    bottom: '0',
    background: `linear-gradient(180deg, rgba(8,10,16,${scrim * 0.55}) 0%, rgba(8,10,16,${scrim}) 62%, rgba(8,10,16,${scrim * 0.8}) 100%)`,
  }
})

/** 复用 TextLayer：把安全区基准的绝对定位转成 TextPlacement */
const textPlacement = computed(() => ({
  anchor: 'top' as const,
  y: result.value.text.y,
  w: result.value.text.width,
  x: result.value.text.x,
  align: result.value.text.align,
  absolute: true,
}))
</script>

<template>
  <div ref="rootEl" :style="rootStyle" data-canvas data-role-canvas>
    <img
      v-if="imageStyle"
      :src="item.image ?? undefined"
      alt=""
      data-role="image"
      :style="imageStyle"
    />
    <div v-if="scrimStyle" :style="scrimStyle" />

    <TextLayer
      :headline="item.headline"
      :subtitle="item.subtitle"
      :placement="textPlacement"
      :tokens="tokens"
      :canvas-w="safe.width"
      :brand="brand"
      :gap-ratio="GAP_RATIO"
      :logo-gap-ratio="LOGO_GAP_RATIO"
    />

    <SafeAreaOverlay
      v-if="overlay"
      :canvas-w="width"
      :canvas-h="height"
      :safe="safe"
      :violations="violations ?? NO_VIOLATIONS"
      :boxes="boxes ?? NO_BOXES"
      :flash-role="flashRole ?? null"
    />
  </div>
</template>