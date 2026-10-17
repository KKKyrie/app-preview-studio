<script setup lang="ts">
import { computed } from 'vue'

import { safeAreaReport } from '@/composables/useCreativeChecks'
import { useCropQuality } from '@/composables/useCropQuality'
import { checkCompliance, hasBlockingIssue } from '@/data/compliance'
import { useCreativeStore } from '@/stores/creative'
import { useCropStore } from '@/stores/crop'
import { mode, setMode, type WorkspaceMode } from '@/stores/mode'

/**
 * 工作台切换条。
 *
 * 放在顶栏下方而不是塞进顶栏：顶栏已有 logo / 项目名 / 尺寸徽章 / 两个按钮，
 * 再挤一个分段控件会很挤，而且会让「项目名」的归属变模糊。独立一行还能在
 * 右侧放当前模式的上下文信息——这在截图模式下没有意义，正好强化三种模式的差异。
 */
const creative = useCreativeStore()
const crop = useCropStore()

const violations = computed(() => safeAreaReport.value.violations)

const complianceHits = computed(() =>
  checkCompliance([
    { field: '主标题', text: creative.activeItem?.headline.text ?? '' },
    { field: '副标题', text: creative.activeItem?.subtitle.text ?? '' },
    { field: '品牌名', text: creative.brand.name },
  ]),
)

const complianceBlocked = computed(() => hasBlockingIssue(complianceHits.value))

const safeBadge = computed(() => {
  if (violations.value.length > 0) {
    return {
      cls: 'border-red-500/50 bg-red-500/12 text-red-300',
      text: `⚠ ${violations.value.length} 项越界`,
    }
  }
  return {
    cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    text: `安全区 ✓ ${safeAreaReport.value.checked || 0} 项`,
  }
})

const complianceBadge = computed(() => {
  if (complianceBlocked.value) {
    return {
      cls: 'border-red-500/50 bg-red-500/12 text-red-300',
      text: `⚠ 合规 ${complianceHits.value.length} 项`,
    }
  }
  if (complianceHits.value.length > 0) {
    return {
      cls: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
      text: `合规 ${complianceHits.value.length} 项提示`,
    }
  }
  return {
    cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    text: '合规 ✓',
  }
})

/** 裁剪工作台的上下文：源图尺寸 + 画质（与画布上那个徽章同一份文案） */
const cropQuality = useCropQuality()
const cropSource = computed(() => {
  const it = crop.activeItem
  if (!it?.image) return null
  return `${it.width} × ${it.height}`
})

const segment = (m: WorkspaceMode) => [
  'rounded-md px-3.5 py-1.5 text-xs font-medium transition',
  mode.value === m
    ? 'bg-brand-500 text-white shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
    : 'text-ink-400 hover:text-ink-200',
]
</script>

<template>
  <div class="flex h-11 shrink-0 items-center gap-3 border-b border-line-800 px-4">
    <!-- 模式切换 -->
    <div class="flex shrink-0 items-center gap-1 rounded-lg bg-surface-850 p-1">
      <button type="button" data-mode-btn="screenshot" :class="segment('screenshot')" @click="setMode('screenshot')">
        ▣ App 预览截图
      </button>
      <button type="button" data-mode-btn="creative" :class="segment('creative')" @click="setMode('creative')">
        ◇ 创意素材
      </button>
      <button type="button" data-mode-btn="crop" :class="segment('crop')" @click="setMode('crop')">
        ⬚ 图片裁剪
      </button>
    </div>

    <div class="flex-1" />

    <!-- 当前模式的上下文信息 -->
    <template v-if="mode === 'creative'">
      <span
        class="hidden rounded-full border border-line-700 bg-surface-850 px-2.5 py-1 text-[11px] text-ink-300 sm:inline"
      >
        安全区 {{ creative.safeArea.width }} × {{ creative.safeArea.height }}
      </span>
      <span
        class="rounded-full border px-2.5 py-1 text-[11px]"
        :class="safeBadge.cls"
        data-safe-badge
        :title="`当前检查了 ${safeAreaReport.checked} 个关键元素`"
      >
        {{ safeBadge.text }}
      </span>
      <span class="rounded-full border px-2.5 py-1 text-[11px]" data-compliance-badge :class="complianceBadge.cls">
        {{ complianceBadge.text }}
      </span>
    </template>

    <template v-else-if="mode === 'crop'">
      <span
        v-if="cropSource"
        data-crop-source
        class="hidden rounded-full border border-line-700 bg-surface-850 px-2.5 py-1 text-[11px] text-ink-300 sm:inline"
      >
        源图 {{ cropSource }}
      </span>
      <span class="rounded-full border px-2.5 py-1 text-[11px]" data-crop-quality-badge :class="cropQuality.cls">
        {{ cropQuality.text }}
      </span>
    </template>

    <template v-else>
      <span class="hidden text-[11px] text-ink-500 sm:inline">
        导出尺寸在左侧「导出尺寸」中选择；设备图与版式适用于展示 App 在用状态
      </span>
    </template>
  </div>
</template>
