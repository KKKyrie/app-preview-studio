import type { CanvasOption, PlacementId } from '@/constants/placements'
import { useCreativeStore } from '@/stores/creative'
import { useCropStore } from '@/stores/crop'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'
import type { ProjectStoreLike, SharedAssetStore } from '@/types'

/**
 * 「素材」store 门面：**只服务做设计的两个工作台**（截图 / 创意素材）。
 *
 * 共享面板（主题 / 文案 / 品牌）只依赖 types.ts 里的 `SharedAssetStore`
 * 接口——它是 `CanvasItem` 与 `CreativeItem` 的公共字段子集，因此同一份面板
 * 实现可以在两种工作台下复用，无需为后者复制一份。
 *
 * ⚠️ 图片裁剪工作台**不要**用这个。它不是做设计，没有主题 / 文案 / 品牌，
 * 结构上也不满足 `SharedAssetStore`。共享面板里它只用 `ProjectPanel`
 * （走下面的 `useProjectPanelStore`）。
 */
export function useAssetStore(): SharedAssetStore {
  return (mode.value === 'creative' ? useCreativeStore() : useProjectStore()) as SharedAssetStore
}

/**
 * 「项目」面板的 store 门面：三个工作台都能用。
 *
 * 只依赖 `ProjectStoreLike`（项目名 / 条目 id / 持久化 key / 快照与恢复），
 * 因此图片裁剪那种没有品牌的 store 也能接入，不必为了复用一份面板去伪造
 * 一个空的 `brand`。
 */
export function useProjectPanelStore(): ProjectStoreLike {
  if (mode.value === 'crop') return useCropStore()
  return useCreativeStore()
}

/** 坑位选择面板依赖的最小能力（创意素材 / 图片裁剪都满足） */
export interface PlacementStoreLike {
  placementId: PlacementId
  canvasSize: { width: number; height: number }
  setPlacement(id: PlacementId): void
  setCanvas(option: CanvasOption): void
}

/**
 * 坑位选择的门面：创意素材与图片裁剪共用 `PlacementPicker`。
 *
 * 两个工作台的画框都来自官方坑位表，因此「选坑位 + 选尺寸」这段交互完全
 * 一致，没有任何理由复制一份。截图模式没有坑位概念，因此不在这里返回
 * project store —— 真被调用说明面板挂错了工作台。
 */
export function usePlacementStore(): PlacementStoreLike {
  return mode.value === 'crop' ? useCropStore() : useCreativeStore()
}
