<script setup lang="ts">
import { computed, ref } from 'vue'

import CropCanvas from '@/components/stage/CropCanvas.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import { useCropImport } from '@/composables/useCropImport'
import { MAX_CROP_ITEMS, useCropStore } from '@/stores/crop'

/**
 * 裁剪列表：一次导入一批成品图，逐张调构图。
 *
 * 缩略图直接用 `CropCanvas` 渲染（不是原图），因此列表里看到的就是
 * 「这张图裁出来长什么样」——用原图当缩略图会让人误判构图。
 */
const store = useCropStore()
const { importFiles } = useCropImport()
const fileEl = ref<HTMLInputElement | null>(null)

const THUMB_W = 96

/** 缩略图按画框比例给宽，Banner 素材是超宽条 */
const boxStyle = computed(() => ({
  width: `${THUMB_W}px`,
  height: `${Math.max(26, Math.round((THUMB_W * store.canvasSize.height) / store.canvasSize.width))}px`,
}))

const innerStyle = computed(() => ({
  transform: `scale(${THUMB_W / store.canvasSize.width})`,
  transformOrigin: 'top left',
}))

const filled = computed(() => store.items.filter((i) => i.image).length)
/** 删到一条不剩是允许的（0 条是合法状态，见 store.removeItem） */
const canRemove = computed(() => store.items.length > 0)
const canAdd = computed(() => store.items.length < MAX_CROP_ITEMS)
const notice = ref('')

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  const s = await importFiles(files)
  notice.value = s.full ? `已达上限 ${MAX_CROP_ITEMS} 张，${s.full} 张未导入` : ''
}
</script>

<template>
  <PanelSection title="图片" :hint="`${filled} / ${MAX_CROP_ITEMS} 张`">
    <div
      v-if="!store.items.length"
      data-crop-empty
      class="rounded-md border border-dashed border-line-700 px-3 py-4 text-center"
    >
      <p class="text-[11px] text-ink-400">还没有图片</p>
      <p class="mt-1 text-[10px] leading-relaxed text-ink-500">
        用下面的「导入图片」，或直接把图拖进窗口 / ⌘V 粘贴
      </p>
    </div>

    <div v-else class="flex flex-col gap-1.5">
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
        :title="`图片 ${i + 1}${it.imageName ? ` · ${it.imageName}` : ' · 空位'}`"
        :data-crop-item="i"
        @click="store.select(it.id)"
      >
        <template v-if="it.image">
          <span class="absolute inset-0 block overflow-hidden bg-surface-950">
            <span :style="innerStyle" class="block">
              <CropCanvas
                :item="it"
                :width="store.canvasSize.width"
                :height="store.canvasSize.height"
                :overlay="false"
              />
            </span>
          </span>
        </template>
        <span
          v-else
          class="absolute inset-0 flex items-center justify-center border border-dashed border-line-700 text-[10px] text-ink-500"
        >
          空位 · 拖入图片
        </span>
        <span
          class="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] leading-3 text-white"
        >
          {{ i + 1 }}
        </span>
      </button>
    </div>

    <div class="mt-2 grid grid-cols-2 gap-1.5">
      <button
        type="button"
        data-crop-import
        class="rounded-md bg-brand-500/15 py-1.5 text-[11px] text-brand-300 transition hover:bg-brand-500/25 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canAdd"
        @click="fileEl?.click()"
      >
        ＋ 导入图片
      </button>
      <button
        type="button"
        data-crop-remove
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canRemove"
        :title="canRemove ? '移除当前这张（列表可以删空）' : '列表已空'"
        @click="store.removeItem(store.activeItemId)"
      >
        🗑 删除
      </button>
      <input
        ref="fileEl"
        data-crop-file-input
        type="file"
        accept="image/*"
        multiple
        class="hidden"
        @change="onPick"
      />
    </div>

    <p v-if="notice" class="mt-2 text-[10px] leading-relaxed text-amber-300">{{ notice }}</p>

    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
      可一次导入多张（也可以直接拖进窗口 / ⌘V 粘贴）。每张图各自记忆构图，
      切换画框尺寸时构图按比例保留。
    </p>
  </PanelSection>
</template>
