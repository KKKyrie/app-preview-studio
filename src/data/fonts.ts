/**
 * 字体注册表：主标题 / 副标题各自独立选择字体。
 * - `stack` 是完整 CSS font-family 回退链（西文字体缺中文字形时回退苹方）。
 * - `weights` 为空表示 400–900 全部可用（可变字体 / 系统字体）。
 * - 单字重展示字体（得意黑 / Bebas）不参与伪加粗，字重选择会被钳制到唯一值。
 */

export interface FontDef {
  /** 持久化 id */
  id: string
  /** 面板显示名 */
  label: string
  /** 完整 font-family 回退链 */
  stack: string
  /** 可用字重（缺省 = 400–900 全部） */
  weights?: number[]
  /** 授权 / 风格备注（tooltip 用） */
  note?: string
}

export const ALL_WEIGHTS = [400, 500, 600, 700, 800, 900] as const

const SYSTEM_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', Arial, sans-serif"

export const FONTS: FontDef[] = [
  {
    id: 'system',
    label: '系统默认',
    stack: SYSTEM_STACK,
    note: '跟随工作台界面字体（SF / 苹方）',
  },
  {
    id: 'pingfang',
    label: '苹方',
    stack: "'PingFang SC', 'Helvetica Neue', 'Microsoft YaHei', Arial, sans-serif",
    weights: [400, 500, 600],
    note: 'Apple 官方中文字体 PingFang SC（系统自带）',
  },
  {
    id: 'misans',
    label: 'MiSans',
    stack: "'MiSans', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    weights: [400, 500, 600, 700, 900],
    note: '小米开源字体，免费商用',
  },
  {
    id: 'smiley',
    label: '得意黑',
    stack: "'Smiley Sans', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    weights: [400],
    note: '斜体展示字体，单字重（SIL OFL 开源）',
  },
  {
    id: 'puhuiti',
    label: '阿里巴巴普惠体',
    stack: "'Alibaba PuHuiTi 2.0', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    weights: [400, 700],
    note: '常规 55 / 粗体 85，免费商用',
  },
  {
    id: 'noto-sans-sc',
    label: '思源黑体',
    stack: "'Noto Sans SC Variable', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    note: '思源黑体 = Noto Sans SC，SIL OFL 开源',
  },
  {
    id: 'inter',
    label: 'Inter',
    stack: "'Inter Variable', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    note: '西文 UI 字体，中文回退苹方（SIL OFL）',
  },
  {
    id: 'montserrat',
    label: 'Montserrat',
    stack: "'Montserrat Variable', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    note: '几何无衬线西文，中文回退苹方（SIL OFL）',
  },
  {
    id: 'playfair-display',
    label: 'Playfair Display',
    stack: "'Playfair Display Variable', 'Songti SC', Georgia, serif",
    note: '高对比衬线标题字，中文回退宋体（SIL OFL）',
  },
  {
    id: 'bebas-neue',
    label: 'Bebas Neue',
    stack: "'Bebas Neue', 'PingFang SC', 'Helvetica Neue', Arial, sans-serif",
    weights: [400],
    note: '全大写窄体标题字，单字重（SIL OFL）',
  },
]

export const DEFAULT_FONT_ID = 'system'

/** 按 id 取字体；未知 id 回退到系统默认（容错旧项目数据） */
export function getFont(id: string | undefined | null): FontDef {
  return FONTS.find((f) => f.id === id) ?? FONTS[0]
}

/** 该字体实际提供的字重列表（用于过滤字重按钮） */
export function fontWeights(id: string | undefined | null): number[] {
  return getFont(id).weights ?? [...ALL_WEIGHTS]
}

/** 切换字体时把当前字重钳制到该字体最接近的可用值 */
export function nearestWeight(id: string | undefined | null, weight: number): number {
  const weights = fontWeights(id)
  return weights.reduce((best, w) =>
    Math.abs(w - weight) < Math.abs(best - weight) ? w : best,
  )
}
