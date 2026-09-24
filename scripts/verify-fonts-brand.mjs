/**
 * 字体选择 + 品牌（logo/名字）功能验证：
 *  1. 驱动状态：品牌 logo/名字 + 主标题得意黑 + 副标题 MiSans
 *  2. 截图左侧面板（字体 chips）与预览画布（品牌行），存为产物供人工复核
 *  3. 导出 PNG → 校验像素尺寸 + 页面无错误
 *  4. 刷新 → 校验品牌（IndexedDB）与字体选择（localStorage）恢复
 * 用法：node scripts/verify-fonts-brand.mjs   （KEEP=1 保留产物）
 */
import { mkdtemp, readdir, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
const EXPECTED = { width: 1284, height: 2778 }

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

function pngSize(file) {
  const out = execSync(`sips -g pixelWidth -g pixelHeight "${file}"`, { encoding: 'utf8' })
  return {
    width: Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]),
    height: Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]),
  }
}

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
        if (s === last && s > 0) return file
        last = s
        await new Promise((r) => setTimeout(r, 250))
      }
      return file
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('等待导出超时：未产生 PNG 文件')
}

const artifacts = await mkdtemp(join(tmpdir(), 'apv-fonts-'))
const downloadDir = await mkdtemp(join(tmpdir(), 'apv-fonts-dl-'))
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
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30_000 })

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

  /* 1. 设置品牌 + 字体（通过 dev 钩子 __studio 驱动 store；logo 用 canvas 现画） */
  await page.evaluate(() => {
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const ctx = c.getContext('2d')
    // 实心方块 logo：便于目检导出图中的圆角裁切效果
    ctx.fillStyle = '#3b6fff'
    ctx.fillRect(0, 0, 64, 64)
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 34px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('A', 32, 34)
    const logo = c.toDataURL('image/png')

    const store = window.__studio.store
    store.patchBrand({ logo, name: 'Aperture', logoSize: 0.045, logoRadius: 0.25, nameSize: 0.036 })
    store.patchText('headline', { font: 'smiley', weight: 400 })
    store.patchText('subtitle', { font: 'misans', weight: 500 })
  })

  // 等字体真正就绪（font-display: block 需要加载完才绘制）
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('400 72px "Smiley Sans"', '让效率翻倍'),
      document.fonts.load('500 34px "MiSans"', '简洁快速'),
    ])
    await document.fonts.ready
  })

  /* 2. 视觉产物：画布（品牌行 + 新字体）+ 面板（品牌 / 字体 chips 滚动定位） */
  const canvasShot = join(artifacts, 'canvas-brand.png')
  const brandShot = join(artifacts, 'panel-brand.png')
  const fontsShot = join(artifacts, 'panel-fonts.png')
  const canvasEl = await page.$('main')
  await canvasEl?.screenshot({ path: canvasShot })

  // 滚动左侧面板到「品牌」面板并截图
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('aside h3')].find((h) => h.textContent?.includes('品牌'))
    el?.scrollIntoView({ block: 'start' })
  })
  await new Promise((r) => setTimeout(r, 200))
  const asideEl = await page.$('aside')
  await asideEl?.screenshot({ path: brandShot })

  // 滚动到字体 chips（第一个「字体」标签行）并截图
  await page.evaluate(() => {
    const span = [...document.querySelectorAll('aside span')].find(
      (s) => s.textContent?.trim() === '字体',
    )
    span?.scrollIntoView({ block: 'center' })
  })
  await new Promise((r) => setTimeout(r, 200))
  await asideEl?.screenshot({ path: fontsShot })
  console.log(`产物: ${canvasShot}`)
  console.log(`产物: ${brandShot}`)
  console.log(`产物: ${fontsShot}`)

  /* 3. 导出并校验 */
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent?.includes('导出'),
    )
    if (!btn) throw new Error('未找到导出按钮')
    btn.click()
  })
  const file = await waitForPng(downloadDir)
  const { width, height } = pngSize(file)
  check('导出 PNG 像素尺寸', width === EXPECTED.width && height === EXPECTED.height, `${width} × ${height}`)
  console.log(`产物: ${file}`)

  /* 4. 刷新后恢复：品牌 logo（IndexedDB）+ 字体选择（localStorage） */
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(async () => {
    await document.fonts.ready
    // 等待 usePersistence 异步回填 logo
    for (let i = 0; i < 40; i++) {
      if (window.__studio.store.brand.logo) return
      await new Promise((r) => setTimeout(r, 100))
    }
  })
  const restored = await page.evaluate(() => {
    const s = window.__studio.store
    return {
      name: s.brand.name,
      logo: s.brand.logo,
      logoRadius: s.brand.logoRadius,
      headlineFont: s.activeItem?.headline.font,
      subtitleFont: s.activeItem?.subtitle.font,
    }
  })
  check('刷新后品牌名恢复', restored.name === 'Aperture', `name=${restored.name}`)
  check('刷新后 Logo 恢复（IndexedDB）', restored.logo?.startsWith('data:image') === true)
  check('刷新后 Logo 圆角恢复', restored.logoRadius === 0.25, `radius=${restored.logoRadius}`)
  check('刷新后主标题字体恢复', restored.headlineFont === 'smiley', `font=${restored.headlineFont}`)
  check('刷新后副标题字体恢复', restored.subtitleFont === 'misans', `font=${restored.subtitleFont}`)

  check('页面无错误', pageErrors.length === 0, pageErrors.join(' | '))

  // 清理持久化状态，避免污染其它验证脚本：
  // 先改状态（brand/logo 清空会触发 watcher 自动删 IDB 图片）→
  // 等 400ms 防抖落盘完成 → 最后删 localStorage
  await page.evaluate(async () => {
    const store = window.__studio.store
    store.patchBrand({ logo: null, name: '' })
    store.patchText('headline', { font: 'system', weight: 800 })
    store.patchText('subtitle', { font: 'system', weight: 500 })
    await new Promise((r) => setTimeout(r, 700))
    localStorage.removeItem('app-preview-studio.project.v1')
  })
} finally {
  await browser.close()
  if (process.env.KEEP) {
    console.log(`产物已保留: ${artifacts}`)
  } else {
    const { rm } = await import('node:fs/promises')
    await rm(artifacts, { recursive: true, force: true }).catch(() => {})
    await rm(downloadDir, { recursive: true, force: true }).catch(() => {})
  }
}

console.log(failures === 0 ? '\n全部通过 🎉' : `\n${failures} 项失败 ❌`)
process.exitCode = failures === 0 ? 0 : 1
