import { watch } from 'vue'

import { useCreativeStore } from '@/stores/creative'
import { useProjectStore } from '@/stores/project'
import type { SharedAssetStore } from '@/types'
import { deleteImage, getImage, putImage } from '@/utils/imageStore'

/**
 * 项目持久化（两种素材各一份，完全隔离）：
 * - 配置（名称 / 尺寸 / 方向 / 条目）→ localStorage（防抖 400ms）
 * - 图片 dataURL（条目图 + 品牌 logo）→ IndexedDB（localStorage 容量太小）
 *
 * 启动时先同步恢复配置，再异步回填图片。
 *
 * 截图项目沿用原有 key `app-preview-studio.project.v1`，创意素材用独立的
 * `app-preview-studio.creative.v1`，两者互不覆盖；条目 id 由 uid() 生成，
 * 天然不会在 IndexedDB 里撞车。
 */
export function usePersistence() {
  // 两个 store 都常驻：切换工作台时数据已就绪，切换是瞬时的
  wireStore(useProjectStore(), '截图')
  wireStore(useCreativeStore(), '创意素材')
}

/** 把一个素材 store 接到 localStorage + IndexedDB 上 */
function wireStore(store: SharedAssetStore, label: string) {
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

    const brandLogo = await getImage(store.brandKey)
    if (brandLogo && !store.brand.logo) store.brand.logo = brandLogo
    savedBrandLogo = store.brand.logo
    watch(
      () => store.brand.logo,
      (logo) => {
        if (savedBrandLogo === logo) return
        savedBrandLogo = logo
        if (logo) void putImage(store.brandKey, logo)
        else void deleteImage(store.brandKey)
      },
    )

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