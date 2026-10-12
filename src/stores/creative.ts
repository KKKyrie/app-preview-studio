import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import {
  DEFAULT_CANVAS_ID,
  DEFAULT_PLACEMENT_ID,
  getPlacement,
  resolveCanvasOption,
  type CanvasOption,
  type Placement,
  type PlacementId,
} from '@/constants/placements'
import { BANNER_LAYOUTS } from '@/data/bannerLayouts'
import { DEFAULT_FONT_ID, getFont } from '@/data/fonts'
import { THEMES } from '@/data/themes'
import type { BrandSpec, CreativeItem, ThemeTokens } from '@/types'

/** 变体上限：呼应 Asset Library —— 预先备好多套素材，上线时直接替换，无需重新提审 */
export const MAX_VARIANTS = 12

export const CREATIVE_STORAGE_KEY = 'app-preview-studio.creative.v1'
const CREATIVE_BRAND_KEY = '__creative_brand__'

export interface CreativeSnapshot {
  version: 1
  projectName: string
  placementId: PlacementId
  /** `宽x高` 字符串 */
  canvasId: string
  activeItemId: string
  brand: BrandSpec
  items: CreativeItem[]
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * 创意素材的品牌默认值比截图模式小一档：logo 0.028 × 3840 ≈ 108px，
 * 在 661px 高的页头安全区里约占 16%，与主标题比例协调。
 */
export function defaultBrand(): BrandSpec {
  return { logo: null, name: '', logoSize: 0.028, logoRadius: 0, nameSize: 0.02 }
}

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

/**
 * 创意素材的字号默认值明显小于截图模式。
 *
 * 页头安全区只有 1646×661 px：按截图模式的默认值（主标题 0.072）会得到
 * 276px 的字号，一行仅放得下约 5 个汉字，必然撑爆安全区。
 * 这里按「品牌 + 主标题 + 副标题 ≈ 419px 高」调参，在 661px 安全区内留有余量。
 * 字号仍以画布宽度比例存储，因此切到通用素材(5244 宽)时屏幕上视觉大小不变。
 */
function createItem(): CreativeItem {
  const layout = BANNER_LAYOUTS[0]
  return {
    id: uid(),
    image: null,
    imageName: null,
    bannerLayoutId: layout.id,
    themeId: THEMES[0].id,
    headline: {
      text: '发现新的可能',
      size: 0.034,
      weight: 800,
      color: '',
      font: DEFAULT_FONT_ID,
    },
    subtitle: {
      text: '',
      size: 0.015,
      weight: 500,
      color: '',
      font: DEFAULT_FONT_ID,
    },
    params: { ...layout.defaults },
    imageRadius: 0.04,
    themeOverrides: {},
  }
}

function normalizeItem(raw: Partial<CreativeItem> | null | undefined): CreativeItem {
  const base = createItem()
  const item = raw ?? {}
  const fontOf = (v: unknown) =>
    getFont(typeof v === 'string' ? v : DEFAULT_FONT_ID).id
  const params: Record<string, number> = {}
  for (const [k, v] of Object.entries(item.params ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) params[k] = v
  }
  return {
    ...base,
    ...item,
    id: typeof item.id === 'string' && item.id ? item.id : base.id,
    headline: { ...base.headline, ...item.headline, font: fontOf(item.headline?.font) },
    subtitle: { ...base.subtitle, ...item.subtitle, font: fontOf(item.subtitle?.font) },
    params,
    themeOverrides: { ...(item.themeOverrides ?? {}) },
    image: typeof item.image === 'string' ? item.image : null,
    imageName: typeof item.imageName === 'string' ? item.imageName : null,
    imageRadius: typeof item.imageRadius === 'number' ? item.imageRadius : base.imageRadius,
  }
}

function cloneItem(base: CreativeItem, withImage: boolean): CreativeItem {
  const copy = JSON.parse(JSON.stringify({ ...base, id: undefined, image: null })) as Omit<
    CreativeItem,
    'id' | 'image'
  > & { id?: undefined; image: null }
  return {
    ...copy,
    id: uid(),
    image: withImage ? base.image : null,
    imageName: withImage ? base.imageName : null,
  }
}

export const useCreativeStore = defineStore('creative', () => {
  const projectName = ref('未命名素材')
  const placementId = ref<PlacementId>(DEFAULT_PLACEMENT_ID)
  const canvasId = ref(DEFAULT_CANVAS_ID)
  const brand = ref<BrandSpec>(defaultBrand())
  const items = ref<CreativeItem[]>([createItem()])
  const activeItemId = ref(items.value[0].id)

  /** 安全区叠加层开关（仅影响预览，不参与导出） */
  const showSafeArea = ref(true)
  /** 是否把主体图也纳入安全区检查（默认否：出血是设计意图） */
  const checkImage = ref(false)

  const activeItem = computed(
    () => items.value.find((i) => i.id === activeItemId.value) ?? items.value[0],
  )

  const placement = computed<Placement>(() => getPlacement(placementId.value))

  const canvas = computed<CanvasOption>(() =>
    resolveCanvasOption(placement.value, canvasId.value),
  )

  const canvasSize = computed(() => ({
    width: canvas.value.width,
    height: canvas.value.height,
  }))

  /**
   * 安全区直接取当前尺寸的登记值。
   *
   * 不再按坑位缩放——因为安全区是**每个画布尺寸各自**的（Apple 模板给了
   * 3840×1646 / 3840×2560 / 5244×2950 三张画板各自的实测值），而不是
   * 「坑位有唯一安全区、换个尺寸等比缩放」。
   */
  const safeArea = computed(() => canvas.value.safeArea)

  /* ── 选择与编辑 ── */

  function select(id: string) {
    if (items.value.some((i) => i.id === id)) activeItemId.value = id
  }

  function patchActive(partial: Partial<CreativeItem>) {
    const item = activeItem.value
    if (!item) return
    Object.assign(item, partial)
  }

  function patchText(key: 'headline' | 'subtitle', partial: Partial<CreativeItem['headline']>) {
    const item = activeItem.value
    if (!item) return
    Object.assign(item[key], partial)
  }

  function patchBrand(partial: Partial<BrandSpec>) {
    Object.assign(brand.value, partial)
  }

  function setParam(key: string, value: number) {
    const item = activeItem.value
    if (!item) return
    item.params[key] = value
  }

  /** 切换版式：只保留新版式声明的参数并钳制到合法范围 */
  function setLayout(id: string) {
    const layout = BANNER_LAYOUTS.find((l) => l.id === id)
    const item = activeItem.value
    if (!layout || !item) return
    item.bannerLayoutId = id
    item.params = Object.fromEntries(
      layout.fields.map((f) => {
        const raw = item.params[f.key] ?? layout.defaults[f.key]
        return [f.key, Math.min(f.max, Math.max(f.min, raw))]
      }),
    )
  }

  function setTheme(id: string) {
    const item = activeItem.value
    if (!item) return
    item.themeId = id
    item.themeOverrides = {}
  }

  function patchThemeOverrides(partial: Partial<ThemeTokens>) {
    const item = activeItem.value
    if (!item) return
    item.themeOverrides = { ...item.themeOverrides, ...partial }
  }

  /* ── 坑位（项目级） ── */

  /**
   * 切换坑位：换画布尺寸，条目内容一律保留。
   *
   * 落到该坑位的首个尺寸（标题图→3840×1646，搜索结果图→3840×2560）。
   *
   * 之所以可以无损切换：字号以「画布宽度比例」存储，3840 宽 → 5244 宽是
   * 1.365 倍，画布显示宽度同为 1.365 倍，屏幕上视觉大小完全不变；
   * 版式参数以**安全区**为基准，同样等比缩放。用户无需重调任何参数。
   */
  function setPlacement(id: PlacementId) {
    const next = getPlacement(id)
    placementId.value = next.id
    canvasId.value = `${next.canvasOptions[0].width}x${next.canvasOptions[0].height}`
  }

  function setCanvas(option: CanvasOption) {
    canvasId.value = `${option.width}x${option.height}`
  }

  /* ── 变体组管理 ── */

  function addVariant(): boolean {
    if (items.value.length >= MAX_VARIANTS) return false
    const base = activeItem.value
    const item = base ? cloneItem(base, false) : createItem()
    items.value.push(item)
    activeItemId.value = item.id
    return true
  }

  function duplicateVariant(id: string): boolean {
    if (items.value.length >= MAX_VARIANTS) return false
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx < 0) return false
    const copy = cloneItem(items.value[idx], true)
    items.value.splice(idx + 1, 0, copy)
    activeItemId.value = copy.id
    return true
  }

  function removeVariant(id: string): boolean {
    if (items.value.length <= 1) return false
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx < 0) return false
    items.value.splice(idx, 1)
    if (activeItemId.value === id) {
      activeItemId.value = items.value[Math.min(idx, items.value.length - 1)].id
    }
    return true
  }

