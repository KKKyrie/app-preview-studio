<script setup lang="ts">
const props = defineProps<{
  label: string
  /** 空字符串 = 跟随主题 */
  modelValue: string
  /** 「跟随主题」时展示的默认色 */
  fallback: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<template>
  <div class="flex items-center justify-between gap-2">
    <span class="text-[11px] text-ink-400">{{ label }}</span>
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="text-[10px] text-ink-500 transition hover:text-ink-300"
        :class="modelValue ? 'visible' : 'invisible'"
        @click="emit('update:modelValue', '')"
      >
        跟随主题
      </button>
      <label
        class="relative block h-6 w-6 cursor-pointer overflow-hidden rounded-md ring-1 ring-white/20"
        :style="{ background: modelValue || props.fallback }"
        :title="modelValue || `${label}：跟随主题`"
      >
        <input
          type="color"
          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          :value="modelValue || props.fallback"
          @input="onInput"
        />
      </label>
    </div>
  </div>
</template>
