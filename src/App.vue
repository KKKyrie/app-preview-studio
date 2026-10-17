<script setup lang="ts">
import { computed } from 'vue'

import ModeSwitch from '@/components/ModeSwitch.vue'
import BannerLayoutPicker from '@/components/panels/BannerLayoutPicker.vue'
import BrandPanel from '@/components/panels/BrandPanel.vue'
import CompliancePanel from '@/components/panels/CompliancePanel.vue'
import CreativeImageUploader from '@/components/panels/CreativeImageUploader.vue'
import CropImageList from '@/components/panels/CropImageList.vue'
import CropPanel from '@/components/panels/CropPanel.vue'
import FramePicker from '@/components/panels/FramePicker.vue'
import ImageUploader from '@/components/panels/ImageUploader.vue'
import LayoutPicker from '@/components/panels/LayoutPicker.vue'
import PlacementPicker from '@/components/panels/PlacementPicker.vue'
import ProjectPanel from '@/components/panels/ProjectPanel.vue'
import SafeAreaPanel from '@/components/panels/SafeAreaPanel.vue'
import ScreenshotList from '@/components/panels/ScreenshotList.vue'
import SizePicker from '@/components/panels/SizePicker.vue'
import TextEditor from '@/components/panels/TextEditor.vue'
import ThemePicker from '@/components/panels/ThemePicker.vue'
import VariantList from '@/components/panels/VariantList.vue'
import CreativeStage from '@/components/stage/CreativeStage.vue'
import CropStage from '@/components/stage/CropStage.vue'
import PreviewStage from '@/components/stage/PreviewStage.vue'
import ScreenshotCanvas from '@/components/stage/ScreenshotCanvas.vue'
import CreativeCanvas from '@/components/stage/CreativeCanvas.vue'
import CropCanvas from '@/components/stage/CropCanvas.vue'
import { useExport } from '@/composables/useExport'
import { useImageUpload } from '@/composables/useImageUpload'
import { usePanelWidth } from '@/composables/usePanelWidth'
import { usePersistence } from '@/composables/usePersistence'
import { allCanvasOptions } from '@/constants/placements'
import { useCreativeStore } from '@/stores/creative'
import { useCropStore } from '@/stores/crop'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'

const store = useProjectStore()
const creative = useCreativeStore()
const crop = useCropStore()
const { dragging } = useImageUpload()
const { exporting, exportJob, exportHostEl, progress, exportActive, exportAll } = useExport()
const { panelWidth, startPanelDrag, resetPanelWidth } = usePanelWidth()
usePersistence()

function setExportHost(el: unknown) {
  exportHostEl.value = el instanceof HTMLElement ? el : null
}

const isCreative = computed(() => mode.value === 'creative')
const isCrop = computed(() => mode.value === 'crop')

/** 顶栏需要的最小信息（三个 store 都结构化满足） */
interface HeaderSource {
  projectName: string
  canvasSize: { width: number; height: number }
  items: { id: string }[]
}

/** 顶栏的项目名 / 尺寸徽章按工作台切换来源 */
const headerSource = computed<HeaderSource>(() => {
  if (isCrop.value) return crop
  return isCreative.value ? creative : store
})

const currentProjectName = computed({
  get: () => headerSource.value.projectName,
  set: (v: string) => {
    headerSource.value.projectName = v
  },
})

const sizeLabel = computed(() => {
  const s = headerSource.value.canvasSize
  return `${s.width} × ${s.height}`
})

/** 副标题与拖拽遮罩文案随工作台变化 */
const tagline = computed(() => {
  if (isCrop.value) return '成品图按官方比例裁剪'
  return isCreative.value ? '创意素材生成器' : '应用商店预览图生成器'
})

const dropHint = computed(() => {
  if (isCrop.value) return '松开以导入成品图（可一次多张）'
  return isCreative.value ? '松开以导入主体图（可选）' : '松开以导入 App 截图'
})

