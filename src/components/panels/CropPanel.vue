<script setup lang="ts">
import { computed } from 'vue'

import { allCanvasOptions, type CanvasOption } from '@/constants/placements'
import { useCropStore } from '@/stores/crop'
import { MAX_CROP_ZOOM } from '@/utils/cropGeometry'

import PanelSection from '@/components/ui/PanelSection.vue'
import RangeField from '@/components/ui/RangeField.vue'

/**
 * 裁剪构图面板。
 *
 * 只放**画布上做不精确**的操作：拖拽能定个大方向，但「再看右边一点点」
 * 这种微调必须能落到数值上。反过来，画布上已经有的按钮（居中 / 重置 /
 * 源图缩放）这里不再重复一份——同一件事两个入口只会让人怀疑它们不一样。
 */
const store = useCropStore()

const hasImage = computed(() => !!store.activeItem?.image)

/** 一键全部尺寸会产出哪些文件（按 WxH 去重后是 4 个） */
const batchSizes = computed(() => allCanvasOptions())

function isCurrent(c: CanvasOption): boolean {
  return store.canvasSize.width === c.width && store.canvasSize.height === c.height
}

const pct = (v: number) => `${Math.round(v * 100)}%`

const safeRatio = computed(() => {
  const s = store.safeArea
  const c = store.canvasSize
  return `${(((s.width * s.height) / (c.width * c.height)) * 100).toFixed(1)}%`
})
</script>

<template>
  <PanelSection title="构图" hint="画框锁定比例">
    <template v-if="hasImage">
      <RangeField
        label="源图缩放"
        :model-value="store.activeItem?.zoom ?? 1"
        :min="1"
        :max="MAX_CROP_ZOOM"
        :step="0.01"
        :format="(v) => `${Math.round(v * 100)}%`"
        @update:model-value="store.setZoom($event)"
      />

      <!-- 某轴没有多余空间时**不显示该轴滑杆**：滑了画布不动，
           用户只会以为工具坏了（「操作成功但界面无变化」按 bug 处理） -->
      <RangeField
        v-if="store.slack.x > 0.5"
        class="mt-2.5"
        label="水平位置"
        :model-value="store.activeItem?.offset.x ?? 0"
        :min="-1"
        :max="1"
        :step="0.01"
        :format="pct"
        @update:model-value="store.setAxis('x', $event)"
      />
      <p v-else class="mt-2.5 text-[10px] text-ink-500">水平方向已铺满，无需调整</p>

      <RangeField
        v-if="store.slack.y > 0.5"
        class="mt-2.5"
        label="垂直位置"
        :model-value="store.activeItem?.offset.y ?? 0"
        :min="-1"
        :max="1"
        :step="0.01"
        :format="pct"
        @update:model-value="store.setAxis('y', $event)"
      />
      <p v-else class="mt-2.5 text-[10px] text-ink-500">垂直方向已铺满，无需调整</p>

      <p class="mt-3 border-t border-line-800 pt-2.5 text-[10px] leading-relaxed text-ink-500">
        位置 -100% = 源图左 / 上边缘贴住画框，+100% = 右 / 下边缘贴住画框。<br />
        画布上拖拽图片调整构图，滚轮缩放源图；⌘/Ctrl + 滚轮缩放预览。
      </p>
    </template>

    <p v-else class="text-[10px] leading-relaxed text-ink-500">
      导入图片后在这里做精确微调（拖拽只能定大方向，数值能落到毫厘）。
    </p>
  </PanelSection>

  <PanelSection title="安全区" hint="仅预览，不进导出">
    <button
      type="button"
      data-crop-safe-toggle
      class="w-full rounded-md py-1.5 text-[11px] transition"
      :class="
        store.showSafeArea
          ? 'bg-brand-500/15 text-brand-300 hover:bg-brand-500/25'
          : 'bg-surface-700 text-ink-300 hover:bg-surface-600'
      "
      @click="store.showSafeArea = !store.showSafeArea"
    >
      {{ store.showSafeArea ? '✓ 正在显示安全区' : '显示安全区' }}
    </button>
    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
      当前画框的安全区 {{ store.safeArea.width }} × {{ store.safeArea.height }}
      （占画布 {{ safeRatio }}）。
      Apple 建议关键元素落在其中，这样在各种裁切方式下都不会被切掉。
    </p>
  </PanelSection>

  <PanelSection title="一键全部尺寸" :hint="`${batchSizes.length} 个`">
    <div class="space-y-1">
      <div
        v-for="c in batchSizes"
        :key="`${c.width}x${c.height}`"
        class="flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5"
        :class="isCurrent(c) ? 'border-brand-500/60 bg-brand-500/10' : 'border-line-700'"
      >
        <span class="text-[11px] tabular-nums text-ink-200">{{ c.label }}</span>
        <span class="flex items-center gap-1 text-[10px]">
          <span class="rounded bg-surface-700 px-1.5 py-0.5 text-ink-300">{{ c.aspect }}</span>
          <span v-if="c.universal" class="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">
            双坑位共用
          </span>
        </span>
      </div>
    </div>
    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
      顶栏「导出全部尺寸」会按每个画框的比例**分别重排**同一份构图（等比铺满 +
      保留构图意图），一次产出以上 {{ batchSizes.length }} 个文件（ZIP），不必手动裁四遍。
    </p>
  </PanelSection>
</template>
