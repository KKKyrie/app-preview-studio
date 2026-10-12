<script setup lang="ts">
import { ref } from 'vue'

import PanelSection from '@/components/ui/PanelSection.vue'
import { useAssetStore } from '@/stores/assetStore'
import { mode } from '@/stores/mode'
import { deleteImage } from '@/utils/imageStore'

const store = useAssetStore()
const importEl = ref<HTMLInputElement | null>(null)

function exportProject() {
  const snapshot = store.snapshot({ withImages: true })
  const json = JSON.stringify(snapshot, null, 2)
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${store.projectName.replace(/[\\/:*?"<>|]+/g, '_') || 'project'}.aps.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function importProject(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const raw = JSON.parse(await file.text())
    if (!store.hydrate(raw)) alert('文件格式不正确：不是有效的项目文件')
  } catch {
    alert('文件解析失败：请选择由本工具导出的 .aps.json 文件')
  }
}

async function clearAll() {
  const what = mode.value === 'creative' ? '创意素材' : '截图'
  if (!confirm(`确定清空本地保存的${what}项目与所有图片吗？此操作不可恢复。`)) return
  try {
    // 只清当前工作台那一份，另一种素材不受影响
    localStorage.removeItem(store.storageKey)
    for (const item of store.items) await deleteImage(item.id)
    await deleteImage(store.brandKey)
  } finally {
    location.reload()
  }
}
</script>

<template>
  <PanelSection title="项目" hint="自动保存到浏览器">
    <div class="grid grid-cols-2 gap-1.5">
      <button
        type="button"
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600"
        @click="exportProject"
      >
        导出项目 JSON
      </button>
      <button
        type="button"
        class="rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600"
        @click="importEl?.click()"
      >
        导入项目 JSON
      </button>
      <input ref="importEl" type="file" accept=".json,application/json" class="hidden" @change="importProject" />
    </div>
    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
      编辑内容自动保存；导出 JSON 可跨设备迁移项目（含截图）。
    </p>
    <button
      type="button"
      class="mt-2 text-[10px] text-ink-500 transition hover:text-red-400"
      @click="clearAll"
    >
      清空本地数据…
    </button>
  </PanelSection>
</template>
