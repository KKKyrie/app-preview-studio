<script setup lang="ts">
import { computed } from 'vue'

import { flashRole, flashViolation, safeAreaReport } from '@/composables/useCreativeChecks'
import { describeOver } from '@/composables/useSafeArea'
import { useCreativeStore } from '@/stores/creative'

import PanelSection from '@/components/ui/PanelSection.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'

const store = useCreativeStore()

/** 与画布检查一致的元素顺序，方便逐行对照 */
const ROLES = [
  { role: 'brand' as const, label: '品牌 Logo' },
  { role: 'headline' as const, label: '主标题' },
  { role: 'subtitle' as const, label: '副标题' },
]

const rows = computed(() =>
  ROLES.map((r) => {
    const v = safeAreaReport.value.violations.find((x) => x.role === r.role)
    return { ...r, violation: v }
  }).filter((r) => {
    // 副标题为空时不显示该行
    if (r.role === 'subtitle') return !!store.activeItem?.subtitle.text?.trim()
    if (r.role === 'brand') return !!(store.brand.logo || store.brand.name.trim())
    return true
  }),
)

const violations = computed(() => safeAreaReport.value.violations)
const ok = computed(() => violations.value.length === 0)

const safeLabel = computed(() => {
  const s = store.safeArea
  return `${s.width} × ${s.height}`
})

/**
 * 把文案块垂直居中到安全区。
 *
 * 版式参数里的「文案距安全区顶部」是一个静态比例，而文案块的实际高度取决于
 * 字体与换行，只有测量后才知道。这里用画布实测高度反算出一个合适的起始位置，
 * 属于「按需修正」而非持续布局，不会造成渲染回环。
 */
function centerVertically() {
  const headline = safeAreaReport.value.boxes.get('headline')
  if (!headline) return
  const brand = safeAreaReport.value.boxes.get('brand')
  const subtitle = safeAreaReport.value.boxes.get('subtitle')
  const top = brand ? brand.y : headline.y
  const bottom = subtitle ? subtitle.y + subtitle.height : headline.y + headline.height
  const blockH = bottom - top
  const safe = store.safeArea
  const delta = safe.y + (safe.height - blockH) / 2 - top
  const item = store.activeItem
  const ratio = (item.params.textY ?? 0) + delta / safe.height
  item.params.textY = Math.max(0, Math.min(0.8, ratio))
}
</script>

<template>
  <PanelSection
    title="安全区检查"
    :hint="ok ? `✓ ${rows.length} 项全部在安全区内` : `${violations.length} 项越界`"
  >
    <div class="space-y-3">
      <!-- 当前安全区信息 -->
      <div class="rounded-lg border border-line-700 bg-surface-850 px-3 py-2">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-[11px] text-ink-400">当前安全区</span>
          <span class="text-xs tabular-nums text-ink-100">{{ safeLabel }}</span>
        </div>
        <div class="mt-0.5 flex items-baseline justify-between gap-2">
          <span class="text-[11px] text-ink-400">{{ store.placement.name }}</span>
          <span class="text-[10px] text-ink-500">
            画布 {{ store.canvasSize.width }}×{{ store.canvasSize.height }}
          </span>
        </div>
      </div>

      <p class="text-[10px] leading-relaxed text-ink-500">
        安全区是 Apple 所有设备 / 方向裁切方式的<strong class="text-ink-300">交集</strong>：
        关键元素落在其中就一定不会被裁掉。
      </p>

      <!-- 逐元素结果 -->
      <ul class="space-y-1">
        <li
          v-for="r in rows"
          :key="r.role"
          :data-safe-row="r.role"
          class="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition"
          :class="[
            r.violation ? 'bg-red-500/10' : 'bg-surface-850',
            r.violation ? 'cursor-pointer hover:bg-red-500/20' : '',
          ]"
          @click="r.violation && flashViolation(r.role)"
        >
          <span
            class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] leading-none"
            :class="r.violation ? 'bg-red-500/30 text-red-300' : 'bg-emerald-500/20 text-emerald-300'"
          >
            {{ r.violation ? '!' : '✓' }}
          </span>
          <span class="shrink-0 text-ink-200">{{ r.label }}</span>
          <span
            class="ml-auto truncate text-[10px]"
            :class="r.violation ? 'text-red-300' : 'text-ink-600'"
          >
            {{ r.violation ? describeOver(r.violation.over) : '在安全区内' }}
          </span>
        </li>
      </ul>

      <!-- 操作 -->
      <div v-if="violations.length > 0" class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="rounded-md bg-surface-700 px-2.5 py-1 text-[11px] text-ink-200 transition hover:bg-surface-600"
          @click="centerVertically"
        >
          文案垂直居中到安全区
        </button>
      </div>

      <!-- 开关 -->
      <div class="space-y-2 border-t border-line-800 pt-3">
        <label class="flex cursor-pointer items-center justify-between gap-3">
          <span class="text-[11px] text-ink-300">画布显示安全区</span>
          <ToggleSwitch
            :model-value="store.showSafeArea"
            @update:model-value="(v) => (store.showSafeArea = v)"
          />
        </label>
        <label class="flex cursor-pointer items-center justify-between gap-3">
          <span class="text-[11px] text-ink-300">同时检查主体图</span>
          <ToggleSwitch
            :model-value="store.checkImage"
            @update:model-value="(v) => (store.checkImage = v)"
          />
        </label>
        <p class="text-[10px] leading-relaxed text-ink-500">
          主体图默认不检查：出血是常见的设计意图，只有当它承担「视觉焦点」时才需要限制在安全区内。
        </p>
      </div>

      <p v-if="flashRole" class="text-[10px] text-brand-300">
        已在画布上高亮 {{ rows.find((r) => r.role === flashRole)?.label ?? '' }}
      </p>
    </div>
  </PanelSection>
</template>