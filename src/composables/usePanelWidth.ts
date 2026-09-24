import { ref } from 'vue'

const STORAGE_KEY = 'app-preview-studio.panelWidth.v1'

/** 默认（同时是允许的最小）面板宽度：与原 w-80 保持一致 */
export const PANEL_MIN_WIDTH = 320
/** 面板最大宽度上限 */
const PANEL_MAX_WIDTH = 720
/** 主预览区至少保留的宽度，避免把画布挤没 */
const STAGE_MIN_WIDTH = 480

function clamp(value: number): number {
  const hardMax = Math.max(PANEL_MIN_WIDTH, window.innerWidth - STAGE_MIN_WIDTH)
  const max = Math.min(PANEL_MAX_WIDTH, hardMax)
  return Math.min(max, Math.max(PANEL_MIN_WIDTH, value))
}

function persist(width: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    /* 隐私模式等场景存储失败可忽略 */
  }
}

/**
 * 左侧表单面板宽度拖拽调整：
 * - 手柄 pointer 拖拽（监听挂 window，指针移出窗口也不丢事件）；
 * - 最小宽度 = 默认宽度 320px，双击手柄恢复默认；
 * - 宽度偏好存 localStorage 独立 key，不进项目快照（项目 JSON 不受影响）。
 */
export function usePanelWidth() {
  const panelWidth = ref(PANEL_MIN_WIDTH)

  try {
    const saved = Number(localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(saved) && saved > 0) panelWidth.value = clamp(saved)
  } catch {
    /* 同 persist：读取失败则用默认值 */
  }

  function startPanelDrag(e: PointerEvent): void {
    const startX = e.clientX
    const startWidth = panelWidth.value

    // 拖拽期间禁止文本选中并显示列向光标
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    const onMove = (ev: PointerEvent) => {
      panelWidth.value = clamp(startWidth + (ev.clientX - startX))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      persist(panelWidth.value)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  /** 双击手柄：恢复默认（最小）宽度 */
  function resetPanelWidth(): void {
    panelWidth.value = PANEL_MIN_WIDTH
    persist(panelWidth.value)
  }

  return { panelWidth, startPanelDrag, resetPanelWidth }
}
