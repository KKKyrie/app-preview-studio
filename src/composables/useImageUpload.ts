import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useCropImport } from '@/composables/useCropImport'
import { useCreativeStore } from '@/stores/creative'
import { useCropStore } from '@/stores/crop'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'
import { readFileAsDataUrl } from '@/utils/imageFile'

/**
 * 取出拖拽 / 粘贴里的图片文件。
 *
 * 返回**全部**而不是第一个：裁剪工作台是一次处理一批成品的，丢掉其余文件
 * 就等于让用户逐个再拖一次。
 */
function pickImageFiles(transfer: DataTransfer | null): File[] {
  if (!transfer) return []
  const out: File[] = []
  for (const item of Array.from(transfer.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) out.push(file)
    }
  }
  if (out.length) return out
  return Array.from(transfer.files).filter((f) => f.type.startsWith('image/'))
}

/**
 * 图片上传：支持点击选择、拖拽、⌘V 粘贴（作用于整个窗口）。
 *
 * 三个工作台的落点完全不同，因此分发必须集中在这里：
 *   截图     → 替换当前截图的图（patchActive）
 *   创意素材 → store.setImage（当前版式不画图时会自动换版式，见 store 注释）
 *   图片裁剪 → 追加为新条目（空位优先），支持一次多张
 */
export function useImageUpload() {
  const store = useProjectStore()
  const creative = useCreativeStore()
  const crop = useCropStore()
  const { importFiles } = useCropImport()
  const dragging = ref(false)
  let dragDepth = 0

  async function applyFiles(files: File[]) {
    if (!files.length) return
    if (mode.value === 'crop') {
      await importFiles(files)
      return
    }
    const file = files[0]
    const dataUrl = await readFileAsDataUrl(file)
    if (mode.value === 'creative') creative.setImage(dataUrl, file.name)
    else store.patchActive({ image: dataUrl, imageName: file.name })
  }

  async function applyFile(file: File | null) {
    if (!file) return applyFiles([])
    await applyFiles([file])
  }

  function onPaste(e: ClipboardEvent) {
    const files = pickImageFiles(e.clipboardData)
    if (files.length) {
      e.preventDefault()
      void applyFiles(files)
    }
  }

  function onDragEnter(e: DragEvent) {
    e.preventDefault()
    dragDepth += 1
    dragging.value = true
  }

  function onDragOver(e: DragEvent) {
    e.preventDefault()
  }

  function onDragLeave(e: DragEvent) {
    e.preventDefault()
    dragDepth = Math.max(0, dragDepth - 1)
    if (dragDepth === 0) dragging.value = false
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    dragDepth = 0
    dragging.value = false
    void applyFiles(pickImageFiles(e.dataTransfer))
  }

  function clearImage() {
    if (mode.value === 'crop') crop.clearItem(crop.activeItemId)
    else if (mode.value === 'creative') creative.setImage(null, null)
    else store.patchActive({ image: null, imageName: null })
  }

  onMounted(() => {
    window.addEventListener('paste', onPaste)
    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('paste', onPaste)
    window.removeEventListener('dragenter', onDragEnter)
    window.removeEventListener('dragover', onDragOver)
    window.removeEventListener('dragleave', onDragLeave)
    window.removeEventListener('drop', onDrop)
  })

  return { dragging, applyFile, applyFiles, clearImage }
}
