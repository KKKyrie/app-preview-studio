<script setup lang="ts">
import { computed } from 'vue'

import type { FrameStyle } from '@/data/frames'
import type { FrameOptions } from '@/types'

import PlaceholderScreen from './PlaceholderScreen.vue'

const props = defineProps<{
  frame: FrameStyle
  options: FrameOptions
  image: string | null
  width: number
  height: number
  /** 主题提供的投影 (box-shadow) */
  shadow: string
}>()

const color = computed(
  () =>
    props.frame.colors.find((c) => c.key === props.options.color) ??
    props.frame.colors.find((c) => c.key === props.frame.defaultColor) ??
    props.frame.colors[0],
)

/* ── 机身几何（全部由比率换算，随导出尺寸线性缩放） ── */
const bx = computed(() => props.width * props.frame.bezelX)
const bt = computed(() => props.width * props.frame.bezelTop)
const bb = computed(() => props.width * props.frame.bezelBottom)
const screenW = computed(() => props.width - bx.value * 2)
const screenH = computed(() => props.height - bt.value - bb.value)
const screenRadius = computed(() => props.frame.screenRadius * screenW.value)
const bodyRadius = computed(() => props.frame.bodyRadius * props.width)

const bodyStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  position: 'relative' as const,
  width: `${props.width}px`,
  height: `${props.height}px`,
  borderRadius: `${bodyRadius.value}px`,
  background: color.value.body,
  padding: `${bt.value}px ${bx.value}px ${bb.value}px`,
  boxShadow: [
    ...(props.options.shadow ? [props.shadow] : []),
    `inset 0 0 0 ${Math.max(1, props.width * 0.0022)}px ${color.value.edge}`,
  ]
    .filter(Boolean)
    .join(', '),
}))

const screenStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  position: 'relative' as const,
  width: `${screenW.value}px`,
  height: `${screenH.value}px`,
  borderRadius: `${screenRadius.value}px`,
  overflow: 'hidden',
  background: '#000',
}))

/* ── 灵动岛 ── */
const islandStyle = computed(() => {
  const sw = screenW.value
  return {
    position: 'absolute' as const,
    left: '50%',
    top: `${sw * 0.028}px`,
    transform: 'translateX(-50%)',
    width: `${sw * 0.319}px`,
    height: `${sw * 0.0934}px`,
    borderRadius: '999px',
    background: '#000',
  }
})

/* ── 经典刘海（自屏幕顶边垂下） ── */
const notchStyle = computed(() => {
  const sw = screenW.value
  return {
    position: 'absolute' as const,
    left: '50%',
    top: '0',
    transform: 'translateX(-50%)',
    width: `${sw * 0.42}px`,
    height: `${sw * 0.088}px`,
    background: '#000',
    borderBottomLeftRadius: `${sw * 0.05}px`,
    borderBottomRightRadius: `${sw * 0.05}px`,
  }
})

/* ── 屏幕内前摄镜头（灵动岛 / 刘海内部，深色镜片融入黑底） ── */
const frontCameraStyle = computed(() => {
  const sw = screenW.value
  const isIsland = props.frame.notch === 'island'
  const dia = (isIsland ? 0.052 : 0.05) * sw
  // 灵动岛：镜头在岛内右侧；刘海：镜头在刘海内右侧
  const cx = sw * 0.5 + sw * (isIsland ? 0.115 : 0.15)
  const cy = isIsland ? sw * (0.028 + 0.0467) : sw * 0.044
  return {
    position: 'absolute' as const,
    left: `${cx - dia / 2}px`,
    top: `${cy - dia / 2}px`,
    width: `${dia}px`,
    height: `${dia}px`,
    borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 30%, #3c3f47 0%, #17181c 55%, #0a0b0d 100%)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 255, 255, 0.06)',
  }
})

/* ── 听筒扬声器（Home 机顶部） ── */
const earpieceStyle = computed(() => {
  const w = props.width * 0.3
  const h = props.width * 0.034
  const isDarkFront = color.value.key === 'black'
  return {
    position: 'absolute' as const,
    left: '50%',
    top: `${bt.value / 2 - h / 2}px`,
    transform: 'translateX(-50%)',
    width: `${w}px`,
    height: `${h}px`,
    borderRadius: '999px',
    background: isDarkFront ? '#33363d' : '#c6c9cf',
  }
})

/* Home 机摄像头在听筒左侧（顶部边框较厚，定位在边框上没有溢出问题） */
const homeCameraStyle = computed(() => {
  const dia = props.width * 0.062
  return {
    position: 'absolute' as const,
    left: `calc(50% - ${props.width * 0.195}px)`,
    top: `${bt.value / 2 - dia / 2}px`,
    transform: 'translateX(-50%)',
    width: `${dia}px`,
    height: `${dia}px`,
    borderRadius: '50%',
    background: '#1e2026',
    boxShadow: `inset 0 0 0 ${Math.max(1, props.width * 0.004)}px rgba(120, 130, 150, 0.45)`,
  }
})

