import type { ScreenshotSize } from '@/types'

/**
 * App Store Connect 实际要求的截图上传尺寸（2026-09 在 ASC 后台逐项核对）：
 * - iPhone：仅 6.5" 档 —— 1284×2778 / 1242×2688
 * - iPad：仅 13" 档 —— 2064×2752 / 2048×2732
 *
 * 横屏尺寸（如 2778×1284）与竖屏一一对应，由「方向」开关交换宽高生成，
 * 因此这里只登记竖屏基准。
 *
 * 官方规格参考：https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications
 */
export const SIZES: ScreenshotSize[] = [
  // ───────────────────────── iPhone ─────────────────────────
  {
    id: 'iphone-6.5-1284x2778',
    group: 'iphone',
    display: '6.5"',
    width: 1284,
    height: 2778,
    devices: 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max 等',
  },
  {
    id: 'iphone-6.5-1242x2688',
    group: 'iphone',
    display: '6.5"',
    width: 1242,
    height: 2688,
    devices: 'iPhone 11 Pro Max / XS Max / 11 / XR 等',
  },

  // ───────────────────────── iPad ─────────────────────────
  {
    id: 'ipad-13-2064x2752',
    group: 'ipad',
    display: '13"',
    width: 2064,
    height: 2752,
    devices: 'iPad Pro M5/M4 / iPad Air M2-M4 等',
  },
  {
    id: 'ipad-13-2048x2732',
    group: 'ipad',
    display: '13"',
    width: 2048,
    height: 2732,
    devices: 'iPad Pro（第 1-6 代）等',
  },
]

/** 默认选中：iPhone 6.5" 1284×2778 */
export const DEFAULT_SIZE_ID = 'iphone-6.5-1284x2778'

export function getSize(id: string): ScreenshotSize {
  const size = SIZES.find((s) => s.id === id)
  if (!size) throw new Error(`未知的截图尺寸: ${id}`)
  return size
}
