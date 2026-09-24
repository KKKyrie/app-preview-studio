<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    modelValue: number
    min: number
    max: number
    step: number
    format?: (v: number) => string
  }>(),
  {},
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const display = computed(() =>
  props.format ? props.format(props.modelValue) : String(props.modelValue),
)

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <label class="block select-none">
    <div class="mb-1 flex items-center justify-between text-[11px]">
      <span class="text-ink-400">{{ label }}</span>
      <span class="tabular-nums text-ink-300">{{ display }}</span>
    </div>
    <input
      type="range"
      class="w-full cursor-pointer"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      @input="onInput"
    />
  </label>
</template>
