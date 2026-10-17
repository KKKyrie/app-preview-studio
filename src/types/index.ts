/** 画布方向 */
export type Orientation = 'portrait' | 'landscape'

/** 设备组 */
export type SizeGroup = 'iphone' | 'ipad'

/** 画布坐标系下的像素矩形 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

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

/**
 * 文本配置。
 *
 * 字号存**占 `designWidth` 的比率**，切换尺寸后等比缩放：
 *   截图模式 designWidth = 画布宽度（画布本身就是排版容器）
 *   创意素材 designWidth = **安全区宽度**（安全区才是排版容器）
 * 见 `SharedAssetStore.designWidth` 与 docs §12。
 */
export interface TextSpec {
  text: string
  /** 字号 = designWidth × size，如 0.072（截图）/ 0.08（创意素材） */
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
  /** logo 高度 = designWidth × logoSize */
  logoSize: number
  /** logo 圆角（占 logo 盒子的比例：0 = 直角，0.5 = 圆形，0.22 ≈ iOS 图标） */
  logoRadius: number
  /** 品牌名字号 = designWidth × nameSize */
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

/** 创意素材条目：一个「变体」的全部配置 */
export interface CreativeItem {
  id: string
  /** 主体图 dataURL；null = 纯品牌排版（Apple 允许，不强制要求图片） */
  image: string | null
  imageName: string | null
  bannerLayoutId: string
  themeId: string
  headline: TextSpec
  subtitle: TextSpec
  /** 版式参数（相对安全区的比率） */
  params: Record<string, number>
  /** 主体图圆角（px，随画布尺寸缩放后回传，故存比率） */
  imageRadius: number
  themeOverrides: Partial<ThemeTokens>
}

/**
 * 图片裁剪条目：一张**已经画好的成品图** + 它的构图。
 *
 * 与截图 / 创意素材条目刻意不共用任何字段——本工作台不做设计，只做裁剪：
 * 没有文案、主题、品牌，也不该诱导用户去改这些。
 *
 * 构图存**相对量**而不是像素（理由见 utils/cropGeometry.ts）：
 *   zoom   = 相对「刚好铺满画框」的倍数，≥ 1
 *   offset = 归一化到多余空间的比例，-1 贴左上 / 0 居中 / +1 贴右下
 * 换尺寸时用户的构图意图得以保留，不需要重新调。
 */
export interface CropItem {
  id: string
  /** 源图 dataURL；null = 空位（等待导入） */
  image: string | null
  imageName: string | null
  /** 源图像素宽高；0 = 还没导入 */
  width: number
  height: number
  /** 相对「刚好铺满画框」的缩放倍数，≥ 1 */
  zoom: number
  /** 归一化偏移，两个轴各自 ∈ [-1, 1] */
  offset: { x: number; y: number }
}

/**
 * 「项目」面板依赖的最小能力。
 *
 * 三个工作台的 store 都满足它：截图 / 创意素材是完整的 `SharedAssetStore`
 * （含品牌），图片裁剪没有品牌与文案，只实现这一层即可复用同一份项目面板。
 */
export interface ProjectStoreLike {
  projectName: string
  items: { id: string }[]
  /** localStorage 持久化 key（三个工作台完全隔离） */
  storageKey: string
  /** 品牌 logo 在 IndexedDB 中的 key；无品牌的工作台为 null */
  brandKey: string | null
  snapshot(opts: { withImages: boolean }): unknown
  hydrate(raw: unknown): boolean
}

/**
 * 两种素材（截图 / 创意素材）共用的条目字段子集。
 * 共享面板（主题 / 文案 / 品牌 / 素材 / 项目）只依赖这一层，
 * 因此同一份组件实现可以在两种工作台下复用。
 */
export interface SharedAssetItem {
  id: string
  image: string | null
  imageName: string | null
  themeId: string
  themeOverrides: Partial<ThemeTokens>
  headline: TextSpec
  subtitle: TextSpec
}

/** 共享面板依赖的 store 能力（两种 store 都结构化满足） */
export interface SharedAssetStore extends ProjectStoreLike {
  brand: BrandSpec
  items: SharedAssetItem[]
  activeItem: SharedAssetItem
  canvasSize: { width: number; height: number }
  /**
   * 排版基准宽度：字号 / 行距 / logo 尺寸都以它为比例基数。
   *
   * 截图模式 = 画布宽度（画布本身就是排版容器）；
   * 创意素材 = **安全区宽度**（安全区才是排版容器，且它在各尺寸间
   * 占画布 26.7%~56.5%，若按画布宽度定字号，通用素材上每行只剩 7 个字）。
   *
   * 面板上的 px 读数必须用这个，否则显示的数字与画布实际渲染对不上。
   */
  designWidth: number
  patchActive(partial: Partial<SharedAssetItem>): void
  patchBrand(partial: Partial<BrandSpec>): void
  patchText(key: 'headline' | 'subtitle', partial: Partial<TextSpec>): void
  setTheme(id: string): void
  /** 品牌 logo 在 IndexedDB 中的 key */
  brandKey: string
  /** 文案字段的展示名，供合规检查使用 */
  itemLabel(index: number): string
}

/** 安全区检查命中的一个元素 */
export interface SafeAreaViolation {
  /** 元素标识，对应画布上的 data-role */
  role: 'brand' | 'headline' | 'subtitle' | 'image'
  label: string
  /** 超出安全区的像素数（>0），以及方向 */
  over: { top: number; right: number; bottom: number; left: number }
  /** 超出总量（用于排序） */
  worst: number
}
