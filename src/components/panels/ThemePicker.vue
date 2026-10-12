<script setup lang="ts">
import { computed } from 'vue'

import { THEMES } from '@/data/themes'
import { useAssetStore } from '@/stores/assetStore'

import PanelSection from '@/components/ui/PanelSection.vue'

const store = useAssetStore()
const item = computed(() => store.activeItem)
</script>

<template>
  <PanelSection title="风格主题" hint="背景 / 文字 / 投影">
    <div class="space-y-1.5">
      <button
        v-for="t in THEMES"
        :key="t.id"
        type="button"
        class="flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition"
        :class="
          item?.themeId === t.id
            ? 'border-brand-500 bg-brand-500/15 shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
            : 'border-line-700 bg-surface-800 hover:border-surface-600'
        "
        @click="store.setTheme(t.id)"
      >
        <span
          class="h-8 w-8 shrink-0 rounded-md ring-1 ring-white/15"
          :style="{ background: t.swatch }"
        />
        <span class="text-xs font-medium" :class="item?.themeId === t.id ? 'text-ink-50' : 'text-ink-300'">
          {{ t.name }}
        </span>
      </button>
    </div>
  </PanelSection>
</template>
