<script setup lang="ts">
withDefaults(defineProps<{ active?: boolean; block?: boolean }>(), { active: false, block: false })
</script>

<template>
  <button
    type="button"
    class="rounded-lg border px-3 py-2 text-xs transition"
    :class="[
      block ? 'w-full text-left' : '',
      active
        ? 'border-brand-500 bg-brand-500/15 text-ink-50 shadow-[0_0_0_1px_rgba(59,111,255,0.35)]'
        : 'border-line-700 bg-surface-800 text-ink-300 hover:border-surface-600 hover:text-ink-100',
    ]"
  >
    <slot />
  </button>
</template>
