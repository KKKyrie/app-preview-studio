/**
 * M3 工作流验证：
 *  1. 批量 ZIP 导出 → 校验包内 PNG 数量 / 命名 / 像素尺寸
 *  2. 页面刷新   → 校验 localStorage 项目恢复（项目名 / 条目数 / 激活项）
 * 用法：node scripts/verify-workflow.mjs
 */
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

import { unzipSync } from 'fflate'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
const EXPECTED = { width: 1284, height: 2778, items: 3 }
const PROJECT_NAME = '验证项目-ZIP'

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

async function waitForFile(dir, ext, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => [])
    const hit = files.find((f) => f.endsWith(ext) && !f.endsWith('.crdownload'))
    if (hit) {
      const file = join(dir, hit)
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
  throw new Error(`等待 ${ext} 文件超时`)
}

const downloadDir = await mkdtemp(join(tmpdir(), 'apv-zip-'))
const extractDir = join(downloadDir, 'extracted')
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
  await page.waitForFunction(() => Boolean(window.__studio), { timeout: 10_000 })

  // 从干净状态开始：清掉历史持久化数据
  await page.evaluate(() => localStorage.removeItem('app-preview-studio.project.v1'))
  await page.reload({ waitUntil: 'networkidle0', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(window.__studio), { timeout: 10_000 })

  // 下载行为
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

  // ── 准备：3 个条目 + 项目名 ──
  await page.evaluate((name) => {
    const s = window.__studio.store
    while (s.items.length < 3) s.addScreenshot()
    s.projectName = name
  }, PROJECT_NAME)
  await new Promise((r) => setTimeout(r, 1200)) // 等待防抖写入 localStorage

  // ── 1. 批量 ZIP 导出 ──
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent?.includes('批量 ZIP'),
    )
    if (!btn) throw new Error('未找到批量导出按钮')
    btn.click()
  })

  const zipFile = await waitForFile(downloadDir, '.zip')
  check('批量导出产生 ZIP', true, zipFile.split('/').pop())

  // 用 fflate 解压校验（不依赖系统 unzip 命令）
  const tree = unzipSync(new Uint8Array(await readFile(zipFile)))
  const entries = Object.keys(tree)
    .filter((f) => f.endsWith('.png'))
    .sort()
  await mkdir(extractDir, { recursive: true })
  for (const name of entries) await writeFile(join(extractDir, name), tree[name])
  check(
    'ZIP 内含 3 张 PNG',
    entries.length === 3,
    entries.join(', ') || '空',
  )
  const namesOk = entries.every((f, i) =>
    f.startsWith(`${PROJECT_NAME}_1284x2778_0${i + 1}`),
  )
  check('PNG 命名含项目名/尺寸/序号', namesOk, entries[0] ?? '')

  if (entries.length > 0) {
    const { width, height } = pngSize(join(extractDir, entries[0]))
    check(
      '包内 PNG 像素尺寸',
      width === EXPECTED.width && height === EXPECTED.height,
      `${width} × ${height}`,
    )
  }

  // ── 2. 刷新后恢复 ──
  await page.reload({ waitUntil: 'networkidle0', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(window.__studio), { timeout: 10_000 })
  await new Promise((r) => setTimeout(r, 500))

  const restored = await page.evaluate(() => {
    const s = window.__studio.store
    return {
      projectName: s.projectName,
      items: s.items.length,
      activeExists: Boolean(s.items.find((i) => i.id === s.activeItemId)),
    }
  })
  check('刷新后项目名恢复', restored.projectName === PROJECT_NAME, restored.projectName)
  check('刷新后条目数恢复', restored.items === EXPECTED.items, `items=${restored.items}`)
  check('刷新后激活项有效', restored.activeExists)

  // 清理验证残留，避免污染日常手动使用
  await page.evaluate(() => localStorage.removeItem('app-preview-studio.project.v1'))

  check('页面无错误', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
  if (process.env.KEEP) {
    console.log(`产物已保留: ${downloadDir}`)
  } else {
    await rm(downloadDir, { recursive: true, force: true }).catch(() => {})
  }
}

console.log(failures === 0 ? '\n全部通过 🎉' : `\n${failures} 项失败`)
process.exitCode = failures === 0 ? 0 : 1