/**
 * 顶栏两个按钮的文案。
 *
 * 裁剪工作台的「批量」含义完全不同：不是「很多个条目」，而是「同一个条目的
 * 全部官方尺寸」。沿用「批量 ZIP (1)」会让人以为只会导出一张。
 */
const exportAllCount = computed(() =>
  isCrop.value ? allCanvasOptions().length : headerSource.value.items.length,
)
const exportAllLabel = computed(() =>
  isCrop.value ? `导出全部尺寸 (${exportAllCount.value})` : `批量 ZIP (${exportAllCount.value})`,
)
const exportBusyLabel = computed(() =>
  isCrop.value ? `导出 ${progress.current}/${progress.total}…` : `打包 ${progress.current}/${progress.total}…`,
)
const exportActiveLabel = computed(() => (isCrop.value ? '导出当前尺寸' : '导出 PNG'))

/**
 * 裁剪工作台没有图时两个导出按钮必须置灰。
 *
 * `exportCropActive` / `exportCropAllSizes` 在 `!item?.image` 时直接 return，
 * 按钮若还能点，用户看到的就是「点了没反应」——「操作成功但界面无变化」按 bug 处理。
 * 另外两个工作台恒有至少一条，不受影响。
 */
const canExport = computed(() => !isCrop.value || !!crop.activeItem?.image)

/**
 * 隐藏导出容器挂载的画布。
 * 先把 job 收敛成带判别字段的联合类型，模板里才能正确收窄 item 的具体类型。
 */
const screenshotJob = computed(() => {
  const j = exportJob.value
  return j && j.kind === 'screenshot' ? j : null
})

const creativeJob = computed(() => {
  const j = exportJob.value
  return j && j.kind === 'creative' ? j : null
})

const cropJob = computed(() => {
  const j = exportJob.value
  return j && j.kind === 'crop' ? j : null
})
</script>

