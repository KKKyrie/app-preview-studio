import { domToPng } from 'modern-screenshot'
import { nextTick, reactive, ref, shallowRef } from 'vue'
import { zip } from 'fflate'

import { useCreativeStore } from '@/stores/creative'
import { mode } from '@/stores/mode'
import { useProjectStore } from '@/stores/project'
import type { CanvasItem, CreativeItem, Rect } from '@/types'

export type ExportKind = 'screenshot' | 'creative'

interface ExportJobBase {
  width: number
  height: number
}

/**
 * 导出任务。用 `kind` 作为判别式，使 `item` 能随分支一起收窄
 * （否则模板里只能拿到 `CanvasItem | CreativeItem` 的联合类型）。
 */
export type ExportJob =
  | (ExportJobBase & { kind: 'screenshot'; item: CanvasItem })
  | (ExportJobBase & { kind: 'creative'; item: CreativeItem; safe: Rect })

/** 模块级单例状态：App.vue 中的隐藏导出容器与按钮共享 */
const exporting = ref(false)
const exportJob = shallowRef<ExportJob | null>(null)
const exportHostEl = shallowRef<HTMLElement | null>(null)
/** 批量导出进度（total=0 表示未在批量导出） */
const progress = reactive({ current: 0, total: 0 })

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'preview'
}

/**
 * 等待导出节点内所有 <img> 解码完成。
 *
 * 创意素材的主体图尺寸依赖 useAspectRatio 的异步结果（图片 onload 后才拿到
 * 宽高比，版式几何随之改变）。若不等就会截到「图还没参与布局」的中间态，
 * 产出没有主体图的成品。因此解码与 nextTick 交替跑两轮，收敛到稳定画面。
 */
async function settleImages(root: HTMLElement) {
  // 3 轮：图片解码 → 版式重排 → 文案块测量回填（「上文下图」依赖它定位主体图）
  for (let round = 0; round < 3; round++) {
    const imgs = Array.from(root.querySelectorAll('img'))
    await Promise.all(
      imgs.map((img) =>
        img.decode ? img.decode().catch(() => undefined) : Promise.resolve(),
      ),
    )
    await nextTick()
  }
}

function downloadUrl(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  if (url.startsWith('blob:')) {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const res = await fetch(dataUrl)
  return new Uint8Array(await res.arrayBuffer())
}

function zipAsync(files: Record<string, Uint8Array>): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (err, data) => (err ? reject(err) : resolve(data)))
  })
}

/* ────────────────────────────────────────────────────────────────
 * 导出字体内嵌
 *
 * modern-screenshot 默认会把「已用字体族」的全部 @font-face 规则
 * （例如 MiSans 每字重 56 个 unicode-range 分片）都抓下来内嵌，
 * 体积失控。这里改为自定义 font.cssText：
 *   1. 从导出 DOM 收集实际用到的（字体族 × 字重 × 字符）；
 *   2. 扫描 document.styleSheets，按 字体族 + CSS 字重匹配算法 +
 *      unicode-range ∩ 实际字符 过滤规则；
 *   3. 把命中的字体文件 fetch 后转 base64 data URI（模块级缓存）；
 *   4. 始终把结果作为 font.cssText 传入（空也要传占位注释，
 *      否则会 fallback 到库的全量抓取分支）。
 * ──────────────────────────────────────────────────────────────── */

/**
 * 去掉导出 PNG 的 alpha 通道。
 *
 * modern-screenshot 即使传了 backgroundColor，产出的 PNG 仍是 colorType 6 (RGBA)
 * —— 像素确实全不透明（minAlpha=255），但文件格式层面仍带 alpha 通道。
 * Apple 对 App Store 截图与 Creative assets 都明确要求「图片不能含 alpha 通道或任何透明」，
 * 因此统一在导出末端把图像重绘到 alpha:false 的画布上，得到 colorType 2 (RGB)。
 *
 * ⚠️ 必须走 toBlob，不能用 toDataURL：Chrome 的 toDataURL('image/png') 无论画布是否
 * alpha:false 都固定输出 colorType 6（已实测 Chrome 155），只有 toBlob 才会尊重
 * alpha:false 并输出 colorType 2。
 */
