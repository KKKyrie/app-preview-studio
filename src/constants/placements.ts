/**
 * 创意素材（Creative Assets）坑位表。
 *
 * 覆盖 Apple 在 iOS 27 / iPadOS 27 新增的两个坑位：
 *  - 标题图Header —— 进入产品页的第一眼，表达品牌与季节内容
 *  - 搜索结果图 Search Results —— 搜索列表里的首图
 *
 * ── 关键结构：每个坑位各有 **两种** 尺寸 ─────────────────────────────────
 * 官方规格表中每个 Placement 单元格都横跨 **2 个子行**（HTML 里是 row-span-2），
 * 其中第二个子行是「16:9 · 5244 × 2950 · 仅 PNG」，**同时挂在两个坑位下**。
 * 所以：
 *   标题图      → 3840 × 1646 (21:9)   或  5244 × 2950 (16:9)
 *   搜索结果图  → 1920×1280 / 3840×2560 (3:2)  或  5244 × 2950 (16:9)
 *
 * 5244 × 2950 出现在两个坑位下，意味着**同一份文件可以同时填两处**——
 * 对应 App Store Connect 版本页的「Use header asset in search results」选项。
 * 因此它不是第三个独立坑位，而是两个坑位**共用的一个尺寸**（本表标记 universal）。
 *
 * ── 数据来源 ────────────────────────────────────────────────────────────
 * 尺寸与格式来自 Apple 官方规格表：
 *   https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
 *
 * 安全区 Apple **从不公布**像素值，官方只有定性规则（"design key elements
 * with a safe area in mind … keep your focal point within the center"）。
 * 数值由我们从 Apple 官方 Sketch 模板中直接解析图层坐标实测得到：
 *   https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-templates.sketch
 *
 * ⚠️ 解析陷阱：Sketch 里的 **group frame 字段可能是过期值**，必须用父组的
 *    x/y 作原点 + 组内**叶子矩形**的宽高。例如 16:9 画板的 `Art Safe Area`
 *    组 frame 写的是 1658×1060（与搜索结果画板的组完全同值，明显是复制残留），
 *    但其内部叶子矩形实际是 1402×962。
 *
 * 实测校验（三重）：
 *  1. 三个画布的安全区水平方向完美居中（左右边距完全相等）
 *  2. 标题图与搜索结果画板垂直方向也居中
 *  3. 16:9 画板垂直偏上：上边距 660 / 下边距 1328，安全区中心比画布中心偏上 334px
 *     → 「肉眼看着居中」的排版在通用尺寸上是错的，版式必须以安全区为基准
 */

import type { Rect } from '@/types'

export type { Rect }

export type PlacementId = 'header' | 'search'

/** 安全区来源：实测（Apple 模板）/ 推导（由等比缩放得到） */
export type SafeAreaSource = 'measured' | 'derived'

export interface CanvasOption {
  width: number
  height: number
  label: string
  /** 比例标签，如 '21:9' */
  aspect: string
  /** **该画布尺寸下**的安全区（画布坐标系像素值） */
  safeArea: Rect
  safeAreaSource: SafeAreaSource
  /** 该尺寸接受的格式 */
  formats: string[]
  /** 通用尺寸：同一份文件可同时用于两个坑位 */
  universal?: boolean
  /** 面板提示 */
  note?: string
}

export interface Placement {
  id: PlacementId
  name: string
  /** App Store Connect 中的英文名，便于对照后台 */
  ascName: string
  canvasOptions: CanvasOption[]
  /** 坑位用途一句话说明 */
  note: string
}

/* ── 实测安全区（来自 Apple Sketch 模板） ───────────────────────────────── */

/** 3840 × 1646 · 21:9 · 标题图 */
const HEADER_21x9: CanvasOption = {
  width: 3840,
  height: 1646,
  label: '3840 × 1646',
  aspect: '21:9',
  safeArea: { x: 1097, y: 493, width: 1646, height: 661 },
  safeAreaSource: 'measured',
  formats: ['.jpeg', '.jpg', '.png'],
}

