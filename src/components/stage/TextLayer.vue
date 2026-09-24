<script setup lang="ts">
import { computed } from 'vue'

import { textLeft, type TextPlacement } from '@/data/layouts'
import { getFont } from '@/data/fonts'
import type { BrandSpec, TextSpec, ThemeTokens } from '@/types'

const props = defineProps<{
  headline: TextSpec
  subtitle: TextSpec
  placement: TextPlacement
  /** 「夹持式」布局给副标题单独定位；缺省时副标题紧随主标题 */
  subtitlePlacement?: TextPlacement | null
  tokens: ThemeTokens
  canvasW: number
  /** 项目级品牌（logo + 名字），展示在主标题上方 */
  brand?: BrandSpec | null
}>()

function boxStyle(p: TextPlacement) {
  const anchorTop = p.anchor === 'top'
  return {
    position: 'absolute' as const,
    ...(anchorTop ? { top: `${p.y}px` } : { bottom: `${p.y}px` }),
    left: `${textLeft(p, props.canvasW)}px`,
    width: `${p.w}px`,
    textAlign: p.align,
  }
}

const boxStyleMain = computed(() => boxStyle(props.placement))
const subtitleBoxStyle = computed(() =>
  props.subtitlePlacement ? boxStyle(props.subtitlePlacement) : null,
)

const headlineStyle = computed(() => ({
  margin: '0',
  fontFamily: getFont(props.headline.font).stack,
  fontSize: `${props.headline.size * props.canvasW}px`,
  lineHeight: '1.18',
  fontWeight: String(props.headline.weight),
  letterSpacing: '-0.015em',
  whiteSpace: 'pre-line' as const,
  color: props.headline.color || props.tokens.headline,
}))

const subtitleFontStyle = computed(() => ({
  fontFamily: getFont(props.subtitle.font).stack,
  fontSize: `${props.subtitle.size * props.canvasW}px`,
  lineHeight: '1.5',
  fontWeight: String(props.subtitle.weight),
  whiteSpace: 'pre-line' as const,
  color: props.subtitle.color || props.tokens.subtitle,
}))

const subtitleFollowStyle = computed(() => ({
  ...subtitleFontStyle.value,
  margin: `${props.canvasW * 0.032}px 0 0`,
}))

/* ── 品牌行（logo + 名字，主标题上方） ── */

const hasBrand = computed(() => {
  const b = props.brand
  return !!b && (!!b.logo || !!b.name.trim())
})

const brandRowStyle = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent:
    props.placement.align === 'center'
      ? 'center'
      : props.placement.align === 'right'
        ? 'flex-end'
        : 'flex-start',
  gap: `${props.canvasW * 0.022}px`,
  marginBottom: `${props.canvasW * 0.032}px`,
}))

const brandLogoStyle = computed(() => ({
  height: `${props.brand!.logoSize * props.canvasW}px`,
  width: 'auto',
  maxWidth: `${props.canvasW * 0.35}px`,
  objectFit: 'contain' as const,
  display: 'block',
  // 百分比圆角：随 logo 盒子等比，面板预览与画布导出表现一致
  borderRadius: `${props.brand!.logoRadius * 100}%`,
}))

const brandNameStyle = computed(() => ({
  fontFamily: getFont(props.headline.font).stack,
  fontSize: `${props.brand!.nameSize * props.canvasW}px`,
  fontWeight: '700',
  letterSpacing: '-0.01em',
  whiteSpace: 'nowrap' as const,
  color: props.headline.color || props.tokens.headline,
}))
</script>

<template>
  <div :style="boxStyleMain">
    <!-- 品牌行：logo + 名字，展示在主标题正上方 -->
    <div v-if="hasBrand" :style="brandRowStyle">
      <img v-if="brand!.logo" :src="brand!.logo" alt="" :style="brandLogoStyle" />
      <span v-if="brand!.name.trim()" :style="brandNameStyle">{{ brand!.name }}</span>
    </div>

    <div :style="headlineStyle">{{ headline.text }}</div>
    <div v-if="!subtitlePlacement && subtitle.text" :style="subtitleFollowStyle">
      {{ subtitle.text }}
    </div>
  </div>

  <div v-if="subtitlePlacement && subtitle.text" :style="subtitleBoxStyle">
    <div :style="subtitleFontStyle">{{ subtitle.text }}</div>
  </div>
</template>
