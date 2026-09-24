<script setup lang="ts">
import { computed } from 'vue'

import { getFrame } from '@/data/frames'
import { LAYOUTS, phoneLeft, type PhonePlacement } from '@/data/layouts'
import { resolveTokens } from '@/data/themes'
import type { BrandSpec, CanvasItem } from '@/types'

import PhoneFrame from './PhoneFrame.vue'
import TextLayer from './TextLayer.vue'

const props = defineProps<{
  item: CanvasItem
  width: number
  height: number
  /** 项目级品牌（logo + 名字），由调用方从 store 传入 */
  brand?: BrandSpec | null
}>()

const layout = computed(() => LAYOUTS.find((l) => l.id === props.item.layoutId) ?? LAYOUTS[0])

const frame = computed(() => getFrame(props.item.frameId))

const tokens = computed(() => resolveTokens(props.item.themeId, props.item.themeOverrides))

const placement = computed(() =>
  layout.value.resolve(
    { w: props.width, h: props.height, aspect: frame.value.aspect },
    { ...layout.value.defaults, ...props.item.params },
  ),
)

interface PhoneBox {
  left: number
  top: number
  width: number
  height: number
  rotate: number
}

function phoneBox(p: PhonePlacement): PhoneBox {
  const h = p.scale * props.height
  const w = h * frame.value.aspect
  const top = p.anchor === 'bottom' ? props.height - p.y - h : p.y
  return {
    left: phoneLeft(p, props.width, w),
    top,
    width: w,
    height: h,
    rotate: p.rotate ?? props.item.frame.tilt,
  }
}

const phoneBoxes = computed(() => placement.value.phones.map(phoneBox))

function phoneStyle(b: PhoneBox) {
  return {
    position: 'absolute' as const,
    left: `${b.left}px`,
    top: `${b.top}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
    transform: `rotate(${b.rotate}deg)`,
    transformOrigin: 'center',
  }
}

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
</script>

<template>
  <div :style="rootStyle" data-canvas>
    <div v-for="(b, i) in phoneBoxes" :key="i" :style="phoneStyle(b)">
      <PhoneFrame
        :frame="frame"
        :options="item.frame"
        :image="item.image"
        :width="b.width"
        :height="b.height"
        :shadow="tokens.phoneShadow"
      />
    </div>

    <TextLayer
      :headline="item.headline"
      :subtitle="item.subtitle"
      :placement="placement.text"
      :subtitle-placement="placement.subtitlePlacement ?? null"
      :tokens="tokens"
      :canvas-w="width"
      :brand="brand"
    />
  </div>
</template>
