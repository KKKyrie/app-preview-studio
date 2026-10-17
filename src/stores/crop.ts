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
import type { CropItem } from '@/types'
import {
  CROP_ZOOM_STEP,
  MAX_CROP_ZOOM,
  clampCrop,
  cropSlack,
  isCropLocked,
  nudgeOffset,
  resolveCropBox,
  usedSourceWidth,
} from '@/utils/cropGeometry'

/**
 * 单次导入上限。
 *
 * 与截图 / 创意素材的 12 个条目同量级：每个条目都要单独调构图，再多的列表
 * 已经不适合逐个调了，反而会让「一键全部尺寸」变成一次几十张的长任务。
 */
export const MAX_CROP_ITEMS = 12

export const CROP_STORAGE_KEY = 'app-preview-studio.crop.v1'

export type CropImportResult = 'filled' | 'appended' | 'full'

export interface CropSnapshot {
  /**
   * 快照版本。**改变构图语义（如 zoom 的含义）时必须 +1 并写迁移**，
   * 否则旧存档的构图会被静默按新语义解释。只加字段不用 +1。
   */
  version: number
  projectName: string
  placementId: PlacementId
  /** `宽x高` 字符串 */
  canvasId: string
  activeItemId: string
  items: CropItem[]
}

export const CROP_SNAPSHOT_VERSION = 1

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function createItem(): CropItem {
  return {
    id: uid(),
    image: null,
    imageName: null,
    width: 0,
    height: 0,
    zoom: 1,
    offset: { x: 0, y: 0 },
  }
}

function normalizeItem(raw: Partial<CropItem> | null | undefined): CropItem {
  const base = createItem()
  const item = raw ?? {}
  const width = typeof item.width === 'number' && item.width > 0 ? item.width : 0
  const height = typeof item.height === 'number' && item.height > 0 ? item.height : 0
  const image = typeof item.image === 'string' ? item.image : null
  const t = clampCrop({
    zoom: typeof item.zoom === 'number' ? item.zoom : 1,
    offset: {
      x: typeof item.offset?.x === 'number' ? item.offset.x : 0,
      y: typeof item.offset?.y === 'number' ? item.offset.y : 0,
    },
  })
  return {
    id: typeof item.id === 'string' && item.id ? item.id : base.id,
    image,
    imageName: typeof item.imageName === 'string' ? item.imageName : null,
    // 有图却没有尺寸（手改 JSON）时按 1:1 兜底，等比缩放至少不会算出 0 宽
    width: image && !width ? 1 : width,
    height: image && !height ? 1 : height,
    zoom: t.zoom,
    offset: t.offset,
  }
}

/**
 * 图片裁剪工作台的 store。
 *
 * 与截图 / 创意素材**完全隔离**（独立 localStorage key，且没有品牌图片），
 * 因为它做的事本质上不同：那两个工作台是「做设计」，这个只是「按官方比例裁
 * 一张已经画好的图」。隔离意味着它不需要文案 / 主题 / 品牌的任何字段——
 * 面板里不该出现诱导用户去改那些的入口。
 */
