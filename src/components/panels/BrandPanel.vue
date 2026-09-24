<script setup lang="ts">
import { computed, ref } from 'vue'

import { useProjectStore } from '@/stores/project'

import PanelSection from '@/components/ui/PanelSection.vue'
import RangeField from '@/components/ui/RangeField.vue'

const store = useProjectStore()
const brand = computed(() => store.brand)
const canvasW = computed(() => store.canvasSize.width)

const logoEl = ref<HTMLInputElement | null>(null)

function pickLogo() {
  logoEl.value?.click()
}

/** 读取 logo 文件 → dataURL 写入 store（持久化由 usePersistence 处理） */
function onLogoFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件（PNG / JPG / SVG 等）')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result === 'string') store.patchBrand({ logo: reader.result })
  }
  reader.readAsDataURL(file)
}

function removeLogo() {
  store.patchBrand({ logo: null })
}
</script>

<template>
  <PanelSection title="品牌" hint="显示在主标题上方">
    <div class="space-y-2.5">
      <!-- 名字 -->
      <input
        :value="brand.name"
        type="text"
        class="w-full rounded-lg border border-line-700 bg-surface-850 px-3 py-2 text-sm text-ink-100 outline-none transition placeholder:text-ink-500 focus:border-brand-500"
        placeholder="品牌名 / App 名称"
        @input="store.patchBrand({ name: ($event.target as HTMLInputElement).value })"
      />

      <!-- Logo 上传 -->
      <input ref="logoEl" type="file" accept="image/*" class="hidden" @change="onLogoFile" />
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="flex-1 rounded-md bg-surface-700 py-1.5 text-[11px] text-ink-200 transition hover:bg-surface-600"
          @click="pickLogo"
        >
          {{ brand.logo ? '更换 Logo' : '上传 Logo' }}
        </button>
        <button
          v-if="brand.logo"
          type="button"
          class="rounded-md bg-surface-700 px-3 py-1.5 text-[11px] text-ink-300 transition hover:bg-surface-600"
          @click="removeLogo"
        >
          移除
        </button>
      </div>

      <!-- Logo 预览（圆角与画布同步） -->
      <div
        v-if="brand.logo"
        class="flex h-14 items-center justify-center rounded-lg border border-line-700 bg-surface-850 p-2"
      >
        <img
          :src="brand.logo"
          alt="logo 预览"
          class="max-h-full max-w-full object-contain"
          :style="{ borderRadius: `${brand.logoRadius * 100}%` }"
        />
      </div>

      <RangeField
        v-if="brand.logo"
        label="Logo 圆角"
        :min="0"
        :max="0.5"
        :step="0.01"
        :model-value="brand.logoRadius"
        :format="(v) => `${Math.round(v * 100)}%`"
        @update:model-value="(v) => store.patchBrand({ logoRadius: v })"
      />

      <template v-if="brand.logo || brand.name">
        <RangeField
          label="Logo 高度"
          :min="0.02"
          :max="0.1"
          :step="0.002"
          :model-value="brand.logoSize"
          :format="(v) => `${Math.round(v * canvasW)} px`"
          @update:model-value="(v) => store.patchBrand({ logoSize: v })"
        />
        <RangeField
          label="品牌名字号"
          :min="0.015"
          :max="0.08"
          :step="0.001"
          :model-value="brand.nameSize"
          :format="(v) => `${Math.round(v * canvasW)} px`"
          @update:model-value="(v) => store.patchBrand({ nameSize: v })"
        />
      </template>

      <p v-if="!brand.logo && !brand.name" class="text-[10px] leading-relaxed text-ink-500">
        填写品牌名或上传 Logo 后，会在每张截图的主标题上方展示品牌行。
      </p>
    </div>
  </PanelSection>
</template>