  /* ── 快照与恢复 ── */

  function snapshot(opts: { withImages: boolean }): CreativeSnapshot {
    return {
      version: 1,
      projectName: projectName.value,
      placementId: placementId.value,
      canvasId: canvasId.value,
      activeItemId: activeItemId.value,
      brand: { ...brand.value, logo: opts.withImages ? brand.value.logo : null },
      items: items.value.map((i) => ({ ...i, image: opts.withImages ? i.image : null })),
    }
  }

  function hydrate(raw: unknown): boolean {
    try {
      const s = raw as Partial<CreativeSnapshot> | null
      if (!s || !Array.isArray(s.items) || s.items.length === 0) return false
      if (typeof s.projectName === 'string' && s.projectName) projectName.value = s.projectName
      placementId.value =
        typeof s.placementId === 'string' ? getPlacement(s.placementId).id : DEFAULT_PLACEMENT_ID
      // 旧项目可能带着已下线的「通用素材」坑位 id，getPlacement 会回退到标题图；
      // canvasId 同样用 resolveCanvasOption 容错，手改 JSON 也不会炸。
      canvasId.value = typeof s.canvasId === 'string' ? s.canvasId : DEFAULT_CANVAS_ID
      brand.value = normalizeBrand(s.brand)
      items.value = s.items.map((i) => normalizeItem(i)).slice(0, MAX_VARIANTS)
      activeItemId.value =
        typeof s.activeItemId === 'string' && items.value.some((i) => i.id === s.activeItemId)
          ? s.activeItemId
          : items.value[0].id
      return true
    } catch (e) {
      console.warn('[persistence] 恢复创意素材项目失败', e)
      return false
    }
  }

  /** 供共享面板做本地化文案用 */
  function itemLabel(index: number): string {
    return `变体 ${index + 1}`
  }

  return {
    projectName,
    placementId,
    canvasId,
    brand,
    items,
    activeItemId,
    activeItem,
    placement,
    canvas,
    canvasSize,
    safeArea,
    showSafeArea,
    checkImage,
    select,
    patchActive,
    patchText,
    patchBrand,
    patchThemeOverrides,
    setParam,
    setLayout,
    setTheme,
    setPlacement,
    setCanvas,
    addVariant,
    duplicateVariant,
    removeVariant,
    snapshot,
    hydrate,
    itemLabel,
    storageKey: CREATIVE_STORAGE_KEY,
    brandKey: CREATIVE_BRAND_KEY,
  }
})