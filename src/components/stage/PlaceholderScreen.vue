<script setup lang="ts">
import { computed } from 'vue'

/**
 * 未上传截图时的占位「示例 App」界面。
 * 全部内联样式 + 确定性内容，导出结果稳定。
 */
const props = defineProps<{ w: number; h: number }>()

const px = (n: number) => `${n}px`

const rootStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  width: '100%',
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  background: 'linear-gradient(180deg, #f6f7fb 0%, #eceef5 100%)',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
  overflow: 'hidden',
}))

const headerStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  padding: `${px(props.w * 0.07)} ${px(props.w * 0.07)} ${px(props.w * 0.09)}`,
  background: 'linear-gradient(135deg, #4f7dff 0%, #7a5cff 100%)',
  color: '#fff',
  borderBottomLeftRadius: px(props.w * 0.09),
  borderBottomRightRadius: px(props.w * 0.09),
}))

const headerTopRow = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: px(props.w * 0.06),
}))

const greetingStyle = computed(() => ({ fontSize: px(props.w * 0.04), opacity: '0.85' }))

const avatarStyle = computed(() => ({
  width: px(props.w * 0.11),
  height: px(props.w * 0.11),
  borderRadius: '50%',
  background: 'rgba(255,255,255,0.28)',
  border: `${px(props.w * 0.006)} solid rgba(255,255,255,0.5)`,
}))

const headerTitleStyle = computed(() => ({
  fontSize: px(props.w * 0.075),
  fontWeight: '700',
  letterSpacing: '0.01em',
}))

const contentStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  flex: '1',
  minHeight: '0',
  padding: `${px(props.w * 0.07)} ${px(props.w * 0.06)}`,
  display: 'flex',
  flexDirection: 'column' as const,
  gap: px(props.w * 0.055),
}))

const statsRowStyle = computed(() => ({
  display: 'flex',
  gap: px(props.w * 0.05),
}))

const statCardStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  flex: '1',
  background: '#ffffff',
  borderRadius: px(props.w * 0.05),
  padding: px(props.w * 0.055),
  boxShadow: '0 4px 16px rgba(16,24,40,0.06)',
}))

const statNumberStyle = computed(() => ({
  fontSize: px(props.w * 0.095),
  fontWeight: '800',
  color: '#1a1f2e',
  lineHeight: '1.1',
}))

const statLabelStyle = computed(() => ({
  fontSize: px(props.w * 0.036),
  color: '#8d92a1',
  marginTop: px(props.w * 0.02),
}))

const listCardStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  background: '#ffffff',
  borderRadius: px(props.w * 0.05),
  padding: px(props.w * 0.03),
  boxShadow: '0 4px 16px rgba(16,24,40,0.06)',
  display: 'flex',
  flexDirection: 'column' as const,
}))

const rowStyle = computed(() => ({
  display: 'flex',
  alignItems: 'center',
  gap: px(props.w * 0.045),
  padding: `${px(props.w * 0.04)} ${px(props.w * 0.03)}`,
  borderBottom: '1px solid #f0f1f5',
}))

function rowIconStyle(i: number) {
  return {
    width: px(props.w * 0.105),
    height: px(props.w * 0.105),
    borderRadius: px(props.w * 0.032),
    flexShrink: '0',
    background: ['linear-gradient(135deg,#4f7dff,#7a5cff)', 'linear-gradient(135deg,#28c7a5,#12a3dd)', 'linear-gradient(135deg,#ff8f5a,#ff5a7f)'][i],
  }
}

const rowTextStyle = computed(() => ({
  flex: '1',
  minWidth: '0',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: px(props.w * 0.016),
}))

const rowTitleStyle = computed(() => ({
  fontSize: px(props.w * 0.042),
  fontWeight: '600',
  color: '#33384a',
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis' as const,
}))

const rowSubStyle = computed(() => ({
  fontSize: px(props.w * 0.034),
  color: '#9aa0b0',
}))

const rowDotStyle = computed(() => ({
  width: px(props.w * 0.055),
  height: px(props.w * 0.055),
  borderRadius: '50%',
  background: '#e6e8ee',
  flexShrink: '0',
}))

const tabBarStyle = computed(() => ({
  boxSizing: 'border-box' as const,
  height: px(props.w * 0.175),
  background: 'rgba(255,255,255,0.94)',
  borderTop: '1px solid #e6e8ee',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-around',
  paddingBottom: px(props.w * 0.02),
}))

function tabItemStyle(active: boolean) {
  return {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: px(props.w * 0.014),
    opacity: active ? '1' : '0.75',
  }
}

function tabIconStyle(active: boolean) {
  return {
    width: px(props.w * 0.052),
    height: px(props.w * 0.052),
    borderRadius: px(props.w * 0.016),
    background: active ? '#4f7dff' : '#c9cdd8',
  }
}

function tabLabelStyle(active: boolean) {
  return {
    fontSize: px(props.w * 0.028),
    color: active ? '#4f7dff' : '#b0b5c2',
  }
}

const rows = [
  { title: '团队周会', sub: '今天 10:00 · 会议室 A' },
  { title: '设计评审 v2.1', sub: '今天 14:30 · 4 人参与' },
  { title: '发布准备', sub: '明天 · 还剩 3 项待办' },
]

const tabs = ['概览', '任务', '发现', '我的']
</script>

<template>
  <div :style="rootStyle">
    <div :style="headerStyle">
      <div :style="headerTopRow">
        <span :style="greetingStyle">欢迎回来 👋</span>
        <span :style="avatarStyle" />
      </div>
      <div :style="headerTitleStyle">今日概览</div>
    </div>

    <div :style="contentStyle">
      <div :style="statsRowStyle">
        <div :style="statCardStyle">
          <div :style="statNumberStyle">24</div>
          <div :style="statLabelStyle">今日任务</div>
        </div>
        <div :style="statCardStyle">
          <div :style="statNumberStyle">92%</div>
          <div :style="statLabelStyle">本周完成率</div>
        </div>
      </div>

      <div :style="listCardStyle">
        <div v-for="(row, i) in rows" :key="row.title" :style="[rowStyle, i === rows.length - 1 ? { borderBottom: 'none' } : null]">
          <span :style="rowIconStyle(i)" />
          <span :style="rowTextStyle">
            <span :style="rowTitleStyle">{{ row.title }}</span>
            <span :style="rowSubStyle">{{ row.sub }}</span>
          </span>
          <span :style="rowDotStyle" />
        </div>
      </div>
    </div>

    <div :style="tabBarStyle">
      <span v-for="(t, i) in tabs" :key="t" :style="tabItemStyle(i === 0)">
        <span :style="tabIconStyle(i === 0)" />
        <span :style="tabLabelStyle(i === 0)">{{ t }}</span>
      </span>
    </div>
  </div>
</template>
