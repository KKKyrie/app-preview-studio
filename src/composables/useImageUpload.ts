import { onBeforeUnmount, onMounted, ref } from 'vue'

import { useCreativeStore } from '@/stores/creative'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

function pickImageFile(transfer: DataTransfer | null): File | null {
  if (!transfer) return null
  for (const item of Array.from(transfer.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) return file
    }
  }
  return transfer.files[0]?.type.startsWith('image/') ? transfer.files[0] : null
}

/**
 * 图片上传：支持点击选择、拖拽、⌘V 粘贴（作用于整个窗口）。
 */
export function useImageUpload() {
  const store = useProjectStore()
  const creative = useCreativeStore()
  const dragging = ref(false)
  let dragDepth = 0

  async function applyFile(file: File | null) {
    if (!file) return
    const dataUrl = await readFileAsDataUrl(file)
    // 拖拽 / 粘贴按当前工作台落到对应素材上。
    // 创意素材走 store.setImage：当前版式不绘制主体图时会自动换版式（见 store 注释）
    if (mode.value === 'creative') creative.setImage(dataUrl, file.name)
    else store.patchActive({ image: dataUrl, imageName: file.name })
  }

  function onPaste(e: ClipboardEvent) {
    const file = pickImageFile(e.clipboardData)
    if (file) {
      e.preventDefault()
      void applyFile(file)
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
    void applyFile(pickImageFile(e.dataTransfer))
  }

  function clearImage() {
    if (mode.value === 'creative') creative.setImage(null, null)
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

  return { dragging, applyFile, clearImage }
}