export const useCropStore = defineStore('crop', () => {
  const projectName = ref('未命名裁剪')
  const placementId = ref<PlacementId>(DEFAULT_PLACEMENT_ID)
  const canvasId = ref(DEFAULT_CANVAS_ID)
  const items = ref<CropItem[]>([createItem()])
  const activeItemId = ref(items.value[0].id)

  /** 安全区叠加层开关（仅影响预览，不参与导出） */
  const showSafeArea = ref(true)

  const activeItem = computed(
    () => items.value.find((i) => i.id === activeItemId.value) ?? items.value[0],
  )

  const placement = computed<Placement>(() => getPlacement(placementId.value))

  const canvas = computed<CanvasOption>(() => resolveCanvasOption(placement.value, canvasId.value))

  const canvasSize = computed(() => ({ width: canvas.value.width, height: canvas.value.height }))

  /** 安全区是**每个画布尺寸各自**的实测值，直接取登记值，不按坑位缩放 */
  const safeArea = computed(() => canvas.value.safeArea)

  /** 源图在画框坐标系里的绘制矩形；null = 还没导入图片 */
  const cropBox = computed(() => {
    const it = activeItem.value
    if (!it?.image || it.width <= 0 || it.height <= 0) return null
    return resolveCropBox(canvasSize.value.width, canvasSize.value.height, it.width, it.height, {
      zoom: it.zoom,
      offset: it.offset,
    })
  })

  /** 两个轴各自可拖动的余量（画框坐标系 px） */
  const slack = computed(() => {
    const it = activeItem.value
    if (!it?.width || !it.height) return { x: 0, y: 0 }
    return cropSlack(canvasSize.value.width, canvasSize.value.height, it.width, it.height, it.zoom)
  })

  /** 源图完全铺满且无余量可调（拖动不会有任何变化） */
  const cropLocked = computed(() => {
    const it = activeItem.value
    if (!it?.image) return true
    return isCropLocked(canvasSize.value.width, canvasSize.value.height, it.width, it.height, it.zoom)
  })

  const atMaxZoom = computed(() => (activeItem.value?.zoom ?? 1) >= MAX_CROP_ZOOM - 1e-6)

  const isDefaultCrop = computed(() => {
    const it = activeItem.value
    if (!it) return true
    return Math.abs(it.zoom - 1) < 1e-6 && Math.abs(it.offset.x) < 1e-6 && Math.abs(it.offset.y) < 1e-6
  })

  /**
   * 成品画质：该构图实际用到的源图像素宽度 ÷ 画框宽度。
   * ≥ 1 = 源图分辨率够用；< 1 = 会被放大，成品变糊（App Store 会以画质驳回）。
   */
  const sourceCoverage = computed(() => {
    const it = activeItem.value
    const box = cropBox.value
    if (!it?.image || !box || box.width <= 0) return null
    return usedSourceWidth(canvasSize.value.width, it.width, box.width) / canvasSize.value.width
  })

  /* ── 列表管理 ── */

  function select(id: string) {
    if (items.value.some((i) => i.id === id)) activeItemId.value = id
  }

  function patchActive(partial: Partial<CropItem>) {
    const item = activeItem.value
    if (!item) return
    Object.assign(item, partial)
  }

  /**
   * 导入一张图片：**当前空位优先，其次第一个空位，否则追加**。
   *
   * 「当前空位优先」是为了让「清空图片 → 导入」填回同一行：用户点中第 3 行、
   * 清空它、再导入，新图必须落在第 3 行 —— 若按「第一个空位」抓，新图会跳到
   * 第 1 个空位，行序一乱用户就会以为换图没生效。
   *
   * 列表初始就有一个空位且它就是激活项，所以首次导入仍然填那个空位、
   * 不会凭空多出一条。
   */
  function importImage(
    image: string,
    imageName: string,
    width: number,
    height: number,
  ): CropImportResult {
    const active = activeItem.value
    const target = active && !active.image ? active : items.value.find((i) => !i.image)
    if (target) {
      Object.assign(target, {
        image,
        imageName,
        width,
        height,
        zoom: 1,
        offset: { x: 0, y: 0 },
      })
      activeItemId.value = target.id
      return 'filled'
    }
    if (items.value.length >= MAX_CROP_ITEMS) return 'full'
    const item: CropItem = {
      ...createItem(),
      image,
      imageName,
      width,
      height,
    }
    items.value.push(item)
    activeItemId.value = item.id
    return 'appended'
  }

  function addEmpty(): boolean {
    if (items.value.length >= MAX_CROP_ITEMS) return false
    const item = createItem()
    items.value.push(item)
    activeItemId.value = item.id
    return true
  }

  /**
   * 移除条目，**允许删到一条不剩**。
   *
   * 早先这里挡着 `length <= 1`，理由是「列表为空时无处可拖入图片」——
   * 理由不成立：拖拽 / 粘贴是 window 级监听，面板的「导入图片」按钮也始终在，
   * 空列表反而是最自然的初始状态。真实后果是**唯一一张图删不掉**：
   * 按钮置灰、没有任何解释，用户只能判定为 bug。
   *
   * 0 条是合法状态：画布画空画框 + 空状态提示，面板给出导入入口。
   */
  function removeItem(id: string): boolean {
    const idx = items.value.findIndex((i) => i.id === id)
    if (idx < 0) return false
    items.value.splice(idx, 1)
    if (activeItemId.value === id) {
      activeItemId.value = items.value[Math.min(idx, items.value.length - 1)]?.id ?? ''
    }
    return true
  }

  /**
   * 只清掉图片，条目回到空位状态。
   *
   * 与 `removeItem` 的区别是**保留这一行的位置**：清空之后导入会填回这一行
   * （见 `importImage` 的「当前空位优先」），因此「清空图片 → 导入」等价于
   * 「换一张」，行序不变。
   */
  function clearItem(id: string) {
    const item = items.value.find((i) => i.id === id)
    if (!item) return
    Object.assign(item, { image: null, imageName: null, width: 0, height: 0, zoom: 1, offset: { x: 0, y: 0 } })
  }

  /* ── 构图 ── */

  /** 设置缩放倍数（相对「刚好铺满」），并夹紧偏移 */
  function setZoom(zoom: number) {
    const item = activeItem.value
    if (!item) return
    const t = clampCrop({ zoom, offset: item.offset })
    item.zoom = t.zoom
    item.offset = t.offset
  }

  const zoomCropIn = () => setZoom((activeItem.value?.zoom ?? 1) * CROP_ZOOM_STEP)
  const zoomCropOut = () => setZoom((activeItem.value?.zoom ?? 1) / CROP_ZOOM_STEP)

  /** 按画框坐标系位移拖拽源图（dx / dy 为正表示向右 / 向下拖） */
  function nudge(dx: number, dy: number) {
    const item = activeItem.value
    if (!item?.image) return
    item.offset = nudgeOffset(
      canvasSize.value.width,
      canvasSize.value.height,
      item.width,
      item.height,
      { zoom: item.zoom, offset: item.offset },
      dx,
      dy,
    )
  }

  /** 单轴精确调节（面板滑杆用） */
  function setAxis(axis: 'x' | 'y', value: number) {
    const item = activeItem.value
    if (!item) return
    const t = clampCrop({ zoom: item.zoom, offset: { ...item.offset, [axis]: value } })
    item.offset = t.offset
  }

  function centerCrop() {
    const item = activeItem.value
    if (!item) return
    item.offset = { x: 0, y: 0 }
  }

  /** 回到「刚好铺满 + 居中」 */
  function resetCrop() {
    const item = activeItem.value
    if (!item) return
    item.zoom = 1
    item.offset = { x: 0, y: 0 }
  }

  /* ── 坑位（项目级） ── */

  function setPlacement(id: PlacementId) {
    const next = getPlacement(id)
    placementId.value = next.id
    canvasId.value = `${next.canvasOptions[0].width}x${next.canvasOptions[0].height}`
  }

  function setCanvas(option: CanvasOption) {
    canvasId.value = `${option.width}x${option.height}`
  }

  /* ── 快照与恢复 ── */

  function snapshot(opts: { withImages: boolean }): CropSnapshot {
    return {
      version: CROP_SNAPSHOT_VERSION,
      projectName: projectName.value,
      placementId: placementId.value,
      canvasId: canvasId.value,
      activeItemId: activeItemId.value,
      items: items.value.map((i) => ({ ...i, image: opts.withImages ? i.image : null })),
    }
  }

  function hydrate(raw: unknown): boolean {
    try {
      const s = raw as Partial<CropSnapshot> | null
      // 空列表是合法存档（用户把图删光了），必须原样恢复 —— 否则「删光后
      // 刷新又冒出一张空位」，用户会以为删除没生效。
      if (!s || !Array.isArray(s.items)) return false
      if (typeof s.projectName === 'string' && s.projectName) projectName.value = s.projectName
      placementId.value =
        typeof s.placementId === 'string' ? getPlacement(s.placementId).id : DEFAULT_PLACEMENT_ID
      canvasId.value = typeof s.canvasId === 'string' ? s.canvasId : DEFAULT_CANVAS_ID
      items.value = s.items.map((i) => normalizeItem(i)).slice(0, MAX_CROP_ITEMS)
      activeItemId.value =
        typeof s.activeItemId === 'string' && items.value.some((i) => i.id === s.activeItemId)
          ? s.activeItemId
          : (items.value[0]?.id ?? '')
      return true
    } catch (e) {
      console.warn('[persistence] 恢复图片裁剪项目失败', e)
      return false
    }
  }

  /** 供共享面板做本地化文案用 */
  function itemLabel(index: number): string {
    return `图片 ${index + 1}`
  }

  return {
    projectName,
    placementId,
    canvasId,
    items,
    activeItemId,
    activeItem,
    placement,
    canvas,
    canvasSize,
    safeArea,
    showSafeArea,
    snapshotVersion: CROP_SNAPSHOT_VERSION,
    cropBox,
    slack,
    cropLocked,
    atMaxZoom,
    isDefaultCrop,
    sourceCoverage,
    select,
    patchActive,
    importImage,
    addEmpty,
    removeItem,
    clearItem,
    setZoom,
    zoomCropIn,
    zoomCropOut,
    nudge,
    setAxis,
    centerCrop,
    resetCrop,
    setPlacement,
    setCanvas,
    snapshot,
    hydrate,
    itemLabel,
    storageKey: CROP_STORAGE_KEY,
    // 图片裁剪没有品牌图片，持久化层据此跳过品牌回填
    brandKey: null,
  }
})
