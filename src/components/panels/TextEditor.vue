<script setup lang="ts">
import { computed } from 'vue'

import { FONTS, fontWeights, nearestWeight } from '@/data/fonts'
import { resolveTokens } from '@/data/themes'
import type { TextSpec } from '@/types'
import { useAssetStore } from '@/stores/assetStore'

import ColorField from '@/components/ui/ColorField.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import RangeField from '@/components/ui/RangeField.vue'

const store = useAssetStore()
const item = computed(() => store.activeItem)
const canvasW = computed(() => store.canvasSize.width)
const tokens = computed(() =>
  item.value ? resolveTokens(item.value.themeId, item.value.themeOverrides) : null,
)

function update(key: 'headline' | 'subtitle', partial: Partial<TextSpec>) {
  store.patchText(key, partial)
}

function onColor(key: 'headline' | 'subtitle', token: 'headline' | 'subtitle', value: string) {
  update(key, { color: value })
  void token
}

/** 当前某段文字的字体 id */
function fontOf(key: 'headline' | 'subtitle'): string {
  return item.value?.[key].font ?? 'system'
}

/** 该字体可用的字重（单字重字体只显示一项） */
function weightsOf(key: 'headline' | 'subtitle'): number[] {
  return fontWeights(fontOf(key))
}

/** 切换字体：同时把字重钳制到新字体最接近的可用值 */
function setFont(key: 'headline' | 'subtitle', fontId: string) {
  const current = item.value?.[key]
  if (!current) return
  if (current.font === fontId) return
  update(key, { font: fontId, weight: nearestWeight(fontId, current.weight) })
}
</script>

<template>
  <PanelSection title="文案" hint="字号相对画布宽度">
    <div v-if="item && tokens" class="space-y-5">
      <!-- 主标题 -->
      <div class="space-y-2.5">
        <textarea
          data-text="headline"
          :value="item.headline.text"
          rows="2"
          class="w-full resize-y rounded-lg border border-line-700 bg-surface-850 px-3 py-2 text-sm text-ink-100 outline-none transition focus:border-brand-500"
          placeholder="主标题"
          @input="update('headline', { text: ($event.target as HTMLTextAreaElement).value })"
        />
        <div class="flex items-start gap-2">
          <span class="mt-1 shrink-0 text-[11px] text-ink-400">字体</span>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="f in FONTS"
              :key="f.id"
              type="button"
              :title="f.note"
              class="rounded px-1.5 py-0.5 text-[11px] transition"
              :class="
                fontOf('headline') === f.id
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-ink-400 hover:text-ink-200'
              "
              @click="setFont('headline', f.id)"
            >
              <span :style="{ fontFamily: f.stack }">{{ f.label }}</span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-ink-400">字重</span>
          <div class="flex gap-1">
            <button
              v-for="w in weightsOf('headline')"
              :key="w"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] transition"
              :class="
                item.headline.weight === w
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-ink-400 hover:text-ink-200'
              "
              @click="update('headline', { weight: w })"
            >
              {{ w }}
            </button>
          </div>
        </div>
        <RangeField
          label="主标题字号"
          :min="0.03"
          :max="0.12"
          :step="0.001"
          :model-value="item.headline.size"
          :format="(v) => `${Math.round(v * canvasW)} px`"
          @update:model-value="(v) => update('headline', { size: v })"
        />
        <ColorField
          label="主标题颜色"
          :model-value="item.headline.color"
          :fallback="tokens.headline"
          @update:model-value="(v) => onColor('headline', 'headline', v)"
        />
      </div>

      <!-- 副标题 -->
      <div class="space-y-2.5">
        <textarea
          data-text="subtitle"
          :value="item.subtitle.text"
          rows="2"
          class="w-full resize-y rounded-lg border border-line-700 bg-surface-850 px-3 py-2 text-sm text-ink-100 outline-none transition focus:border-brand-500"
          placeholder="副标题（可留空）"
          @input="update('subtitle', { text: ($event.target as HTMLTextAreaElement).value })"
        />
        <div class="flex items-start gap-2">
          <span class="mt-1 shrink-0 text-[11px] text-ink-400">字体</span>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="f in FONTS"
              :key="f.id"
              type="button"
              :title="f.note"
              class="rounded px-1.5 py-0.5 text-[11px] transition"
              :class="
                fontOf('subtitle') === f.id
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-ink-400 hover:text-ink-200'
              "
              @click="setFont('subtitle', f.id)"
            >
              <span :style="{ fontFamily: f.stack }">{{ f.label }}</span>
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-ink-400">字重</span>
          <div class="flex gap-1">
            <button
              v-for="w in weightsOf('subtitle')"
              :key="w"
              type="button"
              class="rounded px-1.5 py-0.5 text-[10px] transition"
              :class="
                item.subtitle.weight === w
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'text-ink-400 hover:text-ink-200'
              "
              @click="update('subtitle', { weight: w })"
            >
              {{ w }}
            </button>
          </div>
        </div>
        <RangeField
          label="副标题字号"
          :min="0.015"
          :max="0.06"
          :step="0.001"
          :model-value="item.subtitle.size"
          :format="(v) => `${Math.round(v * canvasW)} px`"
          @update:model-value="(v) => update('subtitle', { size: v })"
        />
        <ColorField
          label="副标题颜色"
          :model-value="item.subtitle.color"
          :fallback="tokens.subtitle"
          @update:model-value="(v) => onColor('subtitle', 'subtitle', v)"
        />
      </div>
    </div>
  </PanelSection>
</template>
