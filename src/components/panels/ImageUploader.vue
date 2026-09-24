<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProjectStore } from '@/stores/project'

import PanelSection from '@/components/ui/PanelSection.vue'

const store = useProjectStore()
const fileEl = ref<HTMLInputElement | null>(null)
const item = computed(() => store.activeItem)

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !file.type.startsWith('image/')) return
  const dataUrl = await readFileAsDataUrl(file)
  store.patchActive({ image: dataUrl, imageName: file.name })
}

function clear() {
  store.patchActive({ image: null, imageName: null })
}
</script>

<template>
  <PanelSection title="App 截图" hint="拖拽 / ⌘V 粘贴">
    <input ref="fileEl" type="file" accept="image/*" class="hidden" @change="onPick" />

    <div
      class="rounded-lg border border-dashed border-line-700 bg-surface-850 px-3 py-3 transition hover:border-brand-500/60"
    >
      <template v-if="item?.image">
        <div class="flex items-center gap-2.5">
          <img
            :src="item.image"
            alt=""
            class="h-10 w-auto max-w-16 rounded object-cover ring-1 ring-white/15"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-[11px] text-ink-300">{{ item.imageName ?? '已导入截图' }}</div>
            <div class="text-[10px] text-ink-500">已导入</div>
          </div>
        </div>
        <div class="mt-2.5 flex gap-1.5">
          <button
            type="button"
            class="flex-1 rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600"
            @click="fileEl?.click()"
          >
            更换图片
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-[11px] text-ink-400 transition hover:text-ink-200"
            @click="clear"
          >
            移除
          </button>
        </div>
      </template>

      <button
        v-else
        type="button"
        class="w-full py-1 text-center text-[11px] text-ink-400 transition hover:text-ink-200"
        @click="fileEl?.click()"
      >
        点击选择图片，或直接拖拽 / 粘贴到窗口
      </button>
    </div>
  </PanelSection>
</template>
