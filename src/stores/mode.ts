/**
 * 工作台模式：App 预览截图 / 创意素材。
 *
 * 两种素材在交互上完全分开（见 docs/creative-assets-design.md），
 * 但共用同一套顶栏、导出管线与面板骨架。
 *
 * 首次访问默认「App 预览截图」，与本工具引入创意素材之前的行为完全一致。
 */
import { ref } from 'vue'

export type WorkspaceMode = 'screenshot' | 'creative'

export const MODE_KEY = 'app-preview-studio.mode'

function readInitialMode(): WorkspaceMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'creative' ? 'creative' : 'screenshot'
  } catch {
    return 'screenshot'
  }
}

/** 模块级单例：App.vue / useAssetStore / useExport 共享 */
export const mode = ref<WorkspaceMode>(readInitialMode())

export function setMode(next: WorkspaceMode) {
  if (mode.value === next) return
  mode.value = next
  try {
    localStorage.setItem(MODE_KEY, next)
  } catch {
    /* 隐私模式下写不进去也不影响使用 */
  }
}