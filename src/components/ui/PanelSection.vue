<script setup lang="ts">
defineProps<{ title: string; hint?: string }>()
</script>

<template>
  <section>
    <header class="mb-2.5 flex items-baseline justify-between">
      <h3 class="text-xs font-semibold tracking-wider text-ink-400">{{ title }}</h3>
      <span v-if="hint" class="text-[10px] text-ink-500">{{ hint }}</span>
    </header>
    <slot />
  </section>
</template>
