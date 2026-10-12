import { ref } from 'vue'

import { checkSafeArea, type SafeAreaReport } from '@/composables/useSafeArea'
import type { SafeAreaViolation } from '@/types'

/**
 * 安全区检查的跨组件共享状态。
 *
 * 画布在预览区测量（CreativeStage），结果需要在左侧面板（SafeAreaPanel）
 * 与顶栏徽章（ModeSwitch）同时显示。用模块级单例共享，避免层层透传。
 */

const EMPTY: SafeAreaReport = { violations: [], checked: 0, boxes: new Map() }

/** 最近一次测量结果 */
export const safeAreaReport = ref<SafeAreaReport>(EMPTY)

/** 面板点击某一行时闪烁定位的元素 */
export const flashRole = ref<string | null>(null)

let flashTimer: ReturnType<typeof setTimeout> | undefined

/** 画布渲染后回填测量结果 */
export function publishSafeAreaReport(report: SafeAreaReport) {
  safeAreaReport.value = report
}

/** 闪烁定位：让用户从面板一眼看到问题元素在画布上的位置 */
export function flashViolation(role: SafeAreaViolation['role']) {
  flashRole.value = role
  clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    flashRole.value = null
  }, 1200)
}

export { checkSafeArea, EMPTY as EMPTY_SAFE_AREA_REPORT }
export type { SafeAreaReport }