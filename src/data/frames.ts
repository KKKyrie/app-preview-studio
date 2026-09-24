/**
 * 手机边框注册表：全部由 CSS 自绘（无位图素材），任意导出尺寸下保持清晰。
 *
 * 几何均为比率：
 * - bezelX/bezelTop/bezelBottom : 机身边框厚度 / 机身宽
 * - screenRadius                : 屏幕圆角 / 屏幕宽
 * - bodyRadius                  : 机身圆角 / 机身宽
 * - notch 细节尺寸以屏幕宽 (sw) 为基准计算
 */

export type NotchType = 'island' | 'notch' | 'home' | null

export interface FrameColor {
  key: string
  name: string
  /** 机身主体色 */
  body: string
  /** 机身描边色（模拟边缘反光） */
  edge: string
}

export interface FrameStyle {
  id: string
  name: string
  hint: string
  /** 机身宽 / 高 */
  aspect: number
  bezelX: number
  bezelTop: number
  bezelBottom: number
  /** 屏幕圆角 / 屏幕宽 */
  screenRadius: number
  /** 机身圆角 / 机身宽 */
  bodyRadius: number
  notch: NotchType
  /** 刘海/Home 机的听筒与前摄、iPad 的顶部摄像头 */
  earpiece?: boolean
  camera?: 'left' | 'center'
  homeButton?: boolean
  colors: FrameColor[]
  defaultColor: string
}

const modernColors: FrameColor[] = [
  { key: 'black', name: '黑色', body: '#17181c', edge: 'rgba(255,255,255,0.16)' },
  { key: 'white', name: '白色', body: '#f2f3f5', edge: 'rgba(0,0,0,0.14)' },
  { key: 'titanium', name: '原色钛金属', body: '#8e8d88', edge: 'rgba(255,255,255,0.3)' },
  { key: 'gold', name: '沙漠金', body: '#c9a583', edge: 'rgba(255,255,255,0.32)' },
]

const classicColors: FrameColor[] = [
  { key: 'black', name: '黑色', body: '#17181c', edge: 'rgba(255,255,255,0.16)' },
  { key: 'silver', name: '银色', body: '#e3e5e9', edge: 'rgba(0,0,0,0.14)' },
  { key: 'gold', name: '金色', body: '#dfd3c0', edge: 'rgba(255,255,255,0.3)' },
  { key: 'rose', name: '玫瑰金', body: '#e8c8c4', edge: 'rgba(255,255,255,0.3)' },
]

export const FRAMES: FrameStyle[] = [
  {
    id: 'island',
    name: '灵动岛全面屏',
    hint: 'iPhone 15/16/17 Pro 及更新机型',
    aspect: 9 / 19.5,
    bezelX: 0.032,
    bezelTop: 0.032,
    bezelBottom: 0.032,
    screenRadius: 0.132,
    bodyRadius: 0.158,
    notch: 'island',
    colors: modernColors,
    defaultColor: 'black',
  },
  {
    id: 'notch',
    name: '刘海屏',
    hint: 'iPhone 12 – 14 系列',
    aspect: 9 / 19.5,
    bezelX: 0.04,
    bezelTop: 0.04,
    bezelBottom: 0.04,
    screenRadius: 0.128,
    bodyRadius: 0.152,
    notch: 'notch',
    colors: modernColors,
    defaultColor: 'black',
  },
  {
    id: 'home',
    name: 'Home 键经典款',
    hint: 'iPhone 8 / 7 / 6s 及 SE 机型',
    aspect: 0.486,
    bezelX: 0.065,
    bezelTop: 0.22,
    bezelBottom: 0.31,
    screenRadius: 0.028,
    bodyRadius: 0.11,
    notch: 'home',
    earpiece: true,
    camera: 'left',
    homeButton: true,
    colors: classicColors,
    defaultColor: 'black',
  },
  {
    id: 'ipad',
    name: 'iPad 窄边框',
    hint: 'iPad Pro / Air / 数字系列',
    aspect: 3 / 4,
    bezelX: 0.042,
    bezelTop: 0.042,
    bezelBottom: 0.042,
    screenRadius: 0.03,
    bodyRadius: 0.052,
    notch: null,
    camera: 'center',
    colors: [
      { key: 'space-gray', name: '深空灰', body: '#3c3f46', edge: 'rgba(255,255,255,0.2)' },
      { key: 'silver', name: '银色', body: '#e6e8ec', edge: 'rgba(0,0,0,0.14)' },
    ],
    defaultColor: 'space-gray',
  },
  {
    id: 'bare',
    name: '裸屏圆角',
    hint: '无边框，仅保留屏幕圆角与投影',
    aspect: 9 / 19.5,
    bezelX: 0,
    bezelTop: 0,
    bezelBottom: 0,
    screenRadius: 0.14,
    bodyRadius: 0.14,
    notch: null,
    colors: [{ key: 'black', name: '黑色', body: '#17181c', edge: 'rgba(255,255,255,0.16)' }],
    defaultColor: 'black',
  },
]

export function getFrame(id: string): FrameStyle {
  const frame = FRAMES.find((f) => f.id === id)
  if (!frame) throw new Error(`未知的边框样式: ${id}`)
  return frame
}