async function flattenToOpaquePng(dataUrl: string): Promise<string> {
  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('导出图像解码失败'))
    img.src = dataUrl
  })

  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('无法创建 2D 绘图上下文')
  // alpha:false 的画布初始为不透明黑：铺一层底色再绘制，
  // 保证边缘抗锯齿不会把「透明」当成有效颜色混进来。
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('导出 PNG 编码失败')

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('导出 PNG 读取失败'))
    reader.readAsDataURL(blob)
  })
}

interface FontUsage {
  /** 字体族（去引号）→ 用到的字重 */
  families: Map<string, Set<number>>
  /** 字体族 → 用到的非空白字符 */
  chars: Map<string, Set<string>>
  /** 字体族 → 样例文本（document.fonts.load 触发加载用） */
  samples: Map<string, string>
}

/** 解析 computed font-weight（数字 / normal / bold） */
function parseWeight(value: string): number {
  const n = parseInt(value, 10)
  if (Number.isFinite(n)) return n
  return value === 'bold' ? 700 : 400
}

/** 遍历导出节点，收集每个文本节点实际参与渲染的字体族 / 字重 / 字符 */
function collectFontUsage(root: HTMLElement): FontUsage {
  const usage: FontUsage = { families: new Map(), chars: new Map(), samples: new Map() }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node: Node | null
  while ((node = walker.nextNode())) {
    const text = node.textContent ?? ''
    if (!/\S/.test(text)) continue
    const parent = node.parentElement
    if (!parent) continue
    const cs = getComputedStyle(parent)
    const weight = parseWeight(cs.fontWeight)
    // font-family 是回退链：每个族都可能渲染部分字符（unicode-range 决定分工）
    const families = cs.fontFamily
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    for (const family of families) {
      let weights = usage.families.get(family)
      if (!weights) usage.families.set(family, (weights = new Set()))
      weights.add(weight)
      let chars = usage.chars.get(family)
      if (!chars) usage.chars.set(family, (chars = new Set()))
      for (const ch of text) {
        if (!/\s/.test(ch)) chars.add(ch)
      }
      const sample = usage.samples.get(family) ?? ''
      if (sample.length < 160) usage.samples.set(family, `${sample}${text}`)
    }
  }
  return usage
}

/**
 * CSS Fonts 规范的字重匹配（§5.2.2）：
 * 在一组单字重候选中，返回浏览器真正会选中的字重。
 */
function cssPickWeight(desired: number, candidates: number[]): number | null {
  const sorted = [...new Set(candidates)].sort((a, b) => a - b)
  if (!sorted.length) return null
  let order: number[]
  if (desired >= 400 && desired <= 500) {
    order = [
      ...sorted.filter((w) => w >= desired && w <= 500), // 升序
      ...sorted.filter((w) => w < desired).reverse(), // 降序
      ...sorted.filter((w) => w > 500), // 升序
    ]
  } else if (desired < 400) {
    order = [
      ...sorted.filter((w) => w <= desired).reverse(), // 降序
      ...sorted.filter((w) => w > desired), // 升序
    ]
  } else {
    order = [
      ...sorted.filter((w) => w >= desired), // 升序
      ...sorted.filter((w) => w < desired).reverse(), // 降序
    ]
  }
  return order.length ? order[0] : null
}

/** 解析 unicode-range 描述符；解析失败返回 null（= 不做范围过滤，宁多勿缺） */
function parseUnicodeRange(value: string): Array<[number, number]> | null {
  const out: Array<[number, number]> = []
  const expand = (token: string): [number, number] => {
    if (token.includes('?')) {
      return [
        parseInt(token.replace(/\?/g, '0'), 16),
        parseInt(token.replace(/\?/g, 'F'), 16),
      ]
    }
    const v = parseInt(token, 16)
    return [v, v]
  }
  for (const part of value.split(',')) {
    const s = part.trim()
    if (!s) continue
    const m = /^U\+([0-9A-Fa-f?]+)(?:-([0-9A-Fa-f?]+))?$/.exec(s)
    if (!m) return null
    const [lo] = expand(m[1])
    const hi = m[2] ? expand(m[2])[1] : expand(m[1])[1]
    out.push([Math.min(lo, hi), Math.max(lo, hi)])
  }
  return out.length ? out : null
}

