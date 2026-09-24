<script setup lang="ts">
withDefaults(defineProps<{ id: string; active?: boolean }>(), { active: false })
</script>

<template>
  <!-- 布局缩略示意图：外框=画布，色块=手机，横线=文字 -->
  <svg viewBox="0 0 44 68" class="h-11 w-auto" aria-hidden>
    <rect
      x="1"
      y="1"
      width="42"
      height="66"
      rx="4"
      fill="none"
      :stroke="active ? '#5b8cff' : '#363a46'"
      stroke-width="1.5"
    />

    <g v-if="id === 'text-top'">
      <rect x="11" y="8" width="22" height="3" rx="1.5" :fill="active ? '#86a8ff' : '#6b7080'" />
      <rect x="14" y="14" width="16" height="2.5" rx="1.25" :fill="active ? '#86a8ff' : '#6b7080'" opacity="0.7" />
      <rect x="15" y="26" width="14" height="38" rx="4" :fill="active ? '#3b6fff' : '#363a46'" />
    </g>

    <g v-else-if="id === 'text-bottom'">
      <rect x="15" y="4" width="14" height="38" rx="4" :fill="active ? '#3b6fff' : '#363a46'" />
      <rect x="11" y="50" width="22" height="3" rx="1.5" :fill="active ? '#86a8ff' : '#6b7080'" />
      <rect x="14" y="56" width="16" height="2.5" rx="1.25" :fill="active ? '#86a8ff' : '#6b7080'" opacity="0.7" />
    </g>

    <g v-else-if="id === 'text-side'">
      <rect x="6" y="20" width="14" height="3" rx="1.5" :fill="active ? '#86a8ff' : '#6b7080'" />
      <rect x="6" y="26" width="11" height="2.5" rx="1.25" :fill="active ? '#86a8ff' : '#6b7080'" opacity="0.7" />
      <rect x="6" y="31" width="13" height="2.5" rx="1.25" :fill="active ? '#86a8ff' : '#6b7080'" opacity="0.7" />
      <rect x="26" y="13" width="13" height="42" rx="4" :fill="active ? '#3b6fff' : '#363a46'" />
    </g>

    <g v-else-if="id === 'bleed-bottom'">
      <rect x="9" y="8" width="26" height="3" rx="1.5" :fill="active ? '#86a8ff' : '#6b7080'" />
      <rect x="12" y="14" width="20" height="2.5" rx="1.25" :fill="active ? '#86a8ff' : '#6b7080'" opacity="0.7" />
      <rect x="8" y="28" width="28" height="40" rx="5" :fill="active ? '#3b6fff' : '#363a46'" />
    </g>

    <g v-else-if="id === 'center-hold'">
      <rect x="11" y="7" width="22" height="3" rx="1.5" :fill="active ? '#86a8ff' : '#6b7080'" />
      <rect x="15" y="20" width="14" height="30" rx="4" :fill="active ? '#3b6fff' : '#363a46'" />
      <rect x="11" y="58" width="22" height="2.5" rx="1.25" :fill="active ? '#86a8ff' : '#6b7080'" opacity="0.7" />
    </g>

    <g v-else-if="id === 'multi-phone'">
      <rect x="11" y="7" width="22" height="3" rx="1.5" :fill="active ? '#86a8ff' : '#6b7080'" />
      <rect x="4" y="30" width="12" height="30" rx="4" :fill="active ? '#2c55d6' : '#2a2d37'" />
      <rect x="28" y="30" width="12" height="30" rx="4" :fill="active ? '#2c55d6' : '#2a2d37'" />
      <rect x="16" y="24" width="13" height="40" rx="4" :fill="active ? '#3b6fff' : '#363a46'" />
    </g>
  </svg>
</template>