<template>
  <div class="flex h-full flex-col bg-surface-950 text-ink-100">
    <!-- 顶栏 -->
    <header class="flex h-13 shrink-0 items-center gap-4 border-b border-line-800 px-4">
      <div class="flex items-center gap-2.5">
        <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden>
          <rect x="7" y="3" width="18" height="26" rx="5" fill="#3b6fff" />
          <rect x="9.5" y="6" width="13" height="20" rx="3" fill="#fff" />
          <rect x="12" y="9" width="8" height="2" rx="1" fill="#3b6fff" />
          <rect x="12" y="13" width="6" height="1.6" rx="0.8" fill="#86a8ff" />
        </svg>
        <div class="leading-tight">
          <div class="text-sm font-semibold tracking-wide">App Preview Studio</div>
          <div class="text-[10px] text-ink-500">
            {{ tagline }}
          </div>
        </div>
      </div>

      <input
        v-model="currentProjectName"
        class="w-52 rounded-md border border-transparent bg-surface-850 px-2.5 py-1.5 text-xs text-ink-200 outline-none transition hover:border-line-700 focus:border-brand-500"
        placeholder="项目名称"
      />

      <div class="flex-1" />

      <span
        data-size-badge
        class="rounded-md bg-surface-850 px-2.5 py-1.5 text-xs tabular-nums text-ink-300 ring-1 ring-line-800"
      >
        {{ sizeLabel }}
      </span>

      <div class="flex items-center gap-2">
        <button
          type="button"
          data-export-all
          class="rounded-md bg-surface-700 px-3 py-2 text-xs font-medium text-ink-200 transition hover:bg-surface-600 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="exporting || !canExport"
          @click="exportAll"
        >
          {{ exporting && progress.total > 0 ? exportBusyLabel : exportAllLabel }}
        </button>

        <button
          type="button"
          data-export-active
          class="flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-xs font-medium text-white transition hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="exporting || !canExport"
          @click="exportActive"
        >
          <svg
            v-if="exporting && progress.total === 0"
            class="h-3.5 w-3.5 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-opacity="0.3" stroke-width="3" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
          </svg>
          {{ exporting && progress.total === 0 ? '导出中…' : exportActiveLabel }}
        </button>
      </div>
    </header>

    <!-- 工作台切换条 -->
    <ModeSwitch />

    <div class="flex min-h-0 flex-1">
      <!-- 左侧表单面板（右缘手柄可拖拽调宽，最小 = 默认 320px） -->
      <div class="relative shrink-0">
        <aside
          :style="{ width: `${panelWidth}px` }"
          class="h-full space-y-6 overflow-y-auto border-r border-line-800 p-4"
        >
          <!-- ══ 图片裁剪工作台 ══ -->
          <template v-if="isCrop">
            <CropImageList />
            <PlacementPicker />
            <CropPanel />
            <ProjectPanel />
          </template>

          <!-- ══ 创意素材工作台 ══ -->
          <template v-else-if="isCreative">
            <PlacementPicker />
            <VariantList />
            <CreativeImageUploader />
            <BannerLayoutPicker />
            <ThemePicker />
            <BrandPanel />
            <TextEditor />
            <SafeAreaPanel />
            <CompliancePanel />
            <ProjectPanel />
          </template>

          <!-- ══ App 预览截图工作台 ══ -->
          <template v-else>
            <ScreenshotList />
            <ImageUploader />
            <SizePicker />
            <LayoutPicker />
            <FramePicker />
            <ThemePicker />
            <BrandPanel />
            <TextEditor />
            <ProjectPanel />
          </template>
        </aside>
        <!-- 拖拽手柄：一半压在分隔线上，hover 高亮；双击恢复默认宽度 -->
        <div
          data-panel-resizer
          class="absolute inset-y-0 -right-[3px] z-30 w-1.5 touch-none cursor-col-resize transition-colors hover:bg-brand-500/50"
          title="拖拽调整面板宽度，双击恢复默认（最小 320px）"
          @pointerdown.prevent="startPanelDrag"
          @dblclick="resetPanelWidth"
        />
      </div>

      <!-- 预览区 -->
      <main class="relative min-w-0 flex-1">
        <CropStage v-if="isCrop" />
        <CreativeStage v-else-if="isCreative" />
        <PreviewStage v-else />

        <!-- 拖拽遮罩 -->
        <div
          v-if="dragging"
          class="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-brand-400 bg-surface-950/70 backdrop-blur-sm"
        >
          <p class="text-sm font-medium text-brand-300">{{ dropHint }}</p>
        </div>
      </main>
    </div>

    <!-- 隐藏导出容器：按 1:1 原始像素渲染后截图 -->
    <div
      :ref="setExportHost"
      aria-hidden="true"
      class="pointer-events-none fixed top-0 -left-[100000px] opacity-100"
    >
      <ScreenshotCanvas
        v-if="screenshotJob"
        :key="`${screenshotJob.item.id}-${screenshotJob.width}x${screenshotJob.height}`"
        :item="screenshotJob.item"
        :width="screenshotJob.width"
        :height="screenshotJob.height"
        :brand="store.brand"
      />
      <!-- overlay 必须为 false：安全区叠加层绝不能进入导出成品 -->
      <CreativeCanvas
        v-else-if="creativeJob"
        :key="`${creativeJob.item.id}-${creativeJob.width}x${creativeJob.height}`"
        :item="creativeJob.item"
        :width="creativeJob.width"
        :height="creativeJob.height"
        :safe="creativeJob.safe"
        :brand="creative.brand"
        :overlay="false"
      />
      <!-- 同理：overlay 必须为 false。裁剪成品只能是源图本身加裁切 -->
      <CropCanvas
        v-else-if="cropJob"
        :key="`${cropJob.item.id}-${cropJob.width}x${cropJob.height}`"
        :item="cropJob.item"
        :width="cropJob.width"
        :height="cropJob.height"
        :overlay="false"
      />
    </div>
  </div>
</template>