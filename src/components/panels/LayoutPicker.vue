<script setup lang="ts">
import { computed } from 'vue'

import { LAYOUTS } from '@/data/layouts'
import { useProjectStore } from '@/stores/project'

import PanelSection from '@/components/ui/PanelSection.vue'
import LayoutIcon from './LayoutIcon.vue'
import ParamSliders from './ParamSliders.vue'

const store = useProjectStore()

const item = computed(() => store.activeItem)
const layout = computed(() => LAYOUTS.find((l) => l.id === item.value?.layoutId) ?? LAYOUTS[0])

const values = computed(() =>
  Object.fromEntries(
    layout.value.fields.map((f) => [f.key, item.value?.params[f.key] ?? layout.value.defaults[f.key]]),
  ),
)
</script>

<template>
  <PanelSection title="版式布局" hint="文字 + 截图">
    <div class="grid grid-cols-3 gap-1.5">
      <button
        v-for="l in LAYOUTS"
        :key="l.id"
        type="button"
        class="flex flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2.5 transition"
        :class="
          layout.id === l.id
            ? 'border-brand-500 bg-brand-500/15 shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
            : 'border-line-700 bg-surface-800 hover:border-surface-600'
        "
        :title="l.hint"
        @click="store.setLayout(l.id)"
      >
        <LayoutIcon :id="l.id" :active="layout.id === l.id" />
        <span
          class="text-[10px]"
          :class="layout.id === l.id ? 'font-medium text-ink-100' : 'text-ink-400'"
        >
          {{ l.name }}
        </span>
      </button>
    </div>

    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">{{ layout.hint }}</p>

    <div class="mt-3">
      <ParamSliders
        :fields="layout.fields"
        :values="values"
        @update="(key, value) => store.setParam(key, value)"
      />
    </div>
  </PanelSection>
</template>
