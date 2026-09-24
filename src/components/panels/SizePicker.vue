<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { SIZES } from '@/constants/sizes'
import type { ScreenshotSize, SizeGroup } from '@/types'
import { useProjectStore } from '@/stores/project'

import ChoiceChip from '@/components/ui/ChoiceChip.vue'
import PanelSection from '@/components/ui/PanelSection.vue'

const store = useProjectStore()
const group = ref<SizeGroup>(store.size.group)

watch(
  () => store.sizeId,
  () => {
    group.value = store.size.group
  },
)

const displays = computed(() => {
  const map = new Map<string, ScreenshotSize[]>()
  for (const s of SIZES) {
    if (s.group !== group.value) continue
    const list = map.get(s.display) ?? []
    list.push(s)
    map.set(s.display, list)
  }
  return Array.from(map, ([display, sizes]) => ({ display, sizes }))
})

</script>

<template>
  <PanelSection title="导出尺寸" hint="App Store Connect 实测">
    <!-- 设备组 -->
    <div class="mb-3 grid grid-cols-2 gap-1.5 rounded-lg bg-surface-850 p-1">
      <ChoiceChip :active="group === 'iphone'" class="!py-1.5 text-center" @click="group = 'iphone'">
        iPhone
      </ChoiceChip>
      <ChoiceChip :active="group === 'ipad'" class="!py-1.5 text-center" @click="group = 'ipad'">
        iPad
      </ChoiceChip>
    </div>

    <!-- 尺寸列表 -->
    <div class="space-y-3">
      <div v-for="d in displays" :key="d.display">
        <div class="mb-1.5 flex items-center gap-2">
          <span class="text-[11px] font-medium text-ink-300">{{ d.display }} 显示器</span>
          <span class="h-px flex-1 bg-line-800" />
        </div>
        <div class="space-y-1.5">
          <button
            v-for="s in d.sizes"
            :key="s.id"
            type="button"
            class="w-full rounded-lg border px-3 py-2 text-left transition"
            :class="
              store.sizeId === s.id
                ? 'border-brand-500 bg-brand-500/15 shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
                : 'border-line-700 bg-surface-800 hover:border-surface-600'
            "
            @click="store.sizeId = s.id"
          >
            <div class="flex items-center justify-between gap-2">
              <span
                class="text-sm font-semibold tabular-nums"
                :class="store.sizeId === s.id ? 'text-ink-50' : 'text-ink-100'"
              >
                {{ s.width }} × {{ s.height }}
              </span>
            </div>
            <div class="mt-0.5 truncate text-[10px] text-ink-500">{{ s.devices }}</div>
          </button>
        </div>
      </div>
    </div>

    <!-- 方向 -->
    <div class="mt-3 grid grid-cols-2 gap-1.5 rounded-lg bg-surface-850 p-1">
      <ChoiceChip
        :active="store.orientation === 'portrait'"
        class="!py-1.5 text-center"
        @click="store.orientation = 'portrait'"
      >
        竖屏
      </ChoiceChip>
      <ChoiceChip
        :active="store.orientation === 'landscape'"
        class="!py-1.5 text-center"
        @click="store.orientation = 'landscape'"
      >
        横屏
      </ChoiceChip>
    </div>
  </PanelSection>
</template>
