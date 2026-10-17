/**
 * 裁剪几何：画框锁定官方比例，源图在框内平移 / 缩放。
 *
 * ── 为什么存「相对量」而不是像素 ────────────────────────────────────────
 * 用户完全可能先按 21:9 裁好，再切到 16:9 复用同一张图。若把位置存成画布
 * 像素，换尺寸后就得重新换算，而换算方式没有唯一正确答案。
 * 这里改为两个相对量：
 *   zoom   = 相对「刚好铺满画框的最小缩放」的倍数（≥ 1，1 = 刚好铺满）
 *   offset = 归一化到「多余空间」的比例，-1 贴左上 / 0 居中 / +1 贴右下
 * 于是切尺寸时用户的构图意图被保留（「看右边」切完还是「看右边」），
 * 且某轴只要没有多余空间（例如竖图裁超宽画布的水平轴），偏移自然被夹为 0。
 *
 * ── 为什么只允许「铺满」，不允许缩小到露底 ──────────────────────────────
 * zoom < 1 会在画框里露出空白。Apple 要求成品不带透明通道，露出的只能是
 * 某个纯色底——那就等于替用户选了一个他从未表达过的背景色。宁可让用户
 * 上传更大的图，也不做这种「猜」。zoom 下限因此锁定为 1。
 */

export interface CropBox {
  /** 画框坐标系下的绘制矩形（px） */
  x: number
  y: number
  width: number
  height: number
}

export interface CropTransform {
  zoom: number
  offset: { x: number; y: number }
}

/**
 * 裁剪缩放上限。
 *
 * 两个理由：一是超过这个倍数源图必然被放大到糊（下面有 usedSourceWidth 量化），
 * 二是绘制矩形会变成画框的 4 倍——5244×2950 的画框意味着 20976×11798 的
 * 元素，再多就没有实际收益了。
 */
export const MAX_CROP_ZOOM = 4

/** 每次滚轮 / 按钮的缩放倍率（与预览缩放一致，手感统一） */
export const CROP_ZOOM_STEP = 1.1

function clampAxis(v: number): number {
  return Number.isFinite(v) ? Math.min(1, Math.max(-1, v)) : 0
}

/** 「刚好铺满画框」时源图的显示尺寸（cover 语义：两个方向都不留缝） */
export function coverSize(
  frameW: number,
  frameH: number,
  srcW: number,
  srcH: number,
): { width: number; height: number } {
  const aspect = srcW > 0 && srcH > 0 ? srcW / srcH : 1
  // 取较大者：若源图相对更宽（aspect 更大），高度顶满；否则宽度顶满
  const width = Math.max(frameW, frameH * aspect)
  return { width, height: width / aspect }
}

/**
 * 两个轴各自可用的「多余空间」的一半（画框坐标系 px）。
 *
 * 拖拽换算与偏移夹紧共用它：多余空间为 0 的轴上偏移无意义，直接锁 0，
 * 避免用户拖了没反应却不知道为什么。
 */
export function cropSlack(
  frameW: number,
  frameH: number,
  srcW: number,
  srcH: number,
  zoom: number,
): { x: number; y: number } {
  const cover = coverSize(frameW, frameH, srcW, srcH)
  return {
    x: Math.max(0, (cover.width * zoom - frameW) / 2),
    y: Math.max(0, (cover.height * zoom - frameH) / 2),
  }
}

/**
 * 解出源图在画框坐标系里的绘制矩形。
 *
 * 推导（以 x 轴为例）：offset.x = -1 表示「源图左边缘对齐画框左边缘」（看到
 * 源图最左部分），= +1 表示「源图右边缘对齐画框右边缘」（看到最右部分）。
 * 两者之间线性插值即 x = -slack.x * (1 + offset.x)。
 */
export function resolveCropBox(
  frameW: number,
  frameH: number,
  srcW: number,
  srcH: number,
  t: CropTransform,
): CropBox {
  const cover = coverSize(frameW, frameH, srcW, srcH)
  const width = cover.width * t.zoom
  const height = cover.height * t.zoom
  const slack = cropSlack(frameW, frameH, srcW, srcH, t.zoom)
  return {
    x: -slack.x * (1 + t.offset.x),
    y: -slack.y * (1 + t.offset.y),
    width,
    height,
  }
}

/** 夹到合法范围：zoom ∈ [1, MAX]、offset 两轴各自 ∈ [-1, 1] */
export function clampCrop(t: CropTransform): CropTransform {
  const zoom = Number.isFinite(t.zoom)
    ? Math.min(MAX_CROP_ZOOM, Math.max(1, t.zoom))
    : 1
  return { zoom, offset: { x: clampAxis(t.offset.x), y: clampAxis(t.offset.y) } }
}

/**
 * 拖拽换算：画框坐标系下位移 (dx, dy) 后应有的新偏移。
 *
 * 语义是「抓住图片拖」——向右拖，图片右移，露出源图的左侧，因此 offset.x 减小。
 * 某轴没有多余空间时该轴偏移保持为 0（拖不动，也不会累积偏差）。
 */
export function nudgeOffset(
  frameW: number,
  frameH: number,
  srcW: number,
  srcH: number,
  t: CropTransform,
  dx: number,
  dy: number,
): { x: number; y: number } {
  const slack = cropSlack(frameW, frameH, srcW, srcH, t.zoom)
  return {
    x: slack.x > 0 ? clampAxis(t.offset.x - dx / slack.x) : 0,
    y: slack.y > 0 ? clampAxis(t.offset.y - dy / slack.y) : 0,
  }
}

/**
 * 该构图实际用到的源图像素宽度。
 *
 * 用来判断成品会不会糊：小于画框宽度就说明源图被放大，App Store 的画质
 * 要求下这是会被驳回的。裁剪工具必须把这件事量化给用户看，而不是等他
 * 上传到后台才发现。
 */
export function usedSourceWidth(frameW: number, srcW: number, drawnW: number): number {
  if (drawnW <= 0) return 0
  return (srcW * frameW) / drawnW
}

/** 是否所有轴都已经没有可调空间（用于禁用拖拽提示） */
export function isCropLocked(
  frameW: number,
  frameH: number,
  srcW: number,
  srcH: number,
  zoom: number,
): boolean {
  const slack = cropSlack(frameW, frameH, srcW, srcH, zoom)
  return slack.x <= 0.5 && slack.y <= 0.5
}
