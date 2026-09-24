import { watch } from 'vue'

import { useProjectStore } from '@/stores/project'
import { deleteImage, getImage, putImage } from '@/utils/imageStore'

const STORAGE_KEY = 'app-preview-studio.project.v1'

/**
 * 项目持久化：
 * - 配置（名称 / 尺寸 / 方向 / 全部截图条目）→ localStorage（防抖 400ms）
 * - App 截图 dataURL → IndexedDB（localStorage 容量太小）
 * 启动时先同步恢复配置，再异步回填图片。
 */
export function usePersistence() {
  const store = useProjectStore()

  // 1. 恢复配置（同步，首帧前完成）
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) store.hydrate(JSON.parse(raw))
  } catch (e) {
    console.warn('[persistence] 读取本地项目失败', e)
  }

  const savedImages = new Map<string, string | null>()
  /** 品牌 logo 走独立的 IndexedDB key（项目级，不随条目） */
  const BRAND_KEY = '__brand__'
  let savedBrandLogo: string | null = null

  // 2. 异步回填图片（含品牌 logo），并注册图片变更监听
  void (async () => {
    for (const item of store.items) {
      const img = await getImage(item.id)
      if (img && !item.image) item.image = img
    }
    store.items.forEach((i) => savedImages.set(i.id, i.image))

    const brandLogo = await getImage(BRAND_KEY)
    if (brandLogo && !store.brand.logo) store.brand.logo = brandLogo
    savedBrandLogo = store.brand.logo
    watch(
      () => store.brand.logo,
      (logo) => {
        if (savedBrandLogo === logo) return
        savedBrandLogo = logo
        if (logo) void putImage(BRAND_KEY, logo)
        else void deleteImage(BRAND_KEY)
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store.snapshot({ withImages: false })))
    } catch (e) {
      console.warn('[persistence] 保存本地项目失败', e)
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
