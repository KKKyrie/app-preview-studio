/**
 * 横幅版式注册表：创意素材（页头 / 搜索结果 / 通用）的几何解析。
 *
 * ── 与截图版式（data/layouts.ts）的根本区别 ──────────────────────────────
 * 截图版式所有位置参数相对**画布边缘**；本文件的版式全部相对**安全区**定义。
 *
 * 这样做的收益是「版式天生不会越界」：Apple 的安全区是所有设备 / 方向裁切方式的
 * 交集，关键元素落在其中就一定不会被裁掉。越界只可能来自用户把文案写太长或字号
 * 调太大——而那正是安全区检查该抓的。
 *
 * 背景与主体图仍相对画布，允许自由出血（出血是设计意图，不应被安全区判为越界）。
 *
 * 另注：Apple 对页头的指导是 "focus on a single, clear idea; visually dense or
 * cluttered assets dilute your impact"，因此这里刻意不提供截图模式那种「多机错落」
 * 式的高密度版式。
 */

export interface BannerField {
  key: string
  label: string
  min: number
  max: number
  step: number
}

export interface BannerCtx {
  /** 画布宽高（px） */
  w: number
  h: number
  /** 安全区原点与尺寸（px） */
  safeX: number
  safeY: number
  safeW: number
  safeH: number
  /** 主体图原始宽高比（width / height）；无图为 0 */
  imageAspect: number
  /**
   * 文案块实测底边（画布坐标系 y）。
   *
   * 文本块高度取决于字体与换行，只有渲染后测量才知道。把它回传给版式，
   * 「上文下图」才能把图片压到文案下方而不是与之重叠。
   * 未测量到时为 0，版式退回纯比例定位（不会出错，只是可能重叠）。
   */
  textBottom: number
}

export interface BannerTextBox {
  x: number
  y: number
  width: number
  align: 'left' | 'center' | 'right'
}

export interface BannerImageBox {
  x: number
  y: number
  width: number
  height: number
  /** 圆角（px） */
  radius: number
  /** 是否铺满整张画布作为背景（需要文字遮罩保证可读性） */
  fullBleed: boolean
}

export interface BannerLayoutResult {
  text: BannerTextBox
  image: BannerImageBox | null
}

export interface BannerLayout {
  id: string
  name: string
  hint: string
  defaults: Record<string, number>
  fields: BannerField[]
  resolve(ctx: BannerCtx, p: Record<string, number>, radius: number): BannerLayoutResult
}

/** 居中铺满裁切（cover）：返回在给定盒子内的实际绘制矩形 */
export function coverFit(
  boxW: number,
  boxH: number,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  if (!aspect || aspect <= 0) return { x: 0, y: 0, width: boxW, height: boxH }
  if (aspect > boxW / boxH) {
    const h = boxH
    return { x: (boxW - h * aspect) / 2, y: 0, width: h * aspect, height: h }
  }
  const w = boxW
  return { x: 0, y: (boxH - w / aspect) / 2, width: w, height: w / aspect }
}

function centeredText(ctx: BannerCtx, width: number, y: number): BannerTextBox {
  return { x: ctx.safeX + (ctx.safeW - width) / 2, y, width, align: 'center' }
}

function noImage(): BannerImageBox | null {
  return null
}

