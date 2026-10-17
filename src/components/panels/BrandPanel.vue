<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAssetStore } from '@/stores/assetStore'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'

import PanelSection from '@/components/ui/PanelSection.vue'
import RangeField from '@/components/ui/RangeField.vue'

const store = useAssetStore()
const project = useProjectStore()
const brand = computed(() => store.brand)
/**
 * px 读数基准 = `designWidth`，不是画布宽度。
 *
 * logo 高度按**安全区宽度**渲染（标题图上 0.055 × 1646 ≈ 91px），
 * 若读数用画布宽度就会显示成 0.055 × 3840 ≈ 211px —— 与画布实际渲染差 2.3 倍。
 * 截图模式下 designWidth === 画布宽度，行为不变。
 */
const designW = computed(() => store.designWidth)

/** 两种工作台的措辞不同：「每张截图」/「每个变体」 */
const itemNoun = computed(() => (mode.value === 'creative' ? '变体' : '截图'))

const copied = ref(false)

/** 品牌在两种素材间独立存储，这里提供一次性的复制，省去重复上传 logo */
function copyFromScreenshots() {
  const src = project.brand
  if (!src.logo && !src.name.trim()) return
  store.patchBrand({ ...src })
  copied.value = true
  setTimeout(() => (copied.value = false), 2500)
}

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
          draggable="false"
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
          :format="(v) => `${Math.round(v * designW)} px`"
          @update:model-value="(v) => store.patchBrand({ logoSize: v })"
        />
        <RangeField
          label="品牌名字号"
          :min="0.015"
          :max="0.08"
          :step="0.001"
          :model-value="brand.nameSize"
          :format="(v) => `${Math.round(v * designW)} px`"
          @update:model-value="(v) => store.patchBrand({ nameSize: v })"
        />
      </template>

      <p v-if="!brand.logo && !brand.name" class="text-[10px] leading-relaxed text-ink-500">
        填写品牌名或上传 Logo 后，会在每张{{ itemNoun }}的主标题上方展示品牌行。
      </p>

      <!-- 创意素材的品牌独立存储，可从截图项目一键复制，避免重复上传 logo -->
      <template v-if="mode === 'creative' && !brand.logo && !brand.name">
        <button
          type="button"
          class="w-full rounded-md border border-line-700 py-1.5 text-[11px] text-ink-300 transition hover:border-surface-600 hover:text-ink-100"
          @click="copyFromScreenshots"
        >
          ⟲ 从「App 预览截图」复制品牌
        </button>
        <p v-if="copied" class="text-[10px] text-emerald-300">已复制截图项目的品牌设置</p>
      </template>
    </div>
  </PanelSection>
</template>
