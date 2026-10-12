/**
 * 导出冒烟测试：真实点击「导出 PNG」，校验
 *   1. 目标像素尺寸
 *   2. PNG 不含 alpha 通道（Apple 对截图与 Creative assets 的硬性要求）
 * 用法：node scripts/verify-export.mjs
 * 依赖：本机 Chrome + 运行中的 dev server (localhost:5173)
 */
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
const EXPECTED = { width: 1284, height: 2778 }

function pngSize(file) {
  const out = execSync(`sips -g pixelWidth -g pixelHeight "${file}"`, { encoding: 'utf8' })
  const width = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1])
  const height = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1])
  return { width, height }
}

/**
 * 直接读 PNG IHDR 判定是否带 alpha 通道。
 *
 * 注意：像素「全不透明」不等于「没有 alpha 通道」——modern-screenshot 会输出
 * colorType 6 (RGBA) 且 alpha 全为 255，sips / 肉眼都看不出来，但 Apple 会拒收。
 * colorType: 0=灰度 2=RGB 3=调色板 4=灰度+Alpha 6=RGBA
 */
async function pngColorType(file) {
  const buf = await readFile(file)
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  if (!isPng) return { colorType: -1, name: '非 PNG', hasAlpha: true }
  const colorType = buf[25]
  const names = { 0: 'Gray', 2: 'RGB', 3: 'Palette', 4: 'Gray+Alpha', 6: 'RGBA' }
  return { colorType, name: names[colorType] ?? `未知(${colorType})`, hasAlpha: colorType === 4 || colorType === 6 }
}

async function waitForPng(dir, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => [])
    const png = files.find((f) => f.endsWith('.png') && !f.endsWith('.crdownload'))
    if (png) {
      const file = join(dir, png)
      // 等文件写完（大小稳定）
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

const downloadDir = await mkdtemp(join(tmpdir(), 'apv-export-'))
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

  // 下载行为：优先 Browser 域，回退 Page 域
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

  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent?.includes('导出'),
    )
    if (!btn) throw new Error('未找到导出按钮')
    btn.click()
  })

  const file = await waitForPng(downloadDir)
  const { width, height } = pngSize(file)
  const color = await pngColorType(file)

  const okW = width === EXPECTED.width
  const okH = height === EXPECTED.height
  const okAlpha = !color.hasAlpha

  console.log(`导出文件: ${file}`)
  console.log(`实际尺寸: ${width} × ${height}`)
  console.log(`期望尺寸: ${EXPECTED.width} × ${EXPECTED.height}`)
  console.log(`尺寸校验: ${okW && okH ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`PNG 色彩类型: ${color.colorType} (${color.name})`)
  console.log(`Alpha 通道校验: ${okAlpha ? 'PASS ✅（无 alpha）' : `FAIL ❌（含 alpha 通道，Apple 会拒收）`}`)
  console.log(`页面错误: ${pageErrors.length === 0 ? '无 ✅' : pageErrors.join(' | ')}`)

  if (!okW || !okH || !okAlpha || pageErrors.length > 0) process.exitCode = 1
} finally {
  await browser.close()
  if (process.env.KEEP) {
    console.log(`产物已保留: ${downloadDir}`)
  } else {
    await rm(downloadDir, { recursive: true, force: true }).catch(() => {})
  }
}
