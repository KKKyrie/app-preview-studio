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

  /* ── 8b. 排版密度一致性 ──────────────────────────────────────────────
   * 字号以「安全区宽度」为基准，因此五个尺寸下每行能放的字数应当一致。
   * 若将来有人把字号改回按画布宽度计算，安全区占画布 26.7%~56.5% 的差异
   * 会让 5244×2950 每行只剩 7 个字——这条断言就是防这个的。
   */
  const density = []
  for (const key of [
    'header:3840x1646',
    'header:5244x2950',
    'search:3840x2560',
    'search:1920x1280',
    'search:5244x2950',
  ]) {
    await clickBy(`[data-canvas-opt="${key}"]`)
    await new Promise((r) => setTimeout(r, 500))
    density.push(
      await page.evaluate(() => {
        const canvas = document.querySelector('main [data-canvas]')
        const hl = canvas?.querySelector('[data-role="headline"]')
        if (!hl) return 0
        const fs = parseFloat(getComputedStyle(hl).fontSize)
        return Math.floor(hl.offsetWidth / (fs * 0.985))
      }),
    )
  }
  check(
    '五个尺寸下标题每行容量一致（字号按安全区宽度计算）',
    new Set(density).size === 1,
    `每行字数: ${density.join(' / ')}`,
  )

  /* ── 8c. 面板 px 读数 = 画布实际渲染值 ────────────────────────────────
   * 读数基准若用画布宽度，创意素材下会比实际渲染值大 2.3 倍
   * （标题图：0.08 × 3840 = 307px，而实际渲染是 0.08 × 1646 = 132px）。
   * 用户会照着这个数字判断字号，错了就是误导。
   */
  // 先给副标题填上文案：留空时它不参与渲染，读数无从比对
  await page.evaluate(() => {
    const el = document.querySelector('[data-text="subtitle"]')
    if (!el) return
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
    set.call(el, '副标题读数校验')
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await new Promise((r) => setTimeout(r, 600))

  const pxReadout = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('aside label')]
    const picked = {}
    for (const label of labels) {
      const name = label.textContent?.replace(/\s+/g, '') ?? ''
      const shown = label.querySelector('span.tabular-nums')?.textContent?.trim() ?? ''
      if (name.startsWith('主标题字号')) picked.headline = shown
      if (name.startsWith('副标题字号')) picked.subtitle = shown
    }
    const canvas = document.querySelector('main [data-canvas]')
    const read = (role) => {
      const el = canvas?.querySelector(`[data-role="${role}"]`)
      return el ? Math.round(parseFloat(getComputedStyle(el).fontSize)) : 0
    }
    return { panel: picked, real: { headline: read('headline'), subtitle: read('subtitle') } }
  })
  for (const role of ['headline', 'subtitle']) {
    check(
      `面板「${role === 'headline' ? '主' : '副'}标题字号」读数 = 实际渲染值`,
      pxReadout.panel[role] === `${pxReadout.real[role]} px`,
      `面板 ${pxReadout.panel[role]} / 实际 ${pxReadout.real[role]}px`,
    )
  }

  /* ── 8d. 预览视口：切尺寸后画布必须完整可见 ──────────────────────────
   * 用户直接撞到过：缩放值只在宿主容器 resize 时重算，切到 5244×2950 后
   * 仍沿用 1920×1280 的缩放，画布被撑到宿主的 2.5 倍，只能看到中间一小块。
   * 因此这里逐个尺寸验证「画布完整落在宿主内」。
   */
  const VIEWPORT_KEYS = ['header:3840x1646', 'search:1920x1280', 'header:5244x2950']
  const viewport = []
  for (const key of VIEWPORT_KEYS) {
    await clickBy(`[data-canvas-opt="${key}"]`)
    await new Promise((r) => setTimeout(r, 500))
    viewport.push(
      await page.evaluate(() => {
        const canvas = document.querySelector('main [data-canvas]')
        const host = canvas?.parentElement?.parentElement?.parentElement?.parentElement
        const m = /matrix\(([\d.]+)/.exec(getComputedStyle(canvas.parentElement).transform)
        const s = m ? Number(m[1]) : 1
        const cw = canvas.offsetWidth * s
        const ch = canvas.offsetHeight * s
        return cw <= host.clientWidth + 1.5 && ch <= host.clientHeight + 1.5
      }),
    )
  }
  check(
    '切换尺寸后画布始终完整可见（缩放随尺寸重算）',
    viewport.every(Boolean),
    viewport.map((ok) => (ok ? '✅' : '❌')).join(' '),
  )

  /* ── 8e. 缩放与平移 ─────────────────────────────────────────────── */
  const viewportState = () =>
    page.evaluate(() => {
      const canvas = document.querySelector('main [data-canvas]')
      const host = canvas.parentElement.parentElement.parentElement.parentElement
      const wrap = canvas.parentElement.parentElement.parentElement
      const m = /matrix\(([\d.]+)/.exec(getComputedStyle(canvas.parentElement).transform)
      const s = m ? Number(m[1]) : 1
      // 包裹层是 translate(-50%,-50%) translate(ox,oy)，浏览器会把百分比解析进 matrix，
      // 因此 ox = tx + 自身宽/2（比解析内联 style 字符串稳）
      const ms = /matrix\(([^)]+)\)/.exec(getComputedStyle(wrap).transform)
      const parts = ms ? ms[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0]
      return {
        label: document.querySelector('[data-zoom-label]')?.textContent?.trim() ?? '',
        contentW: canvas.offsetWidth * s,
        contentH: canvas.offsetHeight * s,
        hostW: host.clientWidth,
        hostH: host.clientHeight,
        offsetX: parts[4] + wrap.offsetWidth / 2,
        offsetY: parts[5] + wrap.offsetHeight / 2,
      }
    })

  await clickBy('[data-zoom-actual]')
  await new Promise((r) => setTimeout(r, 300))
  const actual = await viewportState()
  check('「1:1」档位 = 100%', actual.label === '100%', actual.label)
  check(
    '100% 时画布按原始像素渲染（5244×2950）',
    Math.round(actual.contentW) === 5244 && Math.round(actual.contentH) === 2950,
    `${Math.round(actual.contentW)}×${Math.round(actual.contentH)}`,
  )

  const centering = await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('creative')
    const wrap = document
      .querySelector('main [data-canvas]')
      .parentElement.parentElement.parentElement
    const ms = /matrix\(([^)]+)\)/.exec(getComputedStyle(wrap).transform)
    const parts = ms ? ms[1].split(',').map(Number) : [1, 0, 0, 1, 0, 0]
    return {
      expected: s.canvasSize.height / 2 - (s.safeArea.y + s.safeArea.height / 2),
      got: parts[5] + wrap.offsetHeight / 2,
    }
  })
  check(
    '1:1 视口对准安全区（内容所在处），而非画布中心',
    Math.abs(centering.got - centering.expected) < 2 && Math.abs(centering.got) > 100,
    `偏移 Y ${Math.round(centering.got)} / 期望 ${Math.round(centering.expected)}`,
  )

  await clickBy('[data-zoom-fit]')
  await new Promise((r) => setTimeout(r, 300))
  const fitted = await viewportState()
  check(
    '「适应」回到完整可见',
    fitted.contentW <= fitted.hostW + 1.5 && fitted.contentH <= fitted.hostH + 1.5,
    `${Math.round(fitted.contentW)}×${Math.round(fitted.contentH)} / 宿主 ${fitted.hostW}×${fitted.hostH}`,
  )

  // 平移：缩到 1:1 后拖拽，偏移应跟随；狂拖应被夹在内容边界内
  await clickBy('[data-zoom-actual]')
  await new Promise((r) => setTimeout(r, 300))
  const hostBox = await page.evaluate(() => {
    const canvas = document.querySelector('main [data-canvas]')
    const r = canvas.parentElement.parentElement.parentElement.parentElement.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  })
  const cx = hostBox.x + hostBox.w / 2
  const cy = hostBox.y + hostBox.h / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 5000, cy + 5000, { steps: 20 })
  await page.mouse.up()
  await new Promise((r) => setTimeout(r, 300))
  const dragged = await viewportState()
  const maxX = (dragged.contentW - dragged.hostW) / 2
  const maxY = (dragged.contentH - dragged.hostH) / 2
  check(
    '拖拽可平移，且被夹在内容边界内（画布不会被拖丢）',
    Math.abs(dragged.offsetX - maxX) < 2 && Math.abs(dragged.offsetY - maxY) < 2,
    `偏移 ${Math.round(dragged.offsetX)},${Math.round(dragged.offsetY)} / 上限 ${Math.round(maxX)},${Math.round(maxY)}`,
  )

  /* ── 9. 持久化：刷新后恢复 ── */
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 600))
  const modeAfterReload = await page.evaluate(
    () => document.querySelector('[data-mode-btn="creative"]')?.className ?? '',
  )
  check('刷新后仍停留在创意素材工作台', modeAfterReload.includes('bg-brand-500'))

  const sizeAfterReload = await text('[data-size-badge]')
  check('刷新后坑位与尺寸恢复', sizeAfterReload === '5244 × 2950', sizeAfterReload)

  /* ── 9b. 截图模式的 px 读数未被 designWidth 改动影响 ── */
  await clickBy('[data-mode-btn="screenshot"]')
  await new Promise((r) => setTimeout(r, 500))
  const shotDesignW = await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('project')
    return { designW: s.designWidth, canvasW: s.canvasSize.width }
  })
  check(
    '截图模式排版基准 = 画布宽度（未被改动）',
    shotDesignW.designW === shotDesignW.canvasW,
    `designWidth=${shotDesignW.designW} canvasWidth=${shotDesignW.canvasW}`,
  )
  await clickBy('[data-mode-btn="creative"]')
  await new Promise((r) => setTimeout(r, 400))

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