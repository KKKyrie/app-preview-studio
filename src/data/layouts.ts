/**
 * 布局注册表：定义「文字 + 手机截图」标准布局的参数与几何解析。
 *
 * 所有位置参数均为「比率」（相对画布宽/高），保证切换导出尺寸后版式不变；
 * resolve() 将其换算为当前画布尺寸下的像素值。
 * phones[] 按绘制顺序返回（最后绘制的在视觉最上层）。
 */

export type TextAlign = 'left' | 'center' | 'right'
export type Anchor = 'top' | 'bottom'

export interface LayoutField {
  key: string
  label: string
  min: number
  max: number
  step: number
}

export interface LayoutCtx {
  /** 画布宽 (px) */
  w: number
  /** 画布高 (px) */
  h: number
  /** 手机边框宽高比 (width / height) */
  aspect: number
}

/** 文本块位置（像素）。anchor 决定 y 相对顶部还是底部 */
export interface TextPlacement {
  anchor: Anchor
  y: number
  w: number
  /** 水平偏移：align=center 时相对居中位置；left/right 时为边距 */
  x: number
  align: TextAlign
  /**
   * x 直接作为画布绝对坐标使用，忽略 align 的水平基准换算。
   * 创意素材版式以**安全区**为基准（可能并非画布居中），需要这种精确定位；
   * 截图版式不使用该字段，行为完全不变。
   */
  absolute?: boolean
}

/** 手机位置。y 相对 anchor 边；scale 相对画布高 */
export interface PhonePlacement {
  anchor: Anchor
  y: number
  scale: number
  align: 'left' | 'center' | 'right'
  /** 相对 align 基准的水平微调 (px) */
  xOffset: number
  /** 该手机的独立旋转角（deg）；缺省时使用边框全局倾角 */
  rotate?: number
}

export interface LayoutResult {
  /** 主文本块（headline；subtitlePlacement 缺省时 subtitle 紧随其后） */
  text: TextPlacement
  /** subtitle 独立定位（「夹持式」布局用） */
  subtitlePlacement?: TextPlacement
  /** 手机们（按绘制顺序） */
  phones: PhonePlacement[]
}

export interface LayoutPreset {
  id: string
  name: string
  hint: string
  defaults: Record<string, number>
  fields: LayoutField[]
  resolve(ctx: LayoutCtx, params: Record<string, number>): LayoutResult
}

/** 文本块左边界（像素） */
export function textLeft(p: TextPlacement, canvasW: number): number {
  // 创意素材版式：x 即画布绝对坐标（安全区未必与画布居中对齐）
  if (p.absolute) return p.x
  if (p.align === 'left') return p.x
  if (p.align === 'right') return canvasW - p.w + p.x
  return (canvasW - p.w) / 2 + p.x
}

/** 手机左边界（像素） */
export function phoneLeft(p: PhonePlacement, canvasW: number, phoneW: number): number {
  if (p.align === 'left') return p.xOffset
  if (p.align === 'right') return canvasW - phoneW + p.xOffset
  return (canvasW - phoneW) / 2 + p.xOffset
}

/** 垂直居中的手机 y（anchor=top） */
function centeredY(p: number): number {
  return (1 - p) / 2
}

