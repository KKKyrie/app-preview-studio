import { computed } from 'vue'

import { useCropStore } from '@/stores/crop'

/**
 * 裁剪画质徽章。
 *
 * 裁剪工具最隐蔽的失败模式就是「构图对了但分辨率不够」——在裁剪界面里
 * 看起来完全正常，上传到 App Store Connect 才被判画质不合格。因此把
 * 「实际用到的源图像素够不够画框用」量化成一个徽章，画布与顶栏共用同一份
 * 文案（两处说法不一致比不显示更糟）。
 */
export function useCropQuality() {
  const store = useCropStore()

  return computed(() => {
    const c = store.sourceCoverage
    if (c === null) {
      return { cls: 'border-line-700 bg-surface-850 text-ink-400', text: '等待导入图片' }
    }
    if (c >= 1) {
      const margin = Math.round((c - 1) * 100)
      return {
        cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
        text: margin > 5 ? `分辨率 ✓ 余量 ${margin}%` : '分辨率 ✓ 刚好够用',
      }
    }
    return {
      cls: 'border-red-500/50 bg-red-500/12 text-red-300',
      text: `⚠ 会被放大 ${Math.round((1 / c - 1) * 100)}%，成品会糊`,
    }
  })
}
