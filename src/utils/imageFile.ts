/**
 * 图片文件读取：dataURL + 源图像素尺寸。
 *
 * 单独成模块是因为**两条导入路径必须行为一致**（点击选择 / 拖拽粘贴），
 * 而且裁剪几何需要真实的 `width × height`——只有宽高比不够：
 * offset 归一化到多余空间时用不到它，但「成品会不会被放大」的画质判断
 * 必须拿源图像素和画框像素直接比。
 */

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

/** 解码 dataURL 后读出像素尺寸；解码失败抛错（调用方据此跳过该文件） */
export function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const width = img.naturalWidth
      const height = img.naturalHeight
      if (width > 0 && height > 0) resolve({ width, height })
      else reject(new Error('图片尺寸无效'))
    }
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

/** 文件 → dataURL + 像素尺寸 */
export async function readImageFile(
  file: File,
): Promise<{ image: string; width: number; height: number }> {
  const image = await readFileAsDataUrl(file)
  const { width, height } = await loadImageSize(image)
  return { image, width, height }
}
