<script setup lang="ts">
import { computed } from 'vue'

import { BANNER_LAYOUTS } from '@/data/bannerLayouts'
import { useCreativeStore } from '@/stores/creative'

import PanelSection from '@/components/ui/PanelSection.vue'
import ParamSliders from '@/components/panels/ParamSliders.vue'

const store = useCreativeStore()

const layout = computed(
  () => BANNER_LAYOUTS.find((l) => l.id === store.activeItem.bannerLayoutId) ?? BANNER_LAYOUTS[0],
)
</script>

<template>
  <PanelSection title="版式" :hint="`${BANNER_LAYOUTS.length} 种`">
    <div class="space-y-1.5">
      <button
        v-for="l in BANNER_LAYOUTS"
        :key="l.id"
        type="button"
        :data-layout="l.id"
        class="w-full rounded-lg border px-3 py-2 text-left transition"
        :class="
          store.activeItem.bannerLayoutId === l.id
            ? 'border-brand-500 bg-brand-500/15 shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
            : 'border-line-700 bg-surface-800 hover:border-surface-600'
        "
        @click="store.setLayout(l.id)"
      >
        <!-- 结构示意：安全区框 + 文字块 / 图片块 -->
        <div
          class="mb-1.5 flex h-8 items-center overflow-hidden rounded bg-black/25 px-1"
        >
          <div class="relative h-full w-full">
            <!-- 安全区 -->
            <div
              class="absolute rounded-sm border border-dashed border-white/25"
              :style="{
                left: `${store.safeArea.x / store.canvasSize.width * 100}%`,
                top: `${store.safeArea.y / store.canvasSize.height * 100}%`,
                width: `${(store.safeArea.width / store.canvasSize.width) * 100}%`,
                height: `${(store.safeArea.height / store.canvasSize.height) * 100}%`,
              }"
            />
            <template v-if="l.id === 'text-left'">
              <div class="absolute top-1/2 left-[30%] h-1.5 w-5 -translate-y-1/2 rounded-sm bg-white/55" />
              <div class="absolute top-1/2 right-[8%] h-5 w-6 -translate-y-1/2 rounded-sm bg-white/30" />
            </template>
            <template v-else-if="l.id === 'text-top'">
              <div class="absolute top-[38%] left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-sm bg-white/55" />
              <div class="absolute bottom-0 left-1/2 h-4 w-12 -translate-x-1/2 rounded-t-sm bg-white/30" />
            </template>
            <template v-else-if="l.id === 'full-bleed'">
              <div class="absolute inset-0 rounded-sm bg-white/22" />
              <div class="absolute top-1/2 left-1/2 h-1.5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white/65" />
            </template>
            <template v-else>
              <div class="absolute top-1/2 left-1/2 h-1.5 w-10 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-white/65" />
              <div class="absolute top-[68%] left-1/2 h-1 w-7 -translate-x-1/2 rounded-sm bg-white/40" />
            </template>
          </div>
        </div>

        <div class="flex items-center justify-between gap-2">
          <span
            class="text-xs font-medium"
            :class="store.activeItem.bannerLayoutId === l.id ? 'text-ink-50' : 'text-ink-200'"
          >
            {{ l.name }}
          </span>
          <!-- 把「这个版式用不用主体图」摆在明面上：否则用户传了图却看不到，只会以为是 bug -->
          <span
            class="shrink-0 rounded px-1.5 py-0.5 text-[9px] leading-3"
            :class="
              l.usesImage ? 'bg-brand-500/20 text-brand-300' : 'bg-surface-700 text-ink-400'
            "
          >
            {{ l.usesImage ? '用图' : '纯排版' }}
          </span>
        </div>
      </button>
    </div>

    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">{{ layout.hint }}</p>

    <div class="mt-3 border-t border-line-800 pt-3">
      <ParamSliders
        :fields="layout.fields"
        :values="{ ...layout.defaults, ...store.activeItem.params }"
        @update="(k, v) => store.setParam(k, v)"
      />
      <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
        参数以安全区为基准，因此换坑位时版式等比缩放、无需重调。
      </p>
    </div>
  </PanelSection>
</template>