export const BANNER_LAYOUTS: BannerLayout[] = [
  {
    id: 'centered-claim',
    name: '居中主张',
    hint: 'logo + 主标题 + 副标题居中于安全区，不放图片。最克制，符合 Apple 「单一清晰概念」的推荐。',
    defaults: { textWidth: 0.9, textY: 0.16 },
    fields: [
      { key: 'textWidth', label: '文案宽度', min: 0.55, max: 1, step: 0.01 },
      { key: 'textY', label: '文案距安全区顶部', min: 0, max: 0.75, step: 0.005 },
    ],
    resolve: (ctx, p) => ({
      text: centeredText(ctx, p.textWidth * ctx.safeW, ctx.safeY + p.textY * ctx.safeH),
      image: noImage(),
    }),
  },

  {
    id: 'text-left',
    name: '左文右图',
    hint: '文案在安全区左侧，主体图在右侧并可向外出血。适合产品主视觉。',
    defaults: { textWidth: 0.44, textY: 0.24, imageScale: 1, bleed: 0.04 },
    fields: [
      { key: 'textWidth', label: '文案宽度', min: 0.3, max: 0.62, step: 0.01 },
      { key: 'textY', label: '文案距安全区顶部', min: 0, max: 0.6, step: 0.005 },
      { key: 'imageScale', label: '图片大小', min: 0.7, max: 1.6, step: 0.01 },
      { key: 'bleed', label: '图片右侧出血', min: 0, max: 0.4, step: 0.01 },
    ],
    resolve: (ctx, p, radius) => {
      const h = p.imageScale * ctx.safeH
      const right = ctx.safeX + ctx.safeW + p.bleed * ctx.safeW
      const w = ctx.imageAspect ? h * ctx.imageAspect : ctx.safeW * 0.36
      const box = coverFit(w, h, ctx.imageAspect)
      return {
        text: {
          x: ctx.safeX,
          y: ctx.safeY + p.textY * ctx.safeH,
          width: p.textWidth * ctx.safeW,
          align: 'left',
        },
        image: ctx.imageAspect
          ? {
              x: right - w - box.x,
              y: ctx.safeY + (ctx.safeH - h) / 2 + box.y,
              width: w,
              height: h,
              radius,
              fullBleed: false,
            }
          : null,
      }
    },
  },

  {
    id: 'text-top',
    name: '上文下图',
    hint: '文案压在安全区上半，主体图占据下半并向下出血。图片会自动避开文案，不会重叠。',
    defaults: { textWidth: 0.86, textY: 0.02, imageTop: 0.52, imageScale: 0.62 },
    fields: [
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 1, step: 0.01 },
      { key: 'textY', label: '文案距安全区顶部', min: 0, max: 0.3, step: 0.005 },
      { key: 'imageTop', label: '图片起始高度', min: 0.35, max: 0.9, step: 0.01 },
      { key: 'imageScale', label: '图片宽度', min: 0.3, max: 1.8, step: 0.01 },
    ],
    resolve: (ctx, p, radius) => {
      const w = p.imageScale * ctx.safeW
      const h = ctx.imageAspect ? w / ctx.imageAspect : ctx.safeH * 0.7
      const box = coverFit(w, h, ctx.imageAspect)
      // 取「比例位置」与「文案底边下方」中更下面的那个，避免压住文案
      const wanted = ctx.safeY + p.imageTop * ctx.safeH
      const belowText = ctx.textBottom > 0 ? ctx.textBottom + ctx.safeH * 0.06 : 0
      const top = Math.max(wanted, belowText)
      return {
        text: centeredText(ctx, p.textWidth * ctx.safeW, ctx.safeY + p.textY * ctx.safeH),
        image: ctx.imageAspect
          ? {
              x: ctx.safeX + (ctx.safeW - w) / 2 + box.x,
              y: top + box.y,
              width: w,
              height: h,
              radius,
              fullBleed: false,
            }
          : null,
      }
    },
  },

  {
    id: 'full-bleed',
    name: '满幅图底',
    hint: '主体图铺满整张画布作背景，文案压在图上，自动叠加渐变遮罩保证文字可读。适合季节 / 氛围向表达。',
    defaults: { textWidth: 0.82, textY: 0.22, scrim: 0.55 },
    fields: [
      { key: 'textWidth', label: '文案宽度', min: 0.5, max: 1, step: 0.01 },
      { key: 'textY', label: '文案距安全区顶部', min: 0, max: 0.75, step: 0.005 },
      { key: 'scrim', label: '文字遮罩强度', min: 0, max: 0.9, step: 0.01 },
    ],
    // 满幅背景不设圆角（radius 传入但忽略）
    resolve: (ctx, p) => ({
      text: centeredText(ctx, p.textWidth * ctx.safeW, ctx.safeY + p.textY * ctx.safeH),
      image: ctx.imageAspect
        ? { x: 0, y: 0, width: ctx.w, height: ctx.h, radius: 0, fullBleed: true }
        : null,
    }),
  },
]

export function getBannerLayout(id: string): BannerLayout {
  return BANNER_LAYOUTS.find((l) => l.id === id) ?? BANNER_LAYOUTS[0]
}