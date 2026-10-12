import { useCreativeStore } from '@/stores/creative'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'
import type { SharedAssetStore } from '@/types'

/**
 * 当前工作台的素材 store。
 *
 * 共享面板（主题 / 文案 / 品牌 / 素材 / 项目）只依赖 types.ts 里的
 * `SharedAssetStore` 接口——它是 `CanvasItem` 与 `CreativeItem` 的公共字段子集，
 * 因此同一份面板实现可以在「App 预览截图」与「创意素材」两种工作台下复用，
 * 无需为后者复制一份。
 *
 * 两个 store 的持久化 key 完全隔离，互不覆盖。
 */
export function useAssetStore(): SharedAssetStore {
  return (mode.value === 'creative' ? useCreativeStore() : useProjectStore()) as SharedAssetStore
}