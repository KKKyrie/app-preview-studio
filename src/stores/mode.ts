/**
 * 工作台模式：App 预览截图 / 创意素材 / 图片裁剪。
 *
 * 三种素材在交互上完全分开（见 docs/creative-assets-design.md），
 * 但共用同一套顶栏、导出管线与面板骨架。
 *
 * 首次访问默认「App 预览截图」，与本工具引入创意素材之前的行为完全一致。
 *
 * 「图片裁剪」与另外两个是**根本不同**的路径：它不产出设计，只把一张已经
 * 画好的成品图按官方比例裁开。因此它既不共用 store，也不共用条目结构。
 */
import { ref } from 'vue'

export type WorkspaceMode = 'screenshot' | 'creative' | 'crop'

export const MODE_KEY = 'app-preview-studio.mode'

const MODES: WorkspaceMode[] = ['screenshot', 'creative', 'crop']

function readInitialMode(): WorkspaceMode {
  try {
    const raw = localStorage.getItem(MODE_KEY)
    return MODES.includes(raw as WorkspaceMode) ? (raw as WorkspaceMode) : 'screenshot'
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