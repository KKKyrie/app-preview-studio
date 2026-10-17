/**
 * 生成 README 配图：
 *  - docs/ui.png            工作台界面截图（1680 × 1050 视口）
 *  - docs/sample-*.png      指定主题的导出成品（1284 × 2778 真实导出）
 * 结束后恢复默认状态并清理 localStorage，保证后续验证脚本从干净状态开始。
 * 用法：npm run docs:capture   （依赖本机 Chrome + 运行中的 dev server）
 */
import { mkdir, mkdtemp, readdir, rename, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')

/** README 展示样张：主题 + 文件名 + （可选）覆盖字体 */
const SAMPLES = [
  { theme: 'minimal-white', file: 'sample-minimal.png' },
  { theme: 'dark-premium', file: 'sample-dark.png' },
  {
    theme: 'aurora',
    file: 'sample-aurora.png',
    fonts: { headline: { font: 'smiley', weight: 400 }, subtitle: { font: 'misans', weight: 500 } },
  },
]

/** 复用 verify-export 的等待策略：等出现 PNG 且文件大小稳定 */
async function waitForPng(dir, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => [])
    const png = files.find((f) => f.endsWith('.png') && !f.endsWith('.crdownload'))
    if (png) {
      const file = join(dir, png)
      let last = -1
      for (let i = 0; i < 40; i++) {
        const s = (await stat(file)).size
        if (s === last && s > 0) return { file, name: png }
        last = s
        await new Promise((r) => setTimeout(r, 250))
      }
      return { file, name: png }
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('等待导出超时：未产生 PNG 文件')
}

await mkdir(DOCS, { recursive: true })
const downloadDir = await mkdtemp(join(tmpdir(), 'apv-docs-'))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1680, height: 1050 })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30_000 })

  // 先回到默认状态（防止上次运行/验证残留影响 UI 截图）
  await page.evaluate(() => {
    // 工作台模式是全局状态：上次若停在创意素材 / 图片裁剪，界面图就拍错了
    window.__studio.setMode('screenshot')
    const store = window.__studio.store
    store.setTheme('minimal-white')
    store.patchText('headline', { font: 'system', weight: 800 })
    store.patchText('subtitle', { font: 'system', weight: 500 })
    store.patchBrand({ logo: null, name: '' })
  })
  await new Promise((r) => setTimeout(r, 600))

  /* 1. 工作台界面截图 */
  const uiPath = join(DOCS, 'ui.png')
  await page.screenshot({ path: uiPath })
  console.log(`✓ docs/ui.png`)

  // 下载行为：优先 Page 域，回退 Browser 域
  try {
    const cdp = await page.createCDPSession()
    await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir })
  } catch {
    const cdp = await browser.target().createCDPSession()
    await cdp.send('Browser.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadDir,
      eventsEnabled: true,
    })
  }

  /* 2. 品牌行（logo 用 canvas 现画，演示「Logo + 品牌名」特性） */
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#3b6fff'
    ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 34px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('A', 32, 34)
    window.__studio.store.patchBrand({
      logo: c.toDataURL('image/png'),
      name: 'Aperture',
      logoSize: 0.045,
      logoRadius: 0.25,
      nameSize: 0.036,
    })
  })

  /* 3. 逐主题导出样张 */
  for (const sample of SAMPLES) {
    await page.evaluate((s) => {
      const store = window.__studio.store
      store.setTheme(s.theme)
      if (s.fonts) {
        store.patchText('headline', s.fonts.headline)
        store.patchText('subtitle', s.fonts.subtitle)
      }
    }, sample)
    if (sample.fonts) {
      await page.evaluate(async () => {
        await Promise.all([
          document.fonts.load('400 72px "Smiley Sans"', '让效率翻倍'),
          document.fonts.load('500 34px "MiSans"', '简洁快速'),
        ])
        await document.fonts.ready
      })
    }
    await new Promise((r) => setTimeout(r, 300))

    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('header button')].find((b) =>
        b.textContent?.includes('导出'),
      )
      if (!btn) throw new Error('未找到导出按钮')
      btn.click()
    })
    const { file } = await waitForPng(downloadDir)
    await rename(file, join(DOCS, sample.file))
    console.log(`✓ docs/${sample.file}`)
  }

  /* 4. 恢复默认状态并清理（顺序：先改状态 → 等持久化 debounce → 再删 key） */
  await page.evaluate(() => {
    window.__studio.setMode('screenshot')
    const store = window.__studio.store
    store.setTheme('minimal-white')
    store.patchText('headline', { font: 'system', weight: 800 })
    store.patchText('subtitle', { font: 'system', weight: 500 })
    store.patchBrand({ logo: null, name: '' })
  })
  await new Promise((r) => setTimeout(r, 800))
  await page.evaluate(() => localStorage.removeItem('app-preview-studio.project.v1'))

  if (pageErrors.length > 0) {
    console.error('页面错误:', pageErrors.join(' | '))
    process.exitCode = 1
  } else {
    console.log('配图生成完成 🎉（页面无错误，状态已清理）')
  }
} finally {
  await browser.close()
  await rm(downloadDir, { recursive: true, force: true }).catch(() => {})
}
