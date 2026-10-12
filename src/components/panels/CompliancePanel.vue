<script setup lang="ts">
import { computed } from 'vue'

import { checkCompliance, hasBlockingIssue } from '@/data/compliance'
import { useCreativeStore } from '@/stores/creative'

import PanelSection from '@/components/ui/PanelSection.vue'

const store = useCreativeStore()

/** 扫描范围：主标题 / 副标题 / 品牌名 */
const hits = computed(() =>
  checkCompliance([
    { field: '主标题', text: store.activeItem?.headline.text ?? '' },
    { field: '副标题', text: store.activeItem?.subtitle.text ?? '' },
    { field: '品牌名', text: store.brand.name },
  ]),
)

const blocking = computed(() => hasBlockingIssue(hits.value))
const passed = computed(() => hits.value.length === 0)
</script>

<template>
  <PanelSection
    title="合规检查"
    :hint="passed ? '✓ 未发现问题' : `${hits.length} 项提示`"
  >
    <div class="space-y-3">
      <div
        class="flex items-center gap-2 rounded-lg px-3 py-2"
        :class="
          blocking
            ? 'bg-red-500/12 text-red-200'
            : hits.length
              ? 'bg-amber-500/12 text-amber-200'
              : 'bg-emerald-500/10 text-emerald-200'
        "
      >
        <span class="text-sm leading-none">
          {{ blocking ? '!' : hits.length ? '!' : '✓' }}
        </span>
        <span class="text-[11px] leading-relaxed">
          <template v-if="blocking">有 Apple 明令禁止的内容，上传前请先修改</template>
          <template v-else-if="hits.length">有需要留意的弱提示</template>
          <template v-else>文案未命中任何禁止规则</template>
        </span>
      </div>

      <ul v-if="hits.length" class="space-y-1.5">
        <li
          v-for="(h, i) in hits"
          :key="`${h.ruleId}-${h.field}-${i}`"
          class="rounded-md bg-surface-850 px-2.5 py-2"
        >
          <div class="flex items-center gap-2">
            <span
              class="rounded px-1 py-0.5 text-[9px] leading-3.5"
              :class="
                h.severity === 'error'
                  ? 'bg-red-500/25 text-red-200'
                  : 'bg-amber-500/25 text-amber-200'
              "
            >
              {{ h.severity === 'error' ? '禁止' : '提示' }}
            </span>
            <span class="text-[11px] text-ink-200">{{ h.label }}</span>
            <span class="ml-auto text-[10px] text-ink-500">来自{{ h.field }}</span>
          </div>
          <div class="mt-1 font-mono text-[10px] text-red-300">「{{ h.snippet }}」</div>
          <div class="mt-1 text-[10px] leading-relaxed text-ink-400">{{ h.advice }}</div>
        </li>
      </ul>

      <details class="text-[10px] leading-relaxed text-ink-500">
        <summary class="cursor-pointer text-ink-400 hover:text-ink-300">检查了哪些规则？</summary>
        <ul class="mt-1.5 space-y-1">
          <li>· 禁止出现具体价格与折扣信息</li>
          <li>· 禁止出现网址</li>
          <li>· 禁止出现版权符号 © ® ™</li>
          <li>· 禁止出现无法验证的奖项与榜单</li>
          <li>· 弱提示：其他平台 / 应用商店标识（图形无法自动识别）</li>
          <li>· 素材展示时的内容分级须达到 4+</li>
        </ul>
        <p class="mt-1.5">
          依据 Apple《App Store asset best practices》。规则基于文档明文条款，
          Apple 实际审核尺度可能更严，本工具不能替代人工判断。
        </p>
      </details>
    </div>
  </PanelSection>
</template>