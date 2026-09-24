<script setup lang="ts">
import { computed } from 'vue'

import PanelSection from '@/components/ui/PanelSection.vue'
import ScreenshotCanvas from '@/components/stage/ScreenshotCanvas.vue'
import { MAX_ITEMS, useProjectStore } from '@/stores/project'

const store = useProjectStore()

const THUMB_W = 64

const boxStyle = computed(() => {
  const { width, height } = store.canvasSize
  return {
    width: `${THUMB_W}px`,
    height: `${Math.round((THUMB_W * height) / width)}px`,
  }
})

const innerStyle = computed(() => ({
  transform: `scale(${THUMB_W / store.canvasSize.width})`,
  transformOrigin: 'top left',
}))

const canAdd = computed(() => store.items.length < MAX_ITEMS)
const canRemove = computed(() => store.items.length > 1)

function add() {
  store.addScreenshot()
}
function duplicate() {
  if (store.activeItemId) store.duplicateItem(store.activeItemId)
}
function remove() {
  if (store.activeItemId) store.removeItem(store.activeItemId)
}
</script>

<template>
  <PanelSection title="截图组" :hint="`${store.items.length} / ${MAX_ITEMS}`">
    <div class="flex flex-wrap gap-1.5">
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
        :title="`截图 ${i + 1}`"
        @click="store.select(it.id)"
      >
        <span class="absolute inset-0 block overflow-hidden bg-surface-950">
          <span :style="innerStyle" class="block">
            <ScreenshotCanvas :item="it" :width="store.canvasSize.width" :height="store.canvasSize.height" :brand="store.brand" />
          </span>
        </span>
        <span
          class="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] leading-3 text-white"
        >
          {{ i + 1 }}
        </span>
        <span
          v-if="!it.image"
          class="absolute top-0.5 right-0.5 rounded bg-amber-500/80 px-1 text-[8px] leading-3.5 text-black"
        >
          示例
        </span>
      </button>
    </div>

    <div class="mt-2 grid grid-cols-3 gap-1.5">
      <button
        type="button"
        class="rounded-md bg-brand-500/15 py-1.5 text-[11px] text-brand-300 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canAdd"
        @click="add"
      >
        ＋ 新增
      </button>
      <button
        type="button"
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canAdd"
        @click="duplicate"
      >
        ⧉ 复制
      </button>
      <button
        type="button"
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canRemove"
        @click="remove"
      >
        🗑 删除
      </button>
    </div>
  </PanelSection>
</template>
