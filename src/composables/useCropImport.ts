import { useCropStore } from '@/stores/crop'
import { readImageFile } from '@/utils/imageFile'

export interface CropImportSummary {
  /** 成功导入的张数 */
  added: number
  /** 因达到上限被拒的张数 */
  full: number
  /** 解码失败被跳过的张数 */
  failed: number
}

/**
 * 裁剪工作台的图片导入。
 *
 * 单独成 composable 的原因与 `setImage` 一样：**点击选择、拖拽、粘贴三条
 * 路径必须共用同一段逻辑**。裁剪列表的空位优先、上限判定、失败跳过都在这里，
 * 任何一条路径自己实现一遍都会与另外两条行为不一致。
 */
export function useCropImport() {
  const store = useCropStore()

  async function importFiles(files: File[]): Promise<CropImportSummary> {
    const summary: CropImportSummary = { added: 0, full: 0, failed: 0 }
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      try {
        const { image, width, height } = await readImageFile(file)
        if (store.importImage(image, file.name, width, height) === 'full') summary.full += 1
        else summary.added += 1
      } catch (e) {
        summary.failed += 1
        console.warn('[crop] 导入图片失败', file.name, e)
      }
    }
    return summary
  }

  return { importFiles }
}
