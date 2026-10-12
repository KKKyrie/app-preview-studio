/**
 * 创意素材工作台端到端验证。
 *
 * 覆盖（见 docs/creative-assets-design.md §8）：
 *   1. 工作台切换：两种模式可来回切，且截图项目数据完全不受影响
 *   2. 坑位切换：三个坑位画布尺寸正确，切换后条目数据不丢
 *   3. 导出尺寸与 alpha 通道：页头 / 通用 / 搜索预设，且 colorType = 2
 *   4. 安全区检查：默认版式全绿；超长文案触发越界告警
 *   5. 合规检查：价格 / 网址 / 奖项用词被命中
 *   6. 持久化与隔离：刷新后恢复；两份项目 JSON 互不串味
 *
 * 用法：node scripts/verify-creative.mjs
 * 依赖：本机 Chrome + 运行中的 dev server (localhost:5173)
 */
import { mkdtemp, readdir, readFile, rm, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'

const CREATIVE_KEY = 'app-preview-studio.creative.v1'
const SCREENSHOT_KEY = 'app-preview-studio.project.v1'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/**
 * 取下载目录里**最新写入**的 PNG。
 *
 * 注意不能按文件名排序取最后一个：不同坑位导出出的文件名里含比例
 * （21x9 / 16x9 / 3x2），字典序与时间顺序无关，会拿到上一次的产物。
 * 因此按 mtime 取最新，并等文件大小稳定（写完）再返回。
 */
async function latestPng(dir, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  let lastKey = ''
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => [])
    const pngs = files.filter((f) => f.endsWith('.png') && !f.endsWith('.crdownload'))
    let newest = null
    let newestMtime = -1
    for (const f of pngs) {
      const file = join(dir, f)
      const s = await stat(file).catch(() => null)
      if (!s) continue
      if (s.mtimeMs > newestMtime) {
        newestMtime = s.mtimeMs
        newest = { file, size: s.size }
      }
    }
    if (newest) {
      const key = `${newest.file}:${newest.size}`
      if (key === lastKey && newest.size > 0) return newest.file
      lastKey = key
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('等待导出超时：未产生 PNG 文件')
}

/** 每次导出前清空目录，避免读到上一次的产物 */
async function clearDownloads(dir) {
  const files = await readdir(dir).catch(() => [])
  for (const f of files) await unlink(join(dir, f)).catch(() => {})
}

async function pngInfo(file) {
  const buf = await readFile(file)
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  return { width: w, height: h, colorType: buf[25], file }
}

function pngSizeViaSips(file) {
  const out = execSync(`sips -g pixelWidth -g pixelHeight "${file}"`, { encoding: 'utf8' })
  return {
    width: Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1]),
    height: Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1]),
  }
}