/** 3840 × 2560 · 3:2 · 搜索结果图 */
const SEARCH_3x2_L: CanvasOption = {
  width: 3840,
  height: 2560,
  label: '3840 × 2560',
  aspect: '3:2',
  safeArea: { x: 836, y: 765, width: 2168, height: 1030 },
  safeAreaSource: 'measured',
  formats: ['.jpeg', '.jpg', '.png'],
}

/**
 * 1920 × 1280 · 3:2 · 搜索结果图
 *
 * Apple 模板只提供了 3840 × 2560 的安全区。两者**同为 3:2**，而裁切行为由
 * 宽高比与设备决定，因此同一比例下安全区在画布上的**相对位置完全一致**，
 * 按 0.5 等比缩放即可精确还原（缩放后仍水平居中：418 + 1084 = 1502 = 1920 − 418）。
 * 垂直方向因 765 × 0.5 = 382.5 取整到 383，产生 1px 误差，可忽略。
 */
const SEARCH_3x2_S: CanvasOption = {
  width: 1920,
  height: 1280,
  label: '1920 × 1280',
  aspect: '3:2',
  safeArea: { x: 418, y: 383, width: 1084, height: 515 },
  safeAreaSource: 'derived',
  formats: ['.jpeg', '.jpg', '.png'],
}

/**
 * 5244 × 2950 · 16:9 · **两个坑位共用**
 *
 * 安全区仅占画布 8.7%，是所有尺寸里最难排的；且垂直方向偏上 334px，
 * 肉眼按视觉居中的排版在这里是错的。
 */
const UNIVERSAL_16x9: CanvasOption = {
  width: 5244,
  height: 2950,
  label: '5244 × 2950',
  aspect: '16:9',
  safeArea: { x: 1921, y: 660, width: 1402, height: 962 },
  safeAreaSource: 'measured',
  universal: true,
  formats: ['.png'],
  note: '安全区仅占画布 8.7%，且垂直偏上 334px',
}

export const PLACEMENTS: Placement[] = [
  {
    id: 'header',
    name: '标题图',
    ascName: 'Product Page Header',
    canvasOptions: [HEADER_21x9, UNIVERSAL_16x9],
    note: '进入产品页的第一眼，表达品牌与季节内容',
  },
  {
    id: 'search',
    name: '搜索结果图',
    ascName: 'Search Results',
    canvasOptions: [SEARCH_3x2_L, SEARCH_3x2_S, UNIVERSAL_16x9],
    note: '搜索列表里的首图，建议直观展示产品用途',
  },
]

export const DEFAULT_PLACEMENT_ID: PlacementId = 'header'

/** 默认尺寸：标题图的 3840 × 1646 */
export const DEFAULT_CANVAS_ID = `${HEADER_21x9.width}x${HEADER_21x9.height}`

export function getPlacement(id: string): Placement {
  return PLACEMENTS.find((p) => p.id === id) ?? PLACEMENTS[0]
}

/** 坑位内按 `宽x高` 解析尺寸；容错：手改项目 JSON / 切换坑位后回退到该坑位首个尺寸 */
export function resolveCanvasOption(placement: Placement, canvasId: string): CanvasOption {
  return (
    placement.canvasOptions.find((c) => `${c.width}x${c.height}` === canvasId) ??
    placement.canvasOptions[0]
  )
}

/** 全部去重后的尺寸（5244×2950 被两个坑位共用，只出现一次） */
export function allCanvasOptions(): CanvasOption[] {
  const seen = new Map<string, CanvasOption>()
  for (const p of PLACEMENTS) {
    for (const c of p.canvasOptions) {
      seen.set(`${c.width}x${c.height}`, c)
    }
  }
  return [...seen.values()]
}