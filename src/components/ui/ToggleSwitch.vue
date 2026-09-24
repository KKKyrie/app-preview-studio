<script setup lang="ts">
defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
    :class="modelValue ? 'bg-brand-500' : 'bg-surface-600'"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span
      class="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all"
      :class="modelValue ? 'left-3.5' : 'left-0.5'"
    />
  </button>
</template>
