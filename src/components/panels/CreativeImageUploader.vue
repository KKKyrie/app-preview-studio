<script setup lang="ts">
import { computed, ref } from 'vue'

import { firstImageLayout, getBannerLayout } from '@/data/bannerLayouts'
import { useCreativeStore } from '@/stores/creative'

import PanelSection from '@/components/ui/PanelSection.vue'
import RangeField from '@/components/ui/RangeField.vue'

/**
 * 创意素材的「主体图」上传。
 *
 * 与截图模式的 App 截图语义不同：主体图是**可选**的——Apple 明确允许
 * 纯品牌 / 纯排版素材（"express your brand, seasonal offerings, new content"），
 * 所以这里明确告诉用户「不上传也可以」，而不是把它做成必填项。
 *
 * ⚠️ 但「可选」不等于「可以默默无效」：版式里有一个（居中主张）不绘制主体图，
 * 若不做任何说明，用户上传后会看到画布毫无变化并判定为 bug。因此这里**始终**
 * 显示当前版式与主体图的关系，不匹配时给一键切换。
 */
const store = useCreativeStore()
const fileEl = ref<HTMLInputElement | null>(null)
const item = computed(() => store.activeItem)

const currentLayout = computed(() => getBannerLayout(item.value?.bannerLayoutId ?? ''))
const imageLayout = computed(() => firstImageLayout())

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
  // setImage 会在当前版式不画图时自动切换到用图版式（见 store 注释）
  store.setImage(await readFileAsDataUrl(file), file.name)
}

function clear() {
  store.setImage(null, null)
}
</script>

<template>
  <PanelSection title="主体图" hint="可选 · 拖拽 / ⌘V 粘贴">
    <input ref="fileEl" type="file" accept="image/*" class="hidden" @change="onPick" />

    <div
      class="rounded-lg border border-dashed border-line-700 bg-surface-850 px-3 py-3 transition hover:border-brand-500/60"
    >
      <template v-if="item?.image">
        <div class="flex items-center gap-2.5">
          <img
            :src="item.image"
            alt=""
            draggable="false"
            class="h-10 w-auto max-w-16 rounded object-cover ring-1 ring-white/15"
          />
          <div class="min-w-0 flex-1">
            <div class="truncate text-[11px] text-ink-300">{{ item.imageName ?? '已导入图片' }}</div>
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

    <RangeField
      v-if="item?.image"
      class="mt-3"
      label="主体图圆角"
      :min="0"
      :max="0.5"
      :step="0.01"
      :model-value="item.imageRadius"
      :format="(v) => `${Math.round(v * 100)}%`"
      @update:model-value="(v) => store.patchActive({ imageRadius: v })"
    />

    <!-- 版式与主体图的关系：不匹配必须给出口，否则「上传了却看不到」只能被判成 bug -->
    <div v-if="item?.image" class="mt-3">
      <p v-if="store.layoutUsesImage" class="text-[10px] leading-relaxed text-emerald-400/90">
        ✓ 当前版式「{{ currentLayout.name }}」会展示主体图
      </p>
      <div v-else class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-2">
        <p class="text-[10px] leading-relaxed text-amber-200">
          ⚠ 当前版式「{{ currentLayout.name }}」不展示主体图
        </p>
        <button
          type="button"
          data-use-image-layout
          class="mt-1.5 w-full rounded-md bg-amber-500/20 py-1.5 text-[11px] text-amber-100 transition hover:bg-amber-500/30"
          @click="store.setLayout(imageLayout.id)"
        >
          切到「{{ imageLayout.name }}」展示主体图
        </button>
      </div>
    </div>

    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">
      不上传也可以——Apple 允许纯品牌 / 纯排版素材，用「居中主张」版式即可。
      上传时会自动切到会展示它的版式。
    </p>
  </PanelSection>
</template>