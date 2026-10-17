import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { DEFAULT_SIZE_ID, getSize, SIZES } from '@/constants/sizes'
import { FRAMES } from '@/data/frames'
import { LAYOUTS } from '@/data/layouts'
import { THEMES } from '@/data/themes'
import { DEFAULT_FONT_ID, getFont } from '@/data/fonts'
import type { BrandSpec, CanvasItem, Orientation, ScreenshotSize, TextSpec } from '@/types'

export const MAX_ITEMS = 10

export const STORAGE_KEY = 'app-preview-studio.project.v1'
/** 品牌 logo 在 IndexedDB 中的 key（项目级，不随条目） */
const BRAND_KEY = '__brand__'

/** 项目快照（localStorage 配置 / 项目 JSON 共用结构） */
export interface ProjectSnapshot {
  /**
   * 快照版本。**改变任何比率的语义时必须 +1 并写迁移**（只加字段不用），
   * 否则旧存档会被静默按新语义解释 —— 打开时排版全变，用户没有任何线索。
   *
   * ⚠️ 与 localStorage key 结尾的 `.v1` 无关：那是 key 的历史命名，不能改
   * （改了用户已有项目就丢了）。
   */
  version: number
  projectName: string
  sizeId: string
  orientation: Orientation
  activeItemId: string
  brand: BrandSpec
  items: CanvasItem[]
}

export const PROJECT_SNAPSHOT_VERSION = 1

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** 品牌默认值（logo 高度 / 名字字号均为画布宽度比例） */
export function defaultBrand(): BrandSpec {
  return { logo: null, name: '', logoSize: 0.05, logoRadius: 0, nameSize: 0.042 }
}

/** 容错导入的品牌数据 */
function normalizeBrand(raw: Partial<BrandSpec> | null | undefined): BrandSpec {
  const base = defaultBrand()
  const b = raw ?? {}
  return {
    logo: typeof b.logo === 'string' ? b.logo : null,
    name: typeof b.name === 'string' ? b.name : '',
    logoSize: typeof b.logoSize === 'number' ? Math.min(0.15, Math.max(0.01, b.logoSize)) : base.logoSize,
    logoRadius: typeof b.logoRadius === 'number' ? Math.min(0.5, Math.max(0, b.logoRadius)) : base.logoRadius,
    nameSize: typeof b.nameSize === 'number' ? Math.min(0.1, Math.max(0.01, b.nameSize)) : base.nameSize,
  }
}

export function createItem(): CanvasItem {
  const layout = LAYOUTS[0]
  const frame = FRAMES[0]
  const theme = THEMES[0]
  return {
    id: uid(),
    image: null,
    imageName: null,
    layoutId: layout.id,
    frameId: frame.id,
    themeId: theme.id,
    headline: {
      text: '让效率翻倍的\n任务管理体验',
      size: 0.072,
      weight: 800,
      color: '',
      font: DEFAULT_FONT_ID,
    },
    subtitle: {
      text: '简洁、快速、值得信赖 —— 三步上手',
      size: 0.034,
      weight: 500,
      color: '',
      font: DEFAULT_FONT_ID,
    },
    params: { ...layout.defaults },
    frame: {
      color: frame.defaultColor,
      shadow: true,
      tilt: 0,
      statusBar: false,
    },
    themeOverrides: {},
  }
}

/** 用默认值兜底，容错导入的不完整数据 */
function normalizeItem(raw: Partial<CanvasItem> | null | undefined): CanvasItem {
  const base = createItem()
  const item = raw ?? {}
  const fontOf = (raw: unknown) =>
    // 未知 id（旧项目 / 手改 JSON）由 getFont 回退系统默认，避免渲染成空字体
    getFont(typeof raw === 'string' ? raw : DEFAULT_FONT_ID).id
  return {
    ...base,
    ...item,
    id: typeof item.id === 'string' && item.id ? item.id : base.id,
    headline: { ...base.headline, ...item.headline, font: fontOf(item.headline?.font) },
    subtitle: { ...base.subtitle, ...item.subtitle, font: fontOf(item.subtitle?.font) },
    params: { ...item.params },
    frame: { ...base.frame, ...(item.frame ?? {}) },
    themeOverrides: { ...(item.themeOverrides ?? {}) },
    image: typeof item.image === 'string' ? item.image : null,
    imageName: typeof item.imageName === 'string' ? item.imageName : null,
  }
}

function cloneItem(base: CanvasItem, withImage: boolean): CanvasItem {
  const copy = JSON.parse(
    JSON.stringify({ ...base, id: undefined, image: null }),
  ) as Omit<CanvasItem, 'id' | 'image'> & { id?: undefined; image: null }
  return {
    ...copy,
    id: uid(),
    image: withImage ? base.image : null,
    imageName: withImage ? base.imageName : null,
  }
}

