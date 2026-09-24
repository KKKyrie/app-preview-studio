<script setup lang="ts">
import { computed } from 'vue'

import { FRAMES } from '@/data/frames'
import { useProjectStore } from '@/stores/project'

import ChoiceChip from '@/components/ui/ChoiceChip.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import RangeField from '@/components/ui/RangeField.vue'
import ToggleSwitch from '@/components/ui/ToggleSwitch.vue'

const store = useProjectStore()
const item = computed(() => store.activeItem)
const frame = computed(() => FRAMES.find((f) => f.id === item.value?.frameId) ?? FRAMES[0])

function setColor(key: string) {
  store.patchActive({ frame: { ...item.value!.frame, color: key } })
}
</script>

<template>
  <PanelSection title="手机边框" hint="纯代码自绘">
    <div class="grid grid-cols-2 gap-1.5">
      <ChoiceChip
        v-for="f in FRAMES"
        :key="f.id"
        :active="frame.id === f.id"
        :title="f.hint"
        @click="store.setFrame(f.id)"
      >
        {{ f.name }}
      </ChoiceChip>
    </div>
    <p class="mt-2 text-[10px] leading-relaxed text-ink-500">{{ frame.hint }}</p>

    <!-- 机身材质 -->
    <div class="mt-3 flex items-center gap-2">
      <span class="text-[11px] text-ink-400">材质</span>
      <button
        v-for="c in frame.colors"
        :key="c.key"
        type="button"
        class="h-6 w-6 rounded-full transition"
        :class="
          item?.frame.color === c.key
            ? 'ring-2 ring-brand-400 ring-offset-2 ring-offset-surface-900'
            : 'ring-1 ring-white/20 hover:ring-white/40'
        "
        :style="{ background: c.body }"
        :title="c.name"
        @click="setColor(c.key)"
      />
    </div>

    <!-- 开关 -->
    <div class="mt-3 space-y-2.5">
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-ink-400">投影</span>
        <ToggleSwitch v-model="item!.frame.shadow" />
      </div>
      <div class="flex items-center justify-between">
        <span class="text-[11px] text-ink-400">状态栏（9:41）</span>
        <ToggleSwitch v-model="item!.frame.statusBar" />
      </div>
      <RangeField
        label="倾斜角度"
        :min="-20"
        :max="20"
        :step="0.5"
        :model-value="item?.frame.tilt ?? 0"
        :format="(v) => `${v}°`"
        @update:model-value="(v) => (item!.frame.tilt = v)"
      />
    </div>
  </PanelSection>
</template>
