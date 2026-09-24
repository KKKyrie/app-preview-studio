/** 画布方向 */
export type Orientation = 'portrait' | 'landscape'

/** 设备组 */
export type SizeGroup = 'iphone' | 'ipad'

/** App Store Connect 接受的一个截图上传尺寸（竖屏基准，横屏由方向开关交换宽高） */
export interface ScreenshotSize {
  /** 唯一 id，如 `iphone-6.5-1284x2778` */
  id: string
  group: SizeGroup
  /** 显示档位，如 `6.5"` */
  display: string
  /** 竖屏宽度（px） */
  width: number
  /** 竖屏高度（px） */
  height: number
  /** 该档位适用机型（简写） */
  devices: string
}

/** 文本配置；字号用「画布宽度比例」存储，切换尺寸后等比缩放 */
export interface TextSpec {
  text: string
  /** 字号 = 画布宽度 × size，如 0.072 */
  size: number
  weight: number
  /** 空字符串表示跟随主题色 */
  color: string
  /** 字体 id（见 src/data/fonts.ts），主/副标题各自独立 */
  font: string
}

/** 品牌信息：logo + 名字，展示在主标题上方（项目级，全部截图共用） */
export interface BrandSpec {
  /** logo 图 dataURL；null = 未上传 */
  logo: string | null
  /** 品牌名（展示在 logo 右侧 / 主标题上方） */
  name: string
  /** logo 高度 = 画布宽度 × logoSize */
  logoSize: number
  /** logo 圆角（占 logo 盒子的比例：0 = 直角，0.5 = 圆形，0.22 ≈ iOS 图标） */
  logoRadius: number
  /** 品牌名字号 = 画布宽度 × nameSize */
  nameSize: number
}

/** 手机边框的可调选项 */
export interface FrameOptions {
  /** 机身材质配色 key（对应 FrameStyle.colors[].key） */
  color: string
  /** 是否显示投影 */
  shadow: boolean
  /** 倾斜角度（deg） */
  tilt: number
  /** 是否绘制状态栏（时间 + 信号等） */
  statusBar: boolean
}

/** 主题可覆盖的 token */
export interface ThemeTokens {
  /** CSS background，必须为不透明（Apple 不接受透明 PNG） */
  background: string
  headline: string
  subtitle: string
  accent: string
  /** 手机投影（box-shadow 值） */
  phoneShadow: string
}

/** 画布条目：一张预览图的全部配置 */
export interface CanvasItem {
  id: string
  /** 用户上传的 App 截图 dataURL */
  image: string | null
  imageName: string | null
  layoutId: string
  frameId: string
  themeId: string
  headline: TextSpec
  subtitle: TextSpec
  /** 布局参数（比率），以布局 defaults 为基准合并 */
  params: Record<string, number>
  frame: FrameOptions
  /** 主题 token 覆盖（空串/undefined = 跟随主题） */
  themeOverrides: Partial<ThemeTokens>
}