export const useProjectStore = defineStore('project', () => {
  const projectName = ref('未命名项目')
  const sizeId = ref(DEFAULT_SIZE_ID)
  const orientation = ref<Orientation>('portrait')
  const brand = ref<BrandSpec>(defaultBrand())
  const items = ref<CanvasItem[]>([createItem()])
  const activeItemId = ref(items.value[0].id)

  const activeItem = computed(
    () => items.value.find((i) => i.id === activeItemId.value) ?? items.value[0],
  )
  const size = computed<ScreenshotSize>(() => getSize(sizeId.value))
  const canvasSize = computed(() => {
    const s = size.value
    return orientation.value === 'portrait'
      ? { width: s.width, height: s.height }
      : { width: s.height, height: s.width }
  })

  /**
   * 截图模式的排版基准 = 画布宽度。
   *
   * 截图画布本身就是排版容器（Apple 要求截图满画布展示），所以沿用画布宽度；
   * 创意素材则改用安全区宽度，见 stores/creative.ts。
   */
  const designWidth = computed(() => canvasSize.value.width)

  /* ── 选择与编辑 ── */

  function select(id: string) {
    if (items.value.some((i) => i.id === id)) activeItemId.value = id
  }

  function patchActive(partial: Partial<CanvasItem>) {
    const item = activeItem.value
    if (!item) return
    Object.assign(item, partial)
  }

  function patchText(key: 'headline' | 'subtitle', partial: Partial<TextSpec>) {
    const item = activeItem.value
    if (!item) return
    Object.assign(item[key], partial)
  }

  function setParam(key: string, value: number) {
    const item = activeItem.value
    if (!item) return
    item.params[key] = value
  }

  /** 切换布局时：只保留新布局声明的参数，并钳制到字段合法范围 */
  function setLayout(id: string) {
    const layout = LAYOUTS.find((l) => l.id === id)
    const item = activeItem.value
    if (!layout || !item) return
    item.layoutId = id
    item.params = Object.fromEntries(
      layout.fields.map((f) => {
        const raw = item.params[f.key] ?? layout.defaults[f.key]
        return [f.key, Math.min(f.max, Math.max(f.min, raw))]
      }),
    )
  }

  function setFrame(id: string) {
    const frame = FRAMES.find((f) => f.id === id)
    const item = activeItem.value
    if (!frame || !item) return
    item.frameId = id
    if (!frame.colors.some((c) => c.key === item.frame.color)) {
      item.frame.color = frame.defaultColor
    }
  }

  function setTheme(id: string) {
    const item = activeItem.value
    if (!item) return
    item.themeId = id
    item.themeOverrides = {}
  }

  /* ── 截图组管理 ── */

  /** 新增一张：沿用当前样式、清空图片 */
  function addScreenshot(): boolean {
    if (items.value.length >= MAX_ITEMS) return false
    const base = activeItem.value
    const item = base ? cloneItem(base, false) : createItem()
    items.value.push(item)
    activeItemId.value = item.id
    return true
  }

  /** 复制一张（含图片） */
  function duplicateItem(id: string): boolean {
    if (items.value.length >= MAX_ITEMS) return false
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx < 0) return false
    const copy = cloneItem(items.value[idx], true)
    items.value.splice(idx + 1, 0, copy)
    activeItemId.value = copy.id
    return true
  }

  /** 删除一张（至少保留一张） */
  function removeItem(id: string): boolean {
    if (items.value.length <= 1) return false
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx < 0) return false
    items.value.splice(idx, 1)
    if (activeItemId.value === id) {
      activeItemId.value = items.value[Math.min(idx, items.value.length - 1)].id
    }
    return true
  }

  /* ── 品牌（logo + 名字，项目级） ── */

  function patchBrand(partial: Partial<BrandSpec>) {
    Object.assign(brand.value, partial)
  }

  /* ── 快照与恢复 ── */

  function snapshot(opts: { withImages: boolean }): ProjectSnapshot {
    return {
      version: PROJECT_SNAPSHOT_VERSION,
      projectName: projectName.value,
      sizeId: sizeId.value,
      orientation: orientation.value,
      activeItemId: activeItemId.value,
      // logo dataURL 与截图同规则：localStorage 不存图，项目 JSON（withImages）才带
      brand: { ...brand.value, logo: opts.withImages ? brand.value.logo : null },
      items: items.value.map((i) => ({
        ...i,
        image: opts.withImages ? i.image : null,
      })),
    }
  }

  function hydrate(raw: unknown): boolean {
    try {
      const s = raw as Partial<ProjectSnapshot> | null
      if (!s || !Array.isArray(s.items) || s.items.length === 0) return false
      if (typeof s.projectName === 'string' && s.projectName) projectName.value = s.projectName
      if (typeof s.sizeId === 'string' && SIZES.some((x) => x.id === s.sizeId)) {
        sizeId.value = s.sizeId
      }
      orientation.value = s.orientation === 'landscape' ? 'landscape' : 'portrait'
      brand.value = normalizeBrand(s.brand)
      items.value = s.items.map((i) => normalizeItem(i)).slice(0, MAX_ITEMS)
      activeItemId.value =
        typeof s.activeItemId === 'string' && items.value.some((i) => i.id === s.activeItemId)
          ? s.activeItemId
          : items.value[0].id
      return true
    } catch (e) {
      console.warn('[persistence] 恢复项目失败', e)
      return false
    }
  }

  /** 供共享面板做本地化文案用 */
  function itemLabel(index: number): string {
    return `截图 ${index + 1}`
  }

  return {
    projectName,
    sizeId,
    orientation,
    brand,
    items,
    activeItemId,
    activeItem,
    size,
    canvasSize,
    designWidth,
    snapshotVersion: PROJECT_SNAPSHOT_VERSION,
    select,
    patchActive,
    patchText,
    patchBrand,
    setParam,
    setLayout,
    setFrame,
    setTheme,
    addScreenshot,
    duplicateItem,
    removeItem,
    snapshot,
    hydrate,
    createItem,
    itemLabel,
    storageKey: STORAGE_KEY,
    brandKey: BRAND_KEY,
  }
})