/** 该规则覆盖的码点范围内是否有实际用到的字符 */
function rangeHitsChars(ranges: Array<[number, number]>, chars: Set<string>): boolean {
  for (const ch of chars) {
    const cp = ch.codePointAt(0)
    if (cp == null) continue
    for (const [lo, hi] of ranges) {
      if (cp >= lo && cp <= hi) return true
    }
  }
  return false
}

/** 字体 URL → data URI 的模块级缓存（批量导出只 fetch 一次） */
const fontUrlCache = new Map<string, Promise<string>>()

const FONT_MIME: Record<string, string> = {
  woff2: 'font/woff2',
  woff: 'font/woff',
  ttf: 'font/ttf',
  otf: 'font/otf',
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

function fontDataUrl(url: string): Promise<string> {
  const cached = fontUrlCache.get(url)
  if (cached) return cached
  const promise = fetch(url).then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const ext = (url.split(/[?#]/)[0].split('.').pop() ?? '').toLowerCase()
    const mime = FONT_MIME[ext] ?? 'application/octet-stream'
    return `data:${mime};base64,${arrayBufferToBase64(await res.arrayBuffer())}`
  })
  fontUrlCache.set(url, promise)
  promise.catch(() => fontUrlCache.delete(url)) // 失败不缓存，下次重试
  return promise
}

/** 把一段 CSS 里的远程 url(...) 替换为 data URI */
async function inlineFontUrls(css: string, baseHref: string | null): Promise<string> {
  const re = /url\((['"]?)([^'")]+)\1\)/g
  const found: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (!m[2].startsWith('data:')) found.push(m[2])
  }
  let out = css
  for (const raw of found) {
    try {
      const abs = new URL(raw, baseHref ?? document.baseURI).href
      const dataUrl = await fontDataUrl(abs)
      // 按原始 url(...) 片段整体替换，避免 $ 转义问题
      out = out.replace(
        new RegExp(`url\\((['"]?)${raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1\\)`),
        `url("${dataUrl}")`,
      )
    } catch (e) {
      console.warn('[export] 字体内嵌失败：', raw, e)
    }
  }
  return out
}

interface FaceInfo {
  rule: CSSFontFaceRule
  lo: number
  hi: number
}

/**
 * 构建导出用的 @font-face CSS（只含真正参与渲染的规则 + base64 字体）。
 * 按 字体族 → CSS 字重匹配 → unicode-range 三层过滤，宁多勿缺。
 */
async function buildFontCssText(usage: FontUsage): Promise<string> {
  const byFamily = new Map<string, FaceInfo[]>()

  // Pass 1：按字体族收集所有 @font-face 规则
  for (let i = 0; i < document.styleSheets.length; i++) {
    const sheet = document.styleSheets[i]
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue // 跨域样式表读不到规则，跳过
    }
    for (let j = 0; j < rules.length; j++) {
      const rule = rules[j]
      if (rule.type !== CSSRule.FONT_FACE_RULE) continue
      const face = rule as CSSFontFaceRule
      const family = (face.style.getPropertyValue('font-family') || '')
        .trim()
        .replace(/^['"]|['"]$/g, '')
      if (!usage.families.has(family)) continue
      const src = face.style.getPropertyValue('src')
      if (!src || !src.includes('url(')) continue
      const fw = face.style.getPropertyValue('font-weight').trim() || '400'
      const parts = fw.split(/\s+/)
      const lo = Number(parts[0]) || 400
      const hi = parts[1] != null ? Number(parts[1]) || lo : lo
      let list = byFamily.get(family)
      if (!list) byFamily.set(family, (list = []))
      list.push({ rule: face, lo, hi: Math.max(lo, hi) })
    }
  }

  // Pass 2：字重 / unicode-range 过滤，并内嵌字体文件
  const tasks: Promise<string>[] = []
  for (const [family, faces] of byFamily) {
    const usedWeights = usage.families.get(family)!
    const allRange = faces.every((f) => f.lo !== f.hi) // 可变字体（weight 是区间）
    const allSingle = faces.every((f) => f.lo === f.hi)
    let picked = faces
    if (!allRange && allSingle) {
      // 纯静态字重族：按 CSS 匹配算法选出浏览器真正会加载的字重
      const singleWeights = faces.map((f) => f.lo)
      const targets = new Set<number>()
      for (const w of usedWeights) {
        const t = cssPickWeight(w, singleWeights)
        if (t != null) targets.add(t)
      }
      const filtered = faces.filter((f) => targets.has(f.lo))
      if (filtered.length) picked = filtered // 空则全量兜底（宁多勿缺）
    }
    // 混合族（区间 + 单字重并存）不做过滤，避免误伤

    const chars = usage.chars.get(family)!
    for (const face of picked) {
      const ur = face.rule.style.getPropertyValue('unicode-range').trim()
      if (ur) {
        const ranges = parseUnicodeRange(ur)
        if (ranges && !rangeHitsChars(ranges, chars)) continue
      }
      const baseHref = face.rule.parentStyleSheet?.href ?? null
      tasks.push(inlineFontUrls(face.rule.cssText, baseHref))
    }
  }

  return (await Promise.all(tasks)).join('\n')
}

/** 强制字体加载：让导出 SVG 内的文字在截图前就绪 */
async function ensureFontsLoaded(usage: FontUsage): Promise<void> {
  const jobs: Promise<unknown>[] = []
  for (const [family, weights] of usage.families) {
    const sample = usage.samples.get(family) || 'Ag'
    for (const w of weights) {
      jobs.push(document.fonts.load(`${w} 16px "${family}"`, sample).catch(() => {}))
    }
  }
  await Promise.all(jobs)
  await document.fonts.ready
}

export function useExport() {
  const store = useProjectStore()
  const creative = useCreativeStore()

  /**
   * 在隐藏容器中按 1:1 原始像素渲染画布并截图。
   * 预览与导出使用同一组件与样式，保证所见即所得。
   */
  async function renderJob(job: ExportJob): Promise<string> {
    exportJob.value = job
    try {
      await nextTick()
      const node = exportHostEl.value?.firstElementChild
      if (!node) throw new Error('导出节点未就绪')
      const root = node as HTMLElement

      // 图片解码收敛（创意素材的主体图会改变版式几何）
      await settleImages(root)

      // 强制布局 → 收集实际字体用量 → 等字体加载完 → 内嵌 CSS
      root.getBoundingClientRect()
      const usage = collectFontUsage(root)
      await ensureFontsLoaded(usage)
      const cssText = (await buildFontCssText(usage)).trim()

      return await flattenToOpaquePng(
        await domToPng(root, {
          width: job.width,
          height: job.height,
          scale: 1,
          // Apple 要求素材不带透明通道：兜底填充不透明背景
          backgroundColor: '#ffffff',
          // 始终传非空 cssText：空字符串会 fallback 到库的全量抓取分支
          font: { cssText: cssText || '/* system fonts only */' },
        }),
      )
    } finally {
      exportJob.value = null
    }
  }

  /* ── App 预览截图 ── */

  function screenshotJob(item: CanvasItem) {
    const { width, height } = store.canvasSize
    return { kind: 'screenshot' as const, item, width, height }
  }

  /** 导出当前截图（单张 PNG） */
  async function exportActive() {
    if (exporting.value) return
    if (mode.value === 'creative') return exportCreativeActive()
    const item = store.activeItem
    if (!item) return
    exporting.value = true
    try {
      const { width, height } = store.canvasSize
      const filename = `${sanitizeFilename(store.projectName)}_${width}x${height}.png`
      const dataUrl = await renderJob(screenshotJob(item))
      downloadUrl(dataUrl, filename)
    } finally {
      exporting.value = false
    }
  }

  /** 批量导出整组截图（ZIP，文件名带序号） */
  async function exportScreenshotAll() {
    if (exporting.value || store.items.length === 0) return
    exporting.value = true
    const { width, height } = store.canvasSize
    const base = sanitizeFilename(store.projectName)
    progress.total = store.items.length
    progress.current = 0
    try {
      const files: Record<string, Uint8Array> = {}
      for (let i = 0; i < store.items.length; i++) {
        const dataUrl = await renderJob(screenshotJob(store.items[i]))
        files[`${base}_${width}x${height}_${String(i + 1).padStart(2, '0')}.png`] =
          await dataUrlToBytes(dataUrl)
        progress.current = i + 1
        // 让出主线程以刷新进度
        await new Promise((r) => setTimeout(r, 0))
      }
      const zipped = await zipAsync(files)
      const blobUrl = URL.createObjectURL(
        new Blob([zipped as unknown as BlobPart], { type: 'application/zip' }),
      )
      downloadUrl(blobUrl, `${base}_${width}x${height}.zip`)
    } finally {
      exporting.value = false
      progress.current = 0
      progress.total = 0
    }
  }

  /* ── 创意素材 ── */

  function creativeJob(item: CreativeItem) {
    return {
      kind: 'creative' as const,
      item,
      width: creative.canvasSize.width,
      height: creative.canvasSize.height,
      safe: creative.safeArea,
    }
  }

  /**
   * 导出当前创意素材变体。
   *
   * 5244 × 2950 是两个坑位共用的尺寸，同一份文件可同时填标题图与搜索结果图，
   * 这里在文件名里带上提示，避免用户上传时搞混。
   */
  async function exportCreativeActive() {
    if (exporting.value) return
    const item = creative.activeItem
    if (!item) return
    exporting.value = true
    try {
      const { width, height } = creative.canvasSize
      const base = sanitizeFilename(creative.projectName)
      const both = creative.canvas.universal ? '_通用双坑位' : ''
      const dataUrl = await renderJob(creativeJob(item))
      downloadUrl(
        dataUrl,
        `${base}_${creative.canvas.aspect.replace(':', 'x')}${both}_${width}x${height}.png`,
      )
    } finally {
      exporting.value = false
    }
  }

  /** 批量导出创意素材变体（ZIP） */
  async function exportCreativeAll() {
    if (exporting.value || creative.items.length === 0) return
    exporting.value = true
    const { width, height } = creative.canvasSize
    const base = sanitizeFilename(creative.projectName)
    progress.total = creative.items.length
    progress.current = 0
    try {
      const files: Record<string, Uint8Array> = {}
      for (let i = 0; i < creative.items.length; i++) {
        const dataUrl = await renderJob(creativeJob(creative.items[i]))
        files[`${base}_${String(i + 1).padStart(2, '0')}_${width}x${height}.png`] =
          await dataUrlToBytes(dataUrl)
        progress.current = i + 1
        await new Promise((r) => setTimeout(r, 0))
      }
      const zipped = await zipAsync(files)
      const blobUrl = URL.createObjectURL(
        new Blob([zipped as unknown as BlobPart], { type: 'application/zip' }),
      )
      downloadUrl(blobUrl, `${base}_${width}x${height}.zip`)
    } finally {
      exporting.value = false
      progress.current = 0
      progress.total = 0
    }
  }

  /** 批量导出：按当前工作台分发（顶栏按钮调用） */
  async function exportAll() {
    return mode.value === 'creative' ? exportCreativeAll() : exportScreenshotAll()
  }

  return {
    exporting,
    exportJob,
    exportHostEl,
    progress,
    /** 导出当前条目（按当前工作台分发） */
    exportActive,
    /** 批量导出 ZIP（按当前工作台分发） */
    exportAll,
    exportCreativeActive,
    exportCreativeAll,
  }
}
