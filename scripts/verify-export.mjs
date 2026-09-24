/**
 * 导出冒烟测试：真实点击「导出 PNG」，校验下载文件的目标像素尺寸。
 * 用法：node scripts/verify-export.mjs
 * 依赖：本机 Chrome + 运行中的 dev server (localhost:5173)
 */
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises'
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

  const okW = width === EXPECTED.width
  const okH = height === EXPECTED.height

  console.log(`导出文件: ${file}`)
  console.log(`实际尺寸: ${width} × ${height}`)
  console.log(`期望尺寸: ${EXPECTED.width} × ${EXPECTED.height}`)
  console.log(`尺寸校验: ${okW && okH ? 'PASS ✅' : 'FAIL ❌'}`)
  console.log(`页面错误: ${pageErrors.length === 0 ? '无 ✅' : pageErrors.join(' | ')}`)

  if (!okW || !okH || pageErrors.length > 0) process.exitCode = 1
} finally {
  await browser.close()
  if (process.env.KEEP) {
    console.log(`产物已保留: ${downloadDir}`)
  } else {
    await rm(downloadDir, { recursive: true, force: true }).catch(() => {})
  }
}