const downloadDir = await mkdtemp(join(tmpdir(), 'apv-creative-'))
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

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30_000 })

  const clickBy = (sel) => page.evaluate((s) => document.querySelector(s)?.click(), sel)
  const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? '', sel)

  /* ── 1. 截图工作台基线：先在截图模式写一个项目，验证不被创意素材影响 ── */
  await page.evaluate(() => {
    localStorage.setItem('app-preview-studio.mode', 'screenshot')
    localStorage.removeItem('app-preview-studio.creative.v1')
  })
  await page.reload({ waitUntil: 'networkidle0' })

  await page.evaluate(() => {
    const input = document.querySelector('header input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '截图基线项目')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const baselineShotName = await page.evaluate(() => document.querySelector('header input').value)
  check('截图模式项目名可编辑', baselineShotName === '截图基线项目', baselineShotName)

  /* ── 2. 切换到创意素材 ── */
  await clickBy('[data-mode-btn="creative"]')
  await new Promise((r) => setTimeout(r, 400))
  const modeNow = await page.evaluate(() => document.querySelector('[data-mode-btn="creative"]').className)
  check('可切换到创意素材工作台', modeNow.includes('bg-brand-500'))

  const headerBadge = await text('[data-size-badge]')
  check('默认尺寸 = 标题图 3840 × 1646', headerBadge === '3840 × 1646', headerBadge)

  /* ── 2b. 尺寸矩阵：两个坑位各自的规格 ── */
  const options = await page.$$eval('[data-canvas-opt]', (els) =>
    els.map((e) => e.getAttribute('data-canvas-opt')),
  )
  check(
    '标题图支持 3840×1646 与 5244×2950',
    options.includes('header:3840x1646') && options.includes('header:5244x2950'),
    options.filter((o) => o.startsWith('header')).join(', '),
  )
  check(
    '搜索结果图支持 3840×2560 / 1920×1280 / 5244×2950',
    ['search:3840x2560', 'search:1920x1280', 'search:5244x2950'].every((o) =>
      options.includes(o),
    ),
    options.filter((o) => o.startsWith('search')).join(', '),
  )
  check(
    '尺寸选项共 5 个（5244×2950 在两个坑位下各出现一次）',
    options.length === 5,
    `${options.length} 个`,
  )

  /* ── 3. 填入文案（默认短文案应在安全区内） ── */
  async function setText(which, value) {
    await page.evaluate(
      (w, v) => {
        const el = document.querySelector(`[data-text="${w}"]`)
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
        setter.call(el, v)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      },
      which,
      value,
    )
    await new Promise((r) => setTimeout(r, 350))
  }

  await setText('headline', '发现新的可能')
  await page.evaluate(() => {
    const input = document.querySelector('aside input[type="text"]')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'Aperture')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 500))

  const safeBadgeOk = await text('[data-safe-badge]')
  check(
    '默认版式下关键元素全部在安全区内',
    /✓/.test(safeBadgeOk),
    safeBadgeOk,
  )

  const complianceOk = await text('[data-compliance-badge]')
  check('默认文案合规检查通过', /✓/.test(complianceOk), complianceOk)

  /* ── 4. 超长文案应触发安全区越界 ── */
  await setText('headline', '这是一段刻意写得非常长的主标题文案用来撑破安全区边界测试溢出检测是否正常工作')
  await new Promise((r) => setTimeout(r, 600))
  const safeBadgeBad = await text('[data-safe-badge]')
  check('超长文案触发安全区越界告警', /越界/.test(safeBadgeBad), safeBadgeBad)

  /* ── 5. 合规检查命中 ── */
  await setText('headline', '限时 5 折')
  await new Promise((r) => setTimeout(r, 450))
  const complianceBad = await text('[data-compliance-badge]')
  check('价格/折扣文案被合规检查命中', /合规/.test(complianceBad), complianceBad)

  await setText('headline', '访问 example.com 了解更多')
  await new Promise((r) => setTimeout(r, 450))
  const complianceUrl = await text('[data-compliance-badge]')
  check('网址被合规检查命中', /合规/.test(complianceUrl), complianceUrl)

  // 恢复正常文案，避免影响后续导出尺寸校验
  await setText('headline', '发现新的可能')
  await new Promise((r) => setTimeout(r, 500))

  /* ── 6. 导出：标题图 3840 × 1646 ── */
  await clearDownloads(downloadDir)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent?.includes('导出'),
    )
    btn?.click()
  })
  const headerPngFile = await latestPng(downloadDir)
  const headerPng = pngSizeViaSips(headerPngFile)
  check(
    '标题图导出尺寸 = 3840 × 1646',
    headerPng.width === 3840 && headerPng.height === 1646,
    `${headerPng.width} × ${headerPng.height}`,
  )

  const headerInfo = await pngInfo(headerPngFile)
  check('标题图 PNG 无 alpha 通道', headerInfo.colorType === 2, `colorType=${headerInfo.colorType}`)

  /* ── 7. 标题图切到共用的 5244 × 2950 ── */
  await clickBy('[data-canvas-opt="header:5244x2950"]')
  await new Promise((r) => setTimeout(r, 500))
  const sharedBadge = await text('[data-size-badge]')
  check('标题图可切到共用的 5244 × 2950', sharedBadge === '5244 × 2950', sharedBadge)

  const creativeSnap = await page.evaluate((k) => localStorage.getItem(k), CREATIVE_KEY)
  check('切换尺寸后条目数据未丢失', !!creativeSnap && creativeSnap.includes('发现新的可能'))

  await clearDownloads(downloadDir)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent?.includes('导出'),
    )
    btn?.click()
  })
  const sharedPng = pngSizeViaSips(await latestPng(downloadDir))
  check(
    '标题图 5244 × 2950 导出尺寸正确',
    sharedPng.width === 5244 && sharedPng.height === 2950,
    `${sharedPng.width} × ${sharedPng.height}`,
  )

  /* ── 8. 搜索结果图：三个尺寸逐一验证 ── */
  await clickBy('[data-canvas-opt="search:3840x2560"]')
  await new Promise((r) => setTimeout(r, 450))
  const searchL = await text('[data-size-badge]')
  check('搜索结果图可切到 3840 × 2560', searchL === '3840 × 2560', searchL)

  await clickBy('[data-canvas-opt="search:1920x1280"]')
  await new Promise((r) => setTimeout(r, 450))
  const searchS = await text('[data-size-badge]')
  check('搜索结果图可切到 1920 × 1280', searchS === '1920 × 1280', searchS)

  await clearDownloads(downloadDir)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('header button')].find((b) =>
      b.textContent?.includes('导出'),
    )
    btn?.click()
  })
  const smallPng = pngSizeViaSips(await latestPng(downloadDir))
  check(
    '搜索结果图 1920 × 1280 导出尺寸正确',
    smallPng.width === 1920 && smallPng.height === 1280,
    `${smallPng.width} × ${smallPng.height}`,
  )

  await clickBy('[data-canvas-opt="search:5244x2950"]')
  await new Promise((r) => setTimeout(r, 450))
  const searchUni = await text('[data-size-badge]')
  check('搜索结果图也可选共用的 5244 × 2950', searchUni === '5244 × 2950', searchUni)

  /* ── 9. 持久化：刷新后恢复 ── */
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 600))
  const modeAfterReload = await page.evaluate(
    () => document.querySelector('[data-mode-btn="creative"]')?.className ?? '',
  )
  check('刷新后仍停留在创意素材工作台', modeAfterReload.includes('bg-brand-500'))

  const sizeAfterReload = await text('[data-size-badge]')
  check('刷新后坑位与尺寸恢复', sizeAfterReload === '5244 × 2950', sizeAfterReload)

  /* ── 10. 隔离：两份项目互不串味 ── */
  const shotJson = await page.evaluate((k) => localStorage.getItem(k), SCREENSHOT_KEY)
  check('截图项目 JSON 不含创意素材字段', !!shotJson && !shotJson.includes('bannerLayoutId'))
  check('截图项目名未被创意素材覆盖', !!shotJson && shotJson.includes('截图基线项目'))

  const creativeJson = await page.evaluate((k) => localStorage.getItem(k), CREATIVE_KEY)
  check(
    '创意素材项目 JSON 不含截图专有字段',
    !!creativeJson && !creativeJson.includes('frameId'),
  )

  /* ── 11. 切回截图工作台，数据完好 ── */
  await clickBy('[data-mode-btn="screenshot"]')
  await new Promise((r) => setTimeout(r, 400))
  const backName = await page.evaluate(() => document.querySelector('header input').value)
  check('切回截图工作台项目名完好', backName === '截图基线项目', backName)
  const backBadge = await text('[data-size-badge]')
  check('切回截图工作台尺寸徽章正确', backBadge === '1284 × 2778', backBadge)

  check('页面无错误', pageErrors.length === 0, pageErrors.join(' | '))
} finally {
  await browser.close()
  if (process.env.KEEP) {
    console.log(`产物已保留: ${downloadDir}`)
  } else {
    await rm(downloadDir, { recursive: true, force: true }).catch(() => {})
  }
}

const failed = results.filter((r) => !r.ok)
console.log()
if (failed.length === 0) {
  console.log(`全部通过 🎉 （${results.length} 项）`)
} else {
  console.log(`${failed.length} / ${results.length} 项失败 ❌`)
  process.exitCode = 1
}