export const LAYOUTS: LayoutPreset[] = [
  {
    id: 'text-top',
    name: '文案在上',
    hint: '最经典的上标题、下截图布局，适用于绝大多数场景。',
    defaults: { textY: 0.085, textWidth: 0.84, phoneY: 0.05, phoneScale: 0.6 },
    fields: [
      { key: 'textY', label: '文案距顶', min: 0.03, max: 0.3, step: 0.005 },
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 0.96, step: 0.01 },
      { key: 'phoneY', label: '手机距底', min: 0.02, max: 0.3, step: 0.005 },
      { key: 'phoneScale', label: '手机大小', min: 0.35, max: 0.85, step: 0.01 },
    ],
    resolve: (ctx, p) => ({
      text: { anchor: 'top', y: p.textY * ctx.h, w: p.textWidth * ctx.w, x: 0, align: 'center' },
      phones: [
        { anchor: 'bottom', y: p.phoneY * ctx.h, scale: p.phoneScale, align: 'center', xOffset: 0 },
      ],
    }),
  },

  {
    id: 'text-bottom',
    name: '文案在下',
    hint: '截图打头阵、文案收尾，适合强调界面本身。',
    defaults: { textY: 0.085, textWidth: 0.84, phoneY: 0.05, phoneScale: 0.6 },
    fields: [
      { key: 'phoneY', label: '手机距顶', min: 0.02, max: 0.3, step: 0.005 },
      { key: 'phoneScale', label: '手机大小', min: 0.35, max: 0.85, step: 0.01 },
      { key: 'textY', label: '文案距底', min: 0.03, max: 0.3, step: 0.005 },
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 0.96, step: 0.01 },
    ],
    resolve: (ctx, p) => ({
      text: { anchor: 'bottom', y: p.textY * ctx.h, w: p.textWidth * ctx.w, x: 0, align: 'center' },
      phones: [
        { anchor: 'top', y: p.phoneY * ctx.h, scale: p.phoneScale, align: 'center', xOffset: 0 },
      ],
    }),
  },

  {
    id: 'text-side',
    name: '左文右机',
    hint: '左右分栏，横屏或 iPad 大画布下效果尤佳。',
    defaults: { textY: 0.1, textWidth: 0.42, textX: 0.07, phoneScale: 0.6, phoneInset: 0.06 },
    fields: [
      { key: 'textWidth', label: '文案宽度', min: 0.3, max: 0.55, step: 0.01 },
      { key: 'textY', label: '文案位置', min: 0.03, max: 0.4, step: 0.01 },
      { key: 'phoneScale', label: '手机大小', min: 0.4, max: 0.9, step: 0.01 },
      { key: 'phoneInset', label: '右侧留白', min: 0.0, max: 0.2, step: 0.01 },
    ],
    resolve: (ctx, p) => ({
      text: {
        anchor: 'top',
        y: p.textY * ctx.h,
        w: p.textWidth * ctx.w,
        x: p.textX * ctx.w,
        align: 'left',
      },
      phones: [
        {
          anchor: 'top',
          y: centeredY(p.phoneScale) * ctx.h,
          scale: p.phoneScale,
          align: 'right',
          xOffset: -p.phoneInset * ctx.w,
        },
      ],
    }),
  },

  {
    id: 'bleed-bottom',
    name: '手机出血',
    hint: '机身放大并探出画布底边，视觉冲击力更强。',
    defaults: { textY: 0.08, textWidth: 0.86, phoneY: -0.14, phoneScale: 0.95 },
    fields: [
      { key: 'textY', label: '文案距顶', min: 0.03, max: 0.3, step: 0.005 },
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 0.96, step: 0.01 },
      { key: 'phoneY', label: '出血程度', min: -0.3, max: 0.1, step: 0.01 },
      { key: 'phoneScale', label: '手机大小', min: 0.6, max: 1.3, step: 0.01 },
    ],
    resolve: (ctx, p) => ({
      text: { anchor: 'top', y: p.textY * ctx.h, w: p.textWidth * ctx.w, x: 0, align: 'center' },
      phones: [
        { anchor: 'bottom', y: p.phoneY * ctx.h, scale: p.phoneScale, align: 'center', xOffset: 0 },
      ],
    }),
  },

  {
    id: 'center-hold',
    name: '居中夹持',
    hint: '手机居中，标题在上、副标题在下，杂志感强。',
    defaults: { textY: 0.06, subY: 0.055, textWidth: 0.82, phoneScale: 0.6 },
    fields: [
      { key: 'textY', label: '标题距顶', min: 0.02, max: 0.25, step: 0.005 },
      { key: 'subY', label: '副标题距底', min: 0.02, max: 0.25, step: 0.005 },
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 0.96, step: 0.01 },
      { key: 'phoneScale', label: '手机大小', min: 0.35, max: 0.8, step: 0.01 },
    ],
    resolve: (ctx, p) => ({
      text: { anchor: 'top', y: p.textY * ctx.h, w: p.textWidth * ctx.w, x: 0, align: 'center' },
      subtitlePlacement: {
        anchor: 'bottom',
        y: p.subY * ctx.h,
        w: p.textWidth * ctx.w,
        x: 0,
        align: 'center',
      },
      phones: [
        {
          anchor: 'top',
          y: centeredY(p.phoneScale) * ctx.h,
          scale: p.phoneScale,
          align: 'center',
          xOffset: 0,
        },
      ],
    }),
  },

  {
    id: 'multi-phone',
    name: '多机错落',
    hint: '三台手机前后错落，展示多个界面，适合系列截图。',
    defaults: { textY: 0.07, textWidth: 0.84, phoneY: 0.06, phoneScale: 0.58, spread: 0.27 },
    fields: [
      { key: 'textY', label: '文案距顶', min: 0.03, max: 0.25, step: 0.005 },
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 0.96, step: 0.01 },
      { key: 'phoneScale', label: '主手机大小', min: 0.35, max: 0.75, step: 0.01 },
      { key: 'spread', label: '错落间距', min: 0.15, max: 0.4, step: 0.01 },
    ],
    resolve: (ctx, p) => {
      const back: PhonePlacement = {
        anchor: 'bottom',
        y: p.phoneY * ctx.h + 0.05 * ctx.h,
        scale: p.phoneScale * 0.85,
        align: 'center',
        xOffset: 0,
      }
      return {
        text: { anchor: 'top', y: p.textY * ctx.h, w: p.textWidth * ctx.w, x: 0, align: 'center' },
        phones: [
          { ...back, xOffset: -p.spread * ctx.w, rotate: -8 },
          { ...back, xOffset: p.spread * ctx.w, rotate: 8 },
          { anchor: 'bottom', y: p.phoneY * ctx.h, scale: p.phoneScale, align: 'center', xOffset: 0 },
        ],
      }
    },
  },
]
