<script setup lang="ts">
import { computed } from 'vue'

import CreativeCanvas from '@/components/stage/CreativeCanvas.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import { MAX_VARIANTS, useCreativeStore } from '@/stores/creative'

const store = useCreativeStore()

const THUMB_W = 96

/** 缩略图按画布比例给宽，Banner 素材是超宽条 */
const boxStyle = computed(() => ({
  width: `${THUMB_W}px`,
  height: `${Math.max(28, Math.round((THUMB_W * store.canvasSize.height) / store.canvasSize.width))}px`,
}))

const innerStyle = computed(() => ({
  transform: `scale(${THUMB_W / store.canvasSize.width})`,
  transformOrigin: 'top left',
}))

const canAdd = computed(() => store.items.length < MAX_VARIANTS)
const canRemove = computed(() => store.items.length > 1)
</script>

<template>
  <PanelSection title="变体组" :hint="`${store.items.length} / ${MAX_VARIANTS}`">
    <div class="flex flex-col gap-1.5">
      <button
        v-for="(it, i) in store.items"
        :key="it.id"
        type="button"
        class="relative overflow-hidden rounded-md transition"
        :class="
          store.activeItemId === it.id
            ? 'ring-2 ring-brand-400'
            : 'ring-1 ring-line-700 hover:ring-surface-600'
        "
        :style="boxStyle"
        :title="`变体 ${i + 1}`"
        @click="store.select(it.id)"
      >
        <span class="absolute inset-0 block overflow-hidden bg-surface-950">
          <span :style="innerStyle" class="block">
            <CreativeCanvas
              :item="it"
              :width="store.canvasSize.width"
              :height="store.canvasSize.height"
              :safe="store.safeArea"
              :brand="store.brand"
              :overlay="false"
            />
          </span>
        </span>
        <span
          class="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] leading-3 text-white"
        >
          {{ i + 1 }}
        </span>
      </button>
    </div>

    <div class="mt-2 grid grid-cols-3 gap-1.5">
      <button
        type="button"
        class="rounded-md bg-brand-500/15 py-1.5 text-[11px] text-brand-300 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canAdd"
        @click="store.addVariant()"
      >
        ＋ 新增
      </button>
      <button
        type="button"
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canAdd"
        @click="store.duplicateVariant(store.activeItemId)"
      >
        ⧉ 复制
      </button>
      <button
        type="button"
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canRemove"
        @click="store.removeVariant(store.activeItemId)"
      >
        🗑 删除
      </button>
    </div>

    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
      变体对应 App Store Connect 的 Asset Library：预先备好多套（如夏季版 / 冬季版），
      审核通过后上线时直接替换，无需提交新版本。
    </p>
  </PanelSection>
</template>