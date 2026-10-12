import { ref, watch, type Ref } from 'vue'

/**
 * 读取图片的原始宽高比（width / height）。
 *
 * 版式需要它来给主体图定尺寸，而浏览器的 `naturalWidth` 在图片解码完成前是 0，
 * 因此这里做一次显式预加载并放进响应式状态。返回 0 表示「还没就绪或没有图片」，
 * 版式据此先不绘制图片，加载完成后再出现。
 *
 * 导出时必须先 await 这个值（见 useExport.renderItem），否则会在图片就绪前
 * 就截图，产出没有主体图的成品。
 */
export function useAspectRatio(src: Ref<string | null>): Ref<number> {
  const aspect = ref(0)
  let token = 0

  watch(
    src,
    (value) => {
      const my = ++token
      if (!value) {
        aspect.value = 0
        return
      }
      const img = new Image()
      img.onload = () => {
        if (my !== token) return // 已被更新的 src 取代
        const w = img.naturalWidth
        const h = img.naturalHeight
        aspect.value = w > 0 && h > 0 ? w / h : 0
      }
      img.onerror = () => {
        if (my !== token) return
        aspect.value = 0
      }
      img.src = value
    },
    { immediate: true },
  )

  return aspect
}

/** 把一个已经加载完成的 dataURL 解析成宽高比（导出前的兜底同步读取） */
export async function loadAspect(src: string): Promise<number> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
  const w = img.naturalWidth
  const h = img.naturalHeight
  return w > 0 && h > 0 ? w / h : 0
}