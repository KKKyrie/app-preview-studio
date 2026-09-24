<script setup lang="ts">
import type { LayoutField } from '@/data/layouts'

import RangeField from '@/components/ui/RangeField.vue'

const props = defineProps<{
  fields: LayoutField[]
  values: Record<string, number>
}>()

const emit = defineEmits<{ update: [key: string, value: number] }>()

const percent = (v: number) => `${(v * 100).toFixed(1)}%`

function valueOf(key: string): number {
  return props.values[key] ?? 0
}
</script>

<template>
  <div class="space-y-3">
    <RangeField
      v-for="f in fields"
      :key="f.key"
      :label="f.label"
      :min="f.min"
      :max="f.max"
      :step="f.step"
      :model-value="valueOf(f.key)"
      :format="percent"
      @update:model-value="emit('update', f.key, $event)"
    />
  </div>
</template>
