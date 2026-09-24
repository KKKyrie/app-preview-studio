import { domToPng } from 'modern-screenshot'
import { nextTick, reactive, ref, shallowRef } from 'vue'
import { zip } from 'fflate'

import { useProjectStore } from '@/stores/project'
import type { CanvasItem } from '@/types'

export interface ExportJob {
  item: CanvasItem
  width: number
  height: number
  filename: string
}

/** 模块级单例状态：App.vue 中的隐藏导出容器与按钮共享 */
const exporting = ref(false)
const exportJob = shallowRef<ExportJob | null>(null)
const exportHostEl = shallowRef<HTMLElement | null>(null)
/** 批量导出进度（total=0 表示未在批量导出） */
const progress = reactive({ current: 0, total: 0 })

function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '_').trim() || 'preview'
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

  /**
   * 在隐藏容器中按 1:1 原始像素渲染画布并截图。
   * 预览与导出使用同一组件与样式，保证所见即所得。
   */
  async function renderItem(item: CanvasItem, width: number, height: number): Promise<string> {
    exportJob.value = { item, width, height, filename: '' }
    try {
      await nextTick()
      const node = exportHostEl.value?.firstElementChild
      if (!node) throw new Error('导出节点未就绪')
      const root = node as HTMLElement

      // 强制布局 → 收集实际字体用量 → 等字体加载完 → 内嵌 CSS
      root.getBoundingClientRect()
      const usage = collectFontUsage(root)
      await ensureFontsLoaded(usage)
      const cssText = (await buildFontCssText(usage)).trim()

      return await domToPng(root, {
        width,
        height,
        scale: 1,
        // Apple 要求截图不带透明通道：兜底填充不透明背景
        backgroundColor: '#ffffff',
        // 始终传非空 cssText：空字符串会 fallback 到库的全量抓取分支
        font: { cssText: cssText || '/* system fonts only */' },
      })
    } finally {
      exportJob.value = null
    }
  }

  /** 导出当前截图（单张 PNG） */
  async function exportActive() {
    if (exporting.value) return
    const item = store.activeItem
    if (!item) return
    exporting.value = true
    try {
      const { width, height } = store.canvasSize
      const filename = `${sanitizeFilename(store.projectName)}_${width}x${height}.png`
      const dataUrl = await renderItem(item, width, height)
      downloadUrl(dataUrl, filename)
    } finally {
      exporting.value = false
    }
  }

  /** 批量导出整组截图（ZIP，文件名带序号） */
  async function exportAll() {
    if (exporting.value || store.items.length === 0) return
    exporting.value = true
    const { width, height } = store.canvasSize
    const base = sanitizeFilename(store.projectName)
    progress.total = store.items.length
    progress.current = 0
    try {
      const files: Record<string, Uint8Array> = {}
      for (let i = 0; i < store.items.length; i++) {
        const dataUrl = await renderItem(store.items[i], width, height)
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

  return { exporting, exportJob, exportHostEl, progress, exportActive, exportAll }
}
