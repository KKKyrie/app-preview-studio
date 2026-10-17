<script setup lang="ts">
import { computed } from 'vue'

import { PLACEMENTS, type CanvasOption } from '@/constants/placements'
import { usePlacementStore } from '@/stores/assetStore'
import { mode } from '@/stores/mode'

import PanelSection from '@/components/ui/PanelSection.vue'

const store = usePlacementStore()

const isCrop = computed(() => mode.value === 'crop')

/** 安全区占画布面积的比例——直观反映「这块画布有多难排」 */
function areaRatio(c: CanvasOption): string {
  const r = (c.safeArea.width * c.safeArea.height) / (c.width * c.height)
  return `${(r * 100).toFixed(1)}%`
}

function isCurrent(c: CanvasOption): boolean {
  return store.canvasSize.width === c.width && store.canvasSize.height === c.height
}
</script>

<template>
  <PanelSection title="坑位与尺寸" :hint="isCrop ? '决定裁剪画框的比例' : '决定画布与安全区'">
    <div class="space-y-4">
      <div v-for="p in PLACEMENTS" :key="p.id">
        <!-- 坑位标题 -->
        <div class="mb-1.5 flex items-baseline justify-between gap-2">
          <span
            class="text-xs font-semibold"
            :class="store.placementId === p.id ? 'text-brand-300' : 'text-ink-300'"
          >
            {{ p.name }}
          </span>
          <span class="text-[10px] text-ink-600">{{ p.ascName }}</span>
        </div>
        <p class="mb-2 text-[10px] leading-relaxed text-ink-500">{{ p.note }}</p>

        <!-- 该坑位支持的尺寸 -->
        <div class="space-y-1.5">
          <button
            v-for="c in p.canvasOptions"
            :key="`${p.id}-${c.width}x${c.height}`"
            type="button"
            class="w-full rounded-lg border px-3 py-2 text-left transition"
            :class="
              store.placementId === p.id && isCurrent(c)
                ? 'border-brand-500 bg-brand-500/15 shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
                : 'border-line-700 bg-surface-800 hover:border-surface-600'
            "
            :data-canvas-opt="`${p.id}:${c.width}x${c.height}`"
            @click="store.setPlacement(p.id); store.setCanvas(c)"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-sm font-semibold tabular-nums"
                :class="
                  store.placementId === p.id && isCurrent(c) ? 'text-ink-50' : 'text-ink-100'
                "
              >
                {{ c.label }}
              </span>
              <span class="rounded bg-surface-700 px-1.5 py-0.5 text-[10px] text-ink-300">
                {{ c.aspect }}
              </span>
            </div>

            <div class="mt-1 text-[10px] text-ink-500">
              安全区 {{ c.safeArea.width }}×{{ c.safeArea.height }} · 占画布 {{ areaRatio(c) }}
              <span v-if="c.safeAreaSource === 'derived'" title="由同比例的实测画布等比推导">
                ·推导
              </span>
            </div>

            <div
              v-if="c.universal"
              class="mt-1 text-[10px] leading-relaxed text-amber-400/90"
            >
              · 一份文件同时填标题图与搜索结果图
            </div>

            <div v-if="c.note" class="mt-1 text-[10px] leading-relaxed text-ink-500">
              ⚠ {{ c.note }}
            </div>

            <div v-if="c.formats.length === 1" class="mt-1 text-[10px] text-ink-500">
              · 仅支持 {{ c.formats[0] }}
            </div>
          </button>
        </div>
      </div>
    </div>

    <p class="mt-3 border-t border-line-800 pt-2.5 text-[10px] leading-relaxed text-ink-500">
      标题图与搜索结果图各有两种尺寸；其中 5244 × 2950 为两个坑位共用，
      在 App Store Connect 可勾选「Use header asset in search results」。
      安全区数值由本工具解析 Apple 官方 Sketch 模板实测得到（Apple 不公布像素值）。
    </p>
    <p v-if="isCrop" class="mt-2 text-[10px] leading-relaxed text-amber-400/80">
      ⚠ 裁剪画框锁定为该尺寸的比例，源图在框内拖动 / 缩放——
      不同比例的成品必须分别裁剪，不能一份通用。
    </p>
  </PanelSection>
</template>