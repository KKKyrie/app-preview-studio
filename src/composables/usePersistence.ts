import { watch } from 'vue'

import { useCreativeStore } from '@/stores/creative'
import { useCropStore } from '@/stores/crop'
import { useProjectStore } from '@/stores/project'
import type { BrandSpec } from '@/types'
import { deleteImage, getImage, putImage } from '@/utils/imageStore'

/**
 * 项目持久化（三个工作台各一份，完全隔离）：
 * - 配置（名称 / 尺寸 / 方向 / 条目）→ localStorage（防抖 400ms）
 * - 图片 dataURL（条目图 + 品牌 logo）→ IndexedDB（localStorage 容量太小）
 *
 * 启动时先同步恢复配置，再异步回填图片。
 *
 * key 各自独立：截图沿用原有 `app-preview-studio.project.v1`，创意素材
 * `app-preview-studio.creative.v1`，图片裁剪 `app-preview-studio.crop.v1`。
 * 条目 id 由 uid() 生成，天然不会在 IndexedDB 里撞车。
 */

/** 持久化所需的最小能力（三个 store 都结构上满足） */
interface PersistableStore {
  storageKey: string
  items: { id: string; image: string | null }[]
  /** 品牌（仅做设计的两个工作台有；图片裁剪没有，故为可选） */
  brand?: BrandSpec
  /** 品牌 logo 的 IndexedDB key；`null` = 该工作台没有品牌 */
  brandKey: string | null
  snapshot(opts: { withImages: boolean }): unknown
  hydrate(raw: unknown): boolean
}

export function usePersistence() {
  // 三个 store 都常驻：切换工作台时数据已就绪，切换是瞬时的
  wireStore(useProjectStore(), '截图')
  wireStore(useCreativeStore(), '创意素材')
  wireStore(useCropStore(), '图片裁剪')
}

/** 把一个素材 store 接到 localStorage + IndexedDB 上 */
function wireStore(store: PersistableStore, label: string) {
  // 1. 恢复配置（同步，首帧前完成）
  try {
    const raw = localStorage.getItem(store.storageKey)
    if (raw) store.hydrate(JSON.parse(raw))
  } catch (e) {
    console.warn(`[persistence] 读取本地${label}项目失败`, e)
  }

  const savedImages = new Map<string, string | null>()
  let savedBrandLogo: string | null = null

  // 2. 异步回填图片（含品牌 logo），并注册图片变更监听
  void (async () => {
    for (const item of store.items) {
      const img = await getImage(item.id)
      if (img && !item.image) item.image = img
    }
    store.items.forEach((i) => savedImages.set(i.id, i.image))

    // 品牌：图片裁剪工作台没有品牌图片，跳过（brandKey 为 null）
    const brand = store.brand
    const brandKey = store.brandKey
    if (brand && brandKey) {
      const brandLogo = await getImage(brandKey)
      if (brandLogo && !brand.logo) brand.logo = brandLogo
      savedBrandLogo = brand.logo
      watch(
        () => brand.logo,
        (logo) => {
          if (savedBrandLogo === logo) return
          savedBrandLogo = logo
          if (logo) void putImage(brandKey, logo)
          else void deleteImage(brandKey)
        },
      )
    }

    watch(
      () => store.items.map((i) => ({ id: i.id, image: i.image })),
      (list) => {
        for (const { id, image } of list) {
          if (savedImages.get(id) === image) continue
          savedImages.set(id, image)
          if (image) void putImage(id, image)
          else void deleteImage(id)
        }
        const alive = new Set(list.map((i) => i.id))
        for (const id of [...savedImages.keys()]) {
          if (!alive.has(id)) {
            savedImages.delete(id)
            void deleteImage(id)
          }
        }
      },
    )
  })()

  // 3. 配置变更 → localStorage（防抖）
  let timer: ReturnType<typeof setTimeout> | undefined
  function save() {
    try {
      localStorage.setItem(store.storageKey, JSON.stringify(store.snapshot({ withImages: false })))
    } catch (e) {
      console.warn(`[persistence] 保存本地${label}项目失败`, e)
    }
  }
  watch(
    () => JSON.stringify(store.snapshot({ withImages: false })),
    () => {
      clearTimeout(timer)
      timer = setTimeout(save, 400)
    },
  )
}
