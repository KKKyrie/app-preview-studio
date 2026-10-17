import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * 预览画布的视图变换：自动适应窗口 + 用户缩放 + 拖拽平移。
 *
 * ── 为什么必须把「画布尺寸变化」也纳入重算 ────────────────────────────────
 * 最初只在宿主容器 ResizeObserver 触发时重算缩放。但切换画布尺寸**不会**
 * 改变宿主尺寸，于是缩放值一直沿用上一次的：
 *   1920×1280 → fitScale 0.65；切到 5244×2950 后仍是 0.65，
 *   画布被撑到 3409×1918，而宿主只有 1360×954 ——
 *   横向只看得见 40%、纵向 50%，也就是「只能看到中间一小块」。
 * 反过来从大画布切到小画布，又会出现画布缩在中间不肯放大。
 *
 * 因此这里在 `size` 变化时**重新适应窗口并归零平移**，保证任何尺寸切换后
 * 第一眼都是完整画布；在此之上再提供用户缩放与平移，用于核对细节。
 *
 * 缩放 = fitScale（窗口自适应） × zoom（用户档位），所以窗口 resize 时
 * 用户的相对缩放保持不变，不会跳变。
 */

/** 画布四周留白（px），避免画布贴着宿主边缘 */
export const STAGE_PAD = 56
/** 用户缩放档位下限 = 1（适应窗口），不允许缩到比「看全」还小 */
const MIN_ZOOM = 1
/** 上限 8×：本项目最大画布 5244×2950 适应窗口约 0.24，8× 足够覆盖到实际像素 */
const MAX_ZOOM = 8
/** 每次点按 / 滚轮的缩放倍率 */
const ZOOM_STEP = 1.25

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function useStageViewport(
  hostEl: Ref<HTMLElement | null>,
  size: () => { width: number; height: number },
  pad = STAGE_PAD,
) {
  /** 窗口自适应缩放（画布刚好完整可见） */
  const fitScale = ref(0.2)
  /** 用户缩放档位，1 = 适应窗口 */
  const zoom = ref(1)
  /** 平移量（px，相对居中位置） */
  const offset = ref({ x: 0, y: 0 })
  const panning = ref(false)
  const container = ref({ w: 0, h: 0 })

  /** 最终渲染缩放 */
  const scale = computed(() => fitScale.value * zoom.value)
  const isFit = computed(() => zoom.value === 1)
  const atMinZoom = computed(() => zoom.value <= MIN_ZOOM + 1e-6)
  const atMaxZoom = computed(() => zoom.value >= MAX_ZOOM - 1e-6)
  const content = computed(() => ({
    w: size().width * scale.value,
    h: size().height * scale.value,
  }))
  /** 内容超出宿主才允许平移，否则拖拽是空操作（避免误拖） */
  const canPan = computed(
    () => content.value.w > container.value.w + 1 || content.value.h > container.value.h + 1,
  )

  /** 平移量夹紧：未超出时归零；超出时最多拖到内容边缘与宿主对齐，画布不会被拖丢 */
  function clampOffset() {    const maxX = Math.max(0, (content.value.w - container.value.w) / 2)
    const maxY = Math.max(0, (content.value.h - container.value.h) / 2)
    offset.value = {
      x: clamp(offset.value.x, -maxX, maxX),
      y: clamp(offset.value.y, -maxY, maxY),
    }
  }

  /** 重新量取宿主尺寸、重算「适应窗口」缩放，并夹紧平移量 */
  function update() {
    const el = hostEl.value
    if (!el) return
    container.value = { w: el.clientWidth, h: el.clientHeight }
    const { width, height } = size()
    const availW = container.value.w - pad * 2
    const availH = container.value.h - pad * 2
    if (availW > 0 && availH > 0 && width > 0 && height > 0) {
      fitScale.value = Math.min(availW / width, availH / height, 1)
    }
    clampOffset()
  }

  /** 回到「适应窗口」并居中 */
  function resetView() {
    zoom.value = 1
    offset.value = { x: 0, y: 0 }
  }

  /**
   * 以某个屏幕坐标为锚点缩放，锚点下的内容在缩放前后保持不动。
   * 不传坐标则以宿主中心为锚点。
   */
  function zoomAt(factor: number, clientX?: number, clientY?: number) {
    const el = hostEl.value
    if (!el) return
    const next = clamp(zoom.value * factor, MIN_ZOOM, MAX_ZOOM)
    if (Math.abs(next - zoom.value) < 1e-6) return
    const k = next / zoom.value
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = (clientX ?? cx) - cx
    const dy = (clientY ?? cy) - cy
    zoom.value = next
    offset.value = {
      x: dx - (dx - offset.value.x) * k,
      y: dy - (dy - offset.value.y) * k,
    }
    clampOffset()
  }

  const zoomIn = () => zoomAt(ZOOM_STEP)
  const zoomOut = () => zoomAt(1 / ZOOM_STEP)

  /**
   * 100%：画布像素与屏幕像素 1:1。
   *
   * 传入 `focus`（画布坐标系矩形）时把视口对准它，而不是画布中心：
   * 创意素材的内容集中在安全区里，而安全区在 5244×2950 上只占画布 26.7% 宽、
   * 且垂直偏上 334px —— 对准画布中心等于对准一片空白。
   */
  function zoomActual(focus?: { x: number; y: number; width: number; height: number }) {
    zoom.value = clamp(1 / fitScale.value, MIN_ZOOM, MAX_ZOOM)
    const { width, height } = size()
    if (focus) {
      offset.value = {
        x: (width / 2 - (focus.x + focus.width / 2)) * scale.value,
        y: (height / 2 - (focus.y + focus.height / 2)) * scale.value,
      }
    } else {
      offset.value = { x: 0, y: 0 }
    }
    clampOffset()
  }

  /* ── 交互 ── */

  /** ⌘/Ctrl + 滚轮缩放（锚点为指针）；普通滚轮平移 */
  function onWheel(e: WheelEvent) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      zoomAt(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, e.clientX, e.clientY)
      return
    }
    if (!canPan.value) return
    e.preventDefault()
    offset.value = { x: offset.value.x - e.deltaX, y: offset.value.y - e.deltaY }
    clampOffset()
  }

  let drag: { id: number; x: number; y: number; ox: number; oy: number } | null = null

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0 || !canPan.value) return
    // 缩放控件自己处理点击，不参与平移
    if ((e.target as HTMLElement | null)?.closest('[data-zoom-ui]')) return
    const el = hostEl.value
    if (!el) return
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, ox: offset.value.x, oy: offset.value.y }
    panning.value = true
    el.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return
    offset.value = { x: drag.ox + (e.clientX - drag.x), y: drag.oy + (e.clientY - drag.y) }
    clampOffset()
  }

  function onPointerUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return
    hostEl.value?.releasePointerCapture(e.pointerId)
    drag = null
    panning.value = false
  }

  /* ── 生命周期 ── */

  let ro: ResizeObserver | null = null

  onMounted(() => {
    update()
    ro = new ResizeObserver(update)
    if (hostEl.value) ro.observe(hostEl.value)
  })

  onBeforeUnmount(() => ro?.disconnect())

  // 画布尺寸一变就重新适应窗口 —— 见文件头注释，缺了这条就会出现「只能看到局部」
  watch(
    () => [size().width, size().height],
    () => {
      resetView()
      update()
    },
  )

  return {
    scale,
    zoom,
    offset,
    canPan,
    panning,
    isFit,
    atMinZoom,
    atMaxZoom,
    content,
    zoomIn,
    zoomOut,
    zoomFit: resetView,
    zoomActual,
    onWheel,
    onPointerDown,
    onPointerMove,
    onPointerUp,
  }
}