/* ── Home 键 ── */
const homeButtonStyle = computed(() => {
  const dia = props.width * 0.155
  const isDarkFront = color.value.key === 'black'
  return {
    position: 'absolute' as const,
    left: '50%',
    bottom: `${bb.value / 2 - dia / 2}px`,
    transform: 'translateX(-50%)',
    width: `${dia}px`,
    height: `${dia}px`,
    borderRadius: '50%',
    background: isDarkFront ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
    border: `${Math.max(1, props.width * 0.007)}px solid ${color.value.edge}`,
  }
})

/* ── iPad 顶部摄像头 ── */
const ipadCameraStyle = computed(() => {
  const dia = props.width * 0.026
  return {
    position: 'absolute' as const,
    left: '50%',
    top: `${bt.value / 2 - dia / 2}px`,
    transform: 'translateX(-50%)',
    width: `${dia}px`,
    height: `${dia}px`,
    borderRadius: '50%',
    background: '#1e2026',
    boxShadow: `inset 0 0 0 ${Math.max(1, props.width * 0.003)}px rgba(120, 130, 150, 0.4)`,
  }
})

/* ── 状态栏（时间 + 信号 / Wi-Fi / 电量） ── */
const statusBarStyle = computed(() => {
  const sw = screenW.value
  return {
    position: 'absolute' as const,
    top: '0',
    left: '0',
    right: '0',
    boxSizing: 'border-box' as const,
    height: `${sw * 0.15}px`,
    padding: `0 ${sw * 0.075}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#fff',
    fontSize: `${sw * 0.045}px`,
    fontWeight: '600',
    letterSpacing: '0.01em',
    textShadow: '0 1px 3px rgba(0,0,0,0.35)',
    pointerEvents: 'none' as const,
  }
})

const iconGroupStyle = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: `${screenW.value * 0.016}px`,
}))

const signalSvg = computed(() => ({ width: `${screenW.value * 0.048}px` }))
const wifiSvg = computed(() => ({ width: `${screenW.value * 0.042}px` }))
const batterySvg = computed(() => ({ width: `${screenW.value * 0.062}px` }))
</script>

<template>
  <div :style="bodyStyle">
    <div :style="screenStyle">
      <img
        v-if="image"
        :src="image"
        alt=""
        draggable="false"
        :style="{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }"
      />
      <PlaceholderScreen v-else :w="screenW" :h="screenH" />

      <!-- 状态栏 -->
      <div v-if="options.statusBar" :style="statusBarStyle">
        <span>9:41</span>
        <span :style="iconGroupStyle">
          <svg :style="signalSvg" viewBox="0 0 17 11" fill="currentColor">
            <rect x="0" y="7" width="3" height="4" rx="1" />
            <rect x="4.5" y="5" width="3" height="6" rx="1" />
            <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
            <rect x="13.5" y="0" width="3" height="11" rx="1" />
          </svg>
          <svg :style="wifiSvg" viewBox="0 0 16 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
            <path d="M1.5 4.2a10 10 0 0 1 13 0" />
            <path d="M3.8 6.8a6.5 6.5 0 0 1 8.4 0" />
            <path d="M6 9.4a3.2 3.2 0 0 1 4 0" />
            <circle cx="8" cy="11.2" r="0.7" fill="currentColor" stroke="none" />
          </svg>
          <svg :style="batterySvg" viewBox="0 0 25 12">
            <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" fill="none" stroke="#fff" stroke-opacity="0.45" />
            <rect x="2.2" y="2.2" width="15" height="7.6" rx="1.8" fill="#fff" />
            <path d="M23 4.2v3.6a2.1 2.1 0 0 0 0-3.6z" fill="#fff" fill-opacity="0.45" />
          </svg>
        </span>
      </div>

      <!-- 灵动岛 / 刘海（含内部前摄镜头） -->
      <div v-if="frame.notch === 'island'" :style="islandStyle" />
      <div v-else-if="frame.notch === 'notch'" :style="notchStyle" />
      <div v-if="frame.notch === 'island' || frame.notch === 'notch'" :style="frontCameraStyle" />
    </div>

    <!-- 机身正面细节（仅 Home 听筒/前摄、iPad 摄像头等位于边框上的元素） -->
    <div v-if="frame.earpiece" :style="earpieceStyle" />
    <div v-if="frame.camera === 'left'" :style="homeCameraStyle" />
    <div v-else-if="frame.camera === 'center'" :style="ipadCameraStyle" />
    <div v-if="frame.homeButton" :style="homeButtonStyle" />
  </div>
</template>
