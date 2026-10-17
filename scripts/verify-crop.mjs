/**
 * 图片裁剪工作台端到端验证。
 *
 * 覆盖（见 docs/creative-assets-design.md §15）：
 *   1. 工作台切换：三档可来回切，另外两个工作台的数据完全不受影响
 *   2. 画框锁定官方比例：尺寸矩阵与创意工作台同源
 *   3. 裁剪几何：cover 铺满、offset 归一化、切尺寸构图按比例保留
 *   4. 双层缩放：画布滚轮改构图，⌘+滚轮改预览
 *   5. 夹紧：offset ∈ [-1,1]；无余量的轴锁 0（拖不动也不留偏差）
 *   6. 批量导入：空位优先、追加不覆盖、上限 12
 *   7. 画质：源图被放大时给出量化告警，且画布与顶栏文案一致
 *   8. 安全区叠加层：渲染位置与画布几何零偏差，且**绝不进入导出**
 *   9. 导出当前尺寸 / 一键全部尺寸：尺寸、比例、无 alpha、ZIP 条目名
 *  10. 持久化与隔离：刷新恢复；三份项目 JSON 互不串味
 *  11. 删除出口：唯一一张也能删、删空是合法状态（空画框 + 空状态 + 导出置灰）
 *
 * 用法：node scripts/verify-crop.mjs
 * 依赖：本机 Chrome + 运行中的 dev server（默认 localhost:5173，端口被占用时
 *       用 `APP_URL=http://localhost:5175/ npm run verify:crop`）
 */
import { mkdtemp, readdir, readFile, rm, stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { unzipSync } from 'fflate'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL_ = process.env.APP_URL ?? 'http://localhost:5173/'

const CROP_KEY = 'app-preview-studio.crop.v1'
const CREATIVE_KEY = 'app-preview-studio.creative.v1'
const SCREENSHOT_KEY = 'app-preview-studio.project.v1'

/** 测试源图：纯色，便于像素级断言「叠加层没进导出」 */
const SRC_RGB = [0, 200, 83]
const SRC_HEX = '#00c853'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** 取下载目录里**最新写入**的指定后缀文件（写完 = 大小连续两次相同） */
async function latestFile(dir, ext, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs
  let lastKey = ''
  while (Date.now() < deadline) {
    const files = await readdir(dir).catch(() => [])
    const hit = files.filter((f) => f.endsWith(ext) && !f.endsWith('.crdownload'))
    let newest = null
    let newestMtime = -1
    for (const f of hit) {
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
  throw new Error(`等待导出超时：未产生 ${ext} 文件`)
}

/** 每次导出前清空目录，避免读到上一次的产物 */
async function clearDownloads(dir) {
  for (const f of await readdir(dir).catch(() => [])) {
    await unlink(join(dir, f)).catch(() => {})
  }
}

async function pngInfo(file) {
  const buf = await readFile(file)
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), colorType: buf[25] }
}

const downloadDir = await mkdtemp(join(tmpdir(), 'apv-crop-'))
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

  await page.goto(URL_, { waitUntil: 'networkidle0', timeout: 30_000 })

  const clickBy = (sel) => page.evaluate((q) => document.querySelector(q)?.click(), sel)
  const text = (sel) => page.evaluate((q) => document.querySelector(q)?.textContent?.trim() ?? '', sel)
  const cropState = () =>
    page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
      return {
        items: s.items.length,
        filled: s.items.filter((i) => i.image).length,
        activeId: s.activeItemId,
        src: `${s.activeItem?.width}×${s.activeItem?.height}`,
        canvas: `${s.canvasSize.width}×${s.canvasSize.height}`,
        zoom: Number(s.activeItem?.zoom?.toFixed(4)),
        ox: Number(s.activeItem?.offset?.x?.toFixed(4)),
        oy: Number(s.activeItem?.offset?.y?.toFixed(4)),
        slack: `${s.slack.x.toFixed(1)},${s.slack.y.toFixed(1)}`,
        coverage: s.sourceCoverage == null ? null : Number(s.sourceCoverage.toFixed(4)),
        cropLocked: s.cropLocked,
      }
    })

  /** 造一张纯色源图（宽高可控）并走「点击导入」那条路径 */
  async function importImage(w, h, name) {
    await page.evaluate(
      async (ww, hh, n, color) => {
        const c = document.createElement('canvas')
        c.width = ww
        c.height = hh
        const x = c.getContext('2d')
        x.fillStyle = color
        x.fillRect(0, 0, ww, hh)
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'))
        const dt = new DataTransfer()
        dt.items.add(new File([blob], n, { type: 'image/png' }))
        const input = document.querySelector('aside input[data-crop-file-input]')
        input.files = dt.files
        input.dispatchEvent(new Event('change', { bubbles: true }))
      },
      w,
      h,
      name,
      SRC_HEX,
    )
    await new Promise((r) => setTimeout(r, 1100))
  }

  /** 舞台画布（main 里的那个；aside 里的缩略图也是 [data-canvas]，必须限定容器） */
  const stageBox = () =>
    page.evaluate(() => {
      const r = document.querySelector('main [data-canvas]').getBoundingClientRect()
      return { cx: r.x + r.width / 2, cy: r.y + r.height / 2, x: r.x, y: r.y, w: r.width, h: r.height }
    })

  async function dragBy(dx, dy) {
    const b = await stageBox()
    await page.mouse.move(b.cx, b.cy)
    await page.mouse.down()
    await page.mouse.move(b.cx + dx, b.cy + dy, { steps: 10 })
    await page.mouse.up()
    await new Promise((r) => setTimeout(r, 300))
  }

  /** 在浏览器里解码 PNG 并抽样像素（用于断言叠加层没进导出） */
  async function samplePixels(file) {
    const buf = await readFile(file)
    const dataUrl = `data:image/png;base64,${buf.toString('base64')}`
    return page.evaluate(async (url) => {
      const img = new Image()
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
        img.src = url
      })
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const out = []
      // 含四条边界（浮点几何在边缘留缝会露出画框底色，这里必须覆盖到）
      const xs = [0, ...Array.from({ length: 30 }, (_, i) => Math.round(((i + 1) * img.naturalWidth) / 31)), img.naturalWidth - 1]
      const ys = [0, ...Array.from({ length: 16 }, (_, i) => Math.round(((i + 1) * img.naturalHeight) / 17)), img.naturalHeight - 1]
      for (const y of ys) {
        for (const x of xs) {
          const d = ctx.getImageData(x, y, 1, 1).data
          out.push([d[0], d[1], d[2]])
        }
      }
      return { w: img.naturalWidth, h: img.naturalHeight, count: out.length, samples: out }
    }, dataUrl)
  }

  /* ── 1. 截图工作台基线 ── */
  await page.evaluate(() => {
    localStorage.setItem('app-preview-studio.mode', 'screenshot')
    localStorage.removeItem('app-preview-studio.crop.v1')
    localStorage.removeItem('app-preview-studio.creative.v1')
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    const input = document.querySelector('header input')
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, '截图基线项目')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  check(
    '截图模式项目名可编辑（基线）',
    (await page.evaluate(() => document.querySelector('header input').value)) === '截图基线项目',
  )

  /* ── 2. 三档工作台切换 ── */
  const tabs = await page.$$eval('[data-mode-btn]', (els) =>
    els.map((e) => e.getAttribute('data-mode-btn')),
  )
  check(
    '工作台共三档：截图 / 创意素材 / 图片裁剪',
    tabs.join(',') === 'screenshot,creative,crop',
    tabs.join(','),
  )

  await clickBy('[data-mode-btn="crop"]')
  await new Promise((r) => setTimeout(r, 500))
  check(
    '可切换到图片裁剪工作台',
    (await page.evaluate(() => document.querySelector('[data-mode-btn="crop"]').className)).includes(
      'bg-brand-500',
    ),
  )
  check('空状态给出导入引导', await page.evaluate(() => document.querySelector('main')?.innerText?.includes('把成品图拖进来')))
  const panelTitles = await page.$$eval('aside h3', (els) => els.map((e) => e.textContent.trim()))
  check(
    '裁剪工作台只有裁剪该有的面板（没有主题 / 版式 / 品牌 / 文案）',
    panelTitles.join(',') === '图片,坑位与尺寸,构图,安全区,一键全部尺寸,项目',
    panelTitles.join(' | '),
  )

  /* ── 3. 画框尺寸矩阵与创意工作台同源 ── */
  const options = await page.$$eval('[data-canvas-opt]', (els) =>
    els.map((e) => e.getAttribute('data-canvas-opt')),
  )
  check(
    '尺寸选项 5 个，与创意工作台完全一致',
    options.length === 5 &&
      ['header:3840x1646', 'header:5244x2950', 'search:3840x2560', 'search:1920x1280', 'search:5244x2950'].every(
        (o) => options.includes(o),
      ),
    options.join(', '),
  )
  check('默认画框 = 标题图 3840 × 1646', (await text('[data-size-badge]')) === '3840 × 1646')

  /* ── 4. 导入 + cover 几何 ── */
  await importImage(2400, 1600, 'hero.png')
  let s = await cropState()
  check('导入后条目填入空位（不是新增第二项）', s.items === 1 && s.filled === 1, `items=${s.items} filled=${s.filled}`)
  check('源图像素尺寸被正确读出', s.src === '2400×1600', s.src)
  check('初始构图 = 刚好铺满 + 居中', s.zoom === 1 && s.ox === 0 && s.oy === 0)

  const geom = await page.evaluate(() => {
    const img = document.querySelector('main [data-crop-image]')
    return { left: img.style.left, top: img.style.top, w: img.style.width, h: img.style.height }
  })
  // 3:2 源图进 21:9 画框：宽度顶满 3840，高度 2560，垂直多出 914 → slack.y 457
  check(
    'cover 几何正确：宽度顶满、高度溢出、居中',
    geom.left === '0px' && geom.top === '-457px' && geom.w === '3840px' && geom.h === '2560px',
    `${geom.left} ${geom.top} ${geom.w} × ${geom.h}`,
  )
  check('水平无余量 → slack.x = 0（该轴锁定）', s.slack === '0.0,457.0', s.slack)

  /* ── 5. 拖拽调整构图 ── */
  await dragBy(0, -120)
  s = await cropState()
  const topAfterDrag = await page.evaluate(() =>
    Number.parseFloat(document.querySelector('main [data-crop-image]').style.top),
  )
  check(
    '上拖 → 看到源图更靠下的部分（offset.y 变正、图片 top 变负）',
    s.oy > 0.1 && topAfterDrag < -457,
    `offset.y=${s.oy}, top=${topAfterDrag}px`,
  )
  check('拖拽没有触发原生图片拖放（条目数不变）', s.items === 1, `items=${s.items}`)

  await dragBy(0, 400)
  s = await cropState()
  check('下拖被夹在 -1（贴住源图上边缘）', s.oy === -1, `offset.y=${s.oy}`)

  /* ── 6. 双层缩放 ── */
  await clickBy('[data-crop-center]')
  await new Promise((r) => setTimeout(r, 250))
  let b = await stageBox()
  await page.mouse.move(b.cx, b.cy)
  await page.mouse.wheel({ deltaY: -120 })
  await new Promise((r) => setTimeout(r, 350))
  s = await cropState()
  const previewAfterCropWheel = await page.evaluate(() => {
    const r = document.querySelector('main [data-canvas]').getBoundingClientRect()
    return Math.round(r.width)
  })
  check('画布上的滚轮缩放的是**源图**（构图）', s.zoom > 1, `zoom=${s.zoom}`)
  check('且预览尺寸不变（两层缩放没有串）', previewAfterCropWheel === Math.round(b.w), `${previewAfterCropWheel} vs ${Math.round(b.w)}`)
  check('放大后水平方向也出现余量', s.slack !== '0.0,457.0', s.slack)

  await page.keyboard.down('Meta')
  await page.mouse.wheel({ deltaY: -120 })
  await page.keyboard.up('Meta')
  await new Promise((r) => setTimeout(r, 450))
  const s2 = await cropState()
  const previewAfterViewportWheel = await page.evaluate(() => {
    const r = document.querySelector('main [data-canvas]').getBoundingClientRect()
    return Math.round(r.width)
  })
  check('⌘+滚轮缩放的是**预览**，源图构图不动', s2.zoom === s.zoom, `${s.zoom} → ${s2.zoom}`)
  check('预览确实被放大了', previewAfterViewportWheel > previewAfterCropWheel, `${previewAfterCropWheel} → ${previewAfterViewportWheel}`)

  /* ── 7. 切尺寸：构图按比例保留 ── */
  const before = await cropState()
  await clickBy('[data-canvas-opt="header:5244x2950"]')
  await new Promise((r) => setTimeout(r, 800))
  s = await cropState()
  check(
    '切到 16:9 后构图（zoom / offset）按比例保留',
    s.zoom === before.zoom && s.ox === before.ox && s.oy === before.oy,
    `zoom ${before.zoom}→${s.zoom}, offset (${before.ox},${before.oy})→(${s.ox},${s.oy})`,
  )
  const geom169 = await page.evaluate(() => {
    const img = document.querySelector('main [data-crop-image]')
    return {
      left: Number.parseFloat(img.style.left),
      w: Number.parseFloat(img.style.width),
      h: Number.parseFloat(img.style.height),
    }
  })
  check(
    '16:9 画框下几何按新画框重算（两个方向都盖住画框、余量左右对称）',
    geom169.w >= 5244 &&
      geom169.h >= 2950 &&
      Math.abs(-2 * geom169.left - (geom169.w - 5244)) < 2,
    `left=${geom169.left} ${geom169.w}×${geom169.h}（画框 5244×2950）`,
  )
  check(
    '切尺寸后预览自动回到适应窗口',
    await page.evaluate(() => {
      const r = document.querySelector('main [data-canvas]').getBoundingClientRect()
      const host = document.querySelector('main').getBoundingClientRect()
      return r.width <= host.width && r.height <= host.height
    }),
  )

  /* ── 8. 竖图：水平锁 0 ── */
  await clickBy('[data-canvas-opt="header:3840x1646"]')
  await new Promise((r) => setTimeout(r, 700))
  await importImage(800, 1200, 'portrait.png')
  s = await cropState()
  check('竖图进超宽画框：水平锁 0、靠垂直方向裁', s.slack.startsWith('0.0,'), s.slack)
  check(
    '无余量的轴不给滑杆（避免「滑了没反应」）',
    await page.evaluate(() => (document.querySelector('aside')?.innerText ?? '').includes('水平方向已铺满')),
  )
  await dragBy(120, 0)
  check('水平方向拖拽不产生偏移（不留偏差）', (await cropState()).ox === 0)

  /* ── 9. 批量导入与上限 ── */
  await clickBy('[data-crop-item="0"]')
  await new Promise((r) => setTimeout(r, 400))
  await importImage(1600, 1600, 'square.png')
  s = await cropState()
  check('再次导入 → 追加为新条目，已有构图不被动', s.items === 3 && s.filled === 3, `items=${s.items} filled=${s.filled}`)
  check('新条目成为激活项（用户马上能调它的构图）', s.src === '1600×1600', s.src)

  await page.evaluate(() => {
    // 用**真实可解码**的 4×4 PNG：塞坏 dataURL 会引发 ERR_INVALID_URL，
    // 把「页面无错误」那条断言污染成假失败
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 4
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#333'
    ctx.fillRect(0, 0, 4, 4)
    const url = c.toDataURL('image/png')
    for (let i = 0; i < 20; i++) s.importImage(url, 'tiny.png', 4, 4)
  })
  s = await cropState()
  check('条目数上限 = 12', s.items === 12, `items=${s.items}`)

  /* ── 10. 画质告警 ── */
  await clickBy('[data-crop-item="2"]')
  await new Promise((r) => setTimeout(r, 400))
  s = await cropState()
  check('源图小于画框 → 画质告警给出放大量化', s.coverage !== null && s.coverage < 1, `coverage=${s.coverage}`)
  const badge = await text('[data-crop-quality]')
  const toolbarBadge = await text('[data-crop-quality-badge]')
  check('画布与顶栏的画质文案一致', badge === toolbarBadge && badge.includes('会被放大'), `${badge} / ${toolbarBadge}`)
  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    s.setZoom(1)
  })
  await new Promise((r) => setTimeout(r, 250))

  /* ── 11. 安全区叠加层：位置零偏差 + 可关闭 ── */
  const safeProbe = await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    const canvasEl = document.querySelector('main [data-canvas]')
    const cr = canvasEl.getBoundingClientRect()
    const k = cr.width / s.canvasSize.width
    const dash = [...canvasEl.querySelectorAll('div')].find((d) =>
      getComputedStyle(d).borderStyle.includes('dashed'),
    )
    if (!dash) return null
    const dr = dash.getBoundingClientRect()
    const safe = s.safeArea
    return {
      dx: Math.round(dr.x - (cr.x + safe.x * k)),
      dy: Math.round(dr.y - (cr.y + safe.y * k)),
      dw: Math.round(dr.width - safe.width * k),
      dh: Math.round(dr.height - safe.height * k),
    }
  })
  check(
    '安全区叠加层与画布几何零偏差',
    safeProbe && [safeProbe.dx, safeProbe.dy, safeProbe.dw, safeProbe.dh].every((v) => Math.abs(v) <= 1),
    JSON.stringify(safeProbe),
  )

  await clickBy('[data-crop-safe-toggle]')
  await new Promise((r) => setTimeout(r, 300))
  check(
    '可关闭安全区叠加层',
    (await page.evaluate(() => document.querySelectorAll('main [data-canvas] div[aria-hidden="true"]').length)) === 0,
  )
  await clickBy('[data-crop-safe-toggle]')
  await new Promise((r) => setTimeout(r, 300))

  /* ── 12. 导出当前尺寸 ── */
  await clickBy('[data-crop-item="0"]')
  await new Promise((r) => setTimeout(r, 400))
  check('顶栏导出按钮文案区分「当前」与「全部」', (await text('[data-export-active]')) === '导出当前尺寸' && (await text('[data-export-all]')).startsWith('导出全部尺寸'))

  // 先放大再导出：图片此时**超出画框**，正是外部 CSS（Tailwind preflight 的
  // `img { max-width: 100% }`）会把成品裁掉一大块的区间。zoom=1 时图片不溢出，
  // 这个 bug 完全测不出来 —— 像素断言必须跑在放大状态下。
  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    s.resetCrop()
    s.setZoom(1.8)
  })
  await new Promise((r) => setTimeout(r, 400))
  const overflow = await page.evaluate(() => {
    const img = document.querySelector('main [data-crop-image]')
    return {
      w: Number.parseFloat(img.style.width),
      maxW: getComputedStyle(img).maxWidth,
      frame: document.querySelector('main [data-canvas]').getBoundingClientRect().width,
    }
  })
  check(
    '放大后图片绘制宽度超出画框（几何上必然溢出，且未被外部 CSS 截断）',
    overflow.w > 3840 && overflow.maxW === 'none',
    `width=${overflow.w}px max-width=${overflow.maxW}`,
  )

  await clearDownloads(downloadDir)
  await clickBy('[data-export-active]')
  const single = await latestFile(downloadDir, '.png')
  const singleInfo = await pngInfo(single)
  check(
    '导出当前尺寸 = 画框像素',
    singleInfo.width === 3840 && singleInfo.height === 1646,
    `${singleInfo.width} × ${singleInfo.height}`,
  )
  check('导出 PNG 无 alpha 通道（colorType = 2）', singleInfo.colorType === 2, `colorType=${singleInfo.colorType}`)

  /* ── 13. 叠加层绝不进入导出（像素级）── */
  const px = await samplePixels(single)
  const bad = px.samples.filter(
    (c) => Math.abs(c[0] - SRC_RGB[0]) > 2 || Math.abs(c[1] - SRC_RGB[1]) > 2 || Math.abs(c[2] - SRC_RGB[2]) > 2,
  )
  check(
    '导出成品 = 纯源图（叠加层 / 虚线 / 压暗 / 画框底色 / 被截断的空白都没进去）',
    bad.length === 0,
    bad.length === 0 ? `抽样 ${px.count} 点全为源图纯色` : `${bad.length}/${px.count} 点被污染，例 ${JSON.stringify(bad[0])}`,
  )

  /* ── 14. 一键全部尺寸（ZIP）── */
  await clearDownloads(downloadDir)
  await clickBy('[data-export-all]')
  const zipFile = await latestFile(downloadDir, '.zip')
  const zipBuf = await readFile(zipFile)
  const entries = unzipSync(new Uint8Array(zipBuf))
  const names = Object.keys(entries)
  check('一键全部尺寸产出 ZIP', names.length === 4, `${names.length} 个条目：${names.join(' | ')}`)
  // PNG 头：12-15 宽、16-19 高、25 色彩类型
  const dims = names.map((n) => {
    const dv = new DataView(entries[n].buffer, entries[n].byteOffset, entries[n].byteLength)
    return { name: n, width: dv.getUint32(16), height: dv.getUint32(20), colorType: entries[n][25] }
  })
  check(
    'ZIP 内 4 个尺寸 = 21:9 / 16:9 / 3:2 ×2（WxH 去重后 4 个）',
    dims
      .map((d) => `${d.width}x${d.height}`)
      .sort()
      .join(',') === '1920x1280,3840x1646,3840x2560,5244x2950',
    dims.map((d) => `${d.width}x${d.height}`).join(', '),
  )
  check('ZIP 内每张都无 alpha 通道', dims.every((d) => d.colorType === 2), dims.map((d) => d.colorType).join(','))
  check(
    '通用尺寸在文件名里带「双坑位共用」标记',
    names.some((n) => n.includes('16x9') && n.includes('双坑位') && n.includes('5244x2950')),
    names.find((n) => n.includes('5244')) ?? '(无)',
  )
  check(
    'ZIP 条目名标注为 UTF-8（中文文件名在各系统上都不乱码）',
    (zipBuf.readUInt16LE(6) & 0x0800) !== 0 && names.every((n) => !n.includes('\uFFFD')),
    `flag=0x${zipBuf.readUInt16LE(6).toString(16)} 首条=${names[0]}`,
  )
  check('ZIP 里的 PNG 能正常解码（尺寸头可读）', dims.every((d) => d.width > 0 && d.height > 0))

  /* ── 15. 持久化：刷新后构图恢复 ── */
  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    s.setZoom(1.8)
    s.setAxis('y', 0.42)
  })
  await new Promise((r) => setTimeout(r, 900))
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1200))
  s = await cropState()
  check(
    '刷新后构图（zoom / offset）恢复',
    s.zoom === 1.8 && s.oy === 0.42,
    `zoom=${s.zoom} offset.y=${s.oy}`,
  )
  check('刷新后仍停留在图片裁剪工作台', (await page.evaluate(() => localStorage.getItem('app-preview-studio.mode'))) === 'crop')
  check('刷新后画框尺寸恢复', s.canvas === '3840×1646', s.canvas)
  check('刷新后图片从 IndexedDB 回填', s.filled > 0 && s.src === '2400×1600', `filled=${s.filled} src=${s.src}`)
  check(
    '刷新后重新适应窗口（不会沿用上一个尺寸的缩放）',
    await page.evaluate(() => {
      const r = document.querySelector('main [data-canvas]').getBoundingClientRect()
      const host = document.querySelector('main').getBoundingClientRect()
      return r.width <= host.width && r.height <= host.height
    }),
  )

  /* ── 16. 三份项目互不串味 ── */
  const cropJson = await page.evaluate((k) => localStorage.getItem(k), CROP_KEY)
  check('裁剪项目 JSON 含自己的 key', !!cropJson && cropJson.includes('placementId'))
  check(
    '裁剪项目 JSON 不含任何设计字段（主题 / 版式 / 品牌 / 文案）',
    !!cropJson && !/themeId|bannerLayoutId|brand|headline|subtitle|frameId/.test(cropJson),
  )
  const shotJson = await page.evaluate((k) => localStorage.getItem(k), SCREENSHOT_KEY)
  check('截图项目 JSON 不含坑位字段（创意 / 裁剪专有）', !!shotJson && !shotJson.includes('placementId'))
  check('截图项目名未被裁剪工作台覆盖', !!shotJson && shotJson.includes('截图基线项目'))

  await clickBy('[data-mode-btn="screenshot"]')
  await new Promise((r) => setTimeout(r, 400))
  check('切回截图工作台项目名完好', (await page.evaluate(() => document.querySelector('header input').value)) === '截图基线项目')
  check('切回截图工作台尺寸徽章正确', (await text('[data-size-badge]')) === '1284 × 2778')
  check(
    '截图模式排版基准仍 = 画布宽度（未被改动）',
    await page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('project')
      return s.designWidth === s.canvasSize.width
    }),
  )

  await clickBy('[data-mode-btn="creative"]')
  await new Promise((r) => setTimeout(r, 400))
  check(
    '切换到创意素材工作台正常（创意 store 未受裁剪影响）',
    (await text('[data-size-badge]')) === '3840 × 1646',
    await text('[data-size-badge]'),
  )
  check('创意素材项目 JSON 未被裁剪工作台污染', !(await page.evaluate((k) => localStorage.getItem(k) ?? '', CREATIVE_KEY)).includes('crop'))

  /* ── 17. 删除出口：唯一一张也能删，删空是合法状态 ── */
  await clickBy('[data-mode-btn="crop"]')
  await new Promise((r) => setTimeout(r, 400))

  // 先直接调 store 删到只剩一张（等价于连点 11 次，省点时间）
  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    s.items.slice(1).forEach((i) => s.removeItem(i.id))
  })
  await new Promise((r) => setTimeout(r, 300))
  check(
    '只剩一张时「删除」按钮可用（旧版要求 length > 1，唯一一张图删不掉）',
    !(await page.evaluate(() => document.querySelector('aside [data-crop-remove]').disabled)),
  )

  // 走真实的点击路径删掉最后一张
  await clickBy('aside [data-crop-remove]')
  await new Promise((r) => setTimeout(r, 300))
  const emptied = await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    const r = document.querySelector('main [data-canvas]')?.getBoundingClientRect()
    return {
      items: s.items.length,
      activeId: s.activeItemId,
      activeNone: s.activeItem == null,
      stageHint: (document.querySelector('main')?.innerText ?? '').includes('把成品图拖进来'),
      panelEmpty: !!document.querySelector('aside [data-crop-empty]'),
      canvasW: r ? Math.round(r.width) : 0,
      removeOff: document.querySelector('aside [data-crop-remove]').disabled,
      exportOff:
        document.querySelector('[data-export-active]').disabled &&
        document.querySelector('[data-export-all]').disabled,
    }
  })
  check('**唯一一张也能删掉**，列表可以清空', emptied.items === 0, `items=${emptied.items}`)
  check(
    '删空后 activeItem 不再指向已删除的条目',
    emptied.activeNone && emptied.activeId === '',
    `activeItemId="${emptied.activeId}"`,
  )
  check('删空后画布仍渲染空画框（预览不塌）', emptied.canvasW > 0, `canvasW=${emptied.canvasW}`)
  check('删空后画布给出导入引导', emptied.stageHint)
  check('删空后列表显示空状态', emptied.panelEmpty)
  check('删空后「删除」按钮置灰（没有可删的了）', emptied.removeOff)
  check('删空后两个导出按钮都置灰（点了没反应 = 不该能点）', emptied.exportOff)

  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 900))
  const afterEmptyReload = await cropState()
  check(
    '**删空状态被持久化**（防抖窗口内刷新也不丢）',
    afterEmptyReload.items === 0,
    `items=${afterEmptyReload.items}`,
  )

  await importImage(2400, 1600, 'again.png')
  const recovered = await cropState()
  check(
    '删空后仍能导入（导入路径不依赖已有条目）',
    recovered.items === 1 && recovered.filled === 1 && recovered.zoom === 1,
    `items=${recovered.items} filled=${recovered.filled} zoom=${recovered.zoom}`,
  )

  /* ── 18. 换图出口 + 多图导出不重名 ── */
  const rowsOf = () =>
    page.evaluate(() => {
      const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
      return s.items.map((i) => ({
        img: !!i.image,
        w: i.width,
        zoom: Number(i.zoom.toFixed(3)),
      }))
    })

  await importImage(2000, 2000, 'b.png')
  await importImage(1800, 1200, 'c.png')
  let rows = await rowsOf()
  check(
    '凑到 3 张（供换图 / 文件名断言用）',
    rows.length === 3 && rows.every((r) => r.img),
    JSON.stringify(rows),
  )

  // 换图：点中第 1 行 → 给它一个非居中构图 → 清空 → 再导入，新图必须回到第 1 行
  await clickBy('[data-crop-item="0"]')
  await new Promise((r) => setTimeout(r, 250))
  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    s.setZoom(1.6)
    s.setAxis('y', 0.5)
  })
  check(
    '「清空图片」在激活项有图时可用',
    !(await page.evaluate(() => document.querySelector('aside [data-crop-clear]').disabled)),
  )

  await clickBy('aside [data-crop-clear]')
  await new Promise((r) => setTimeout(r, 300))
  rows = await rowsOf()
  check(
    '清空图片只清图片：行数不变、该行回到空位、其余行不受影响',
    rows.length === 3 && !rows[0].img && rows[1].img && rows[2].img,
    JSON.stringify(rows),
  )
  check('清空后构图一并重置（zoom 回到 1）', rows[0].zoom === 1, `zoom=${rows[0].zoom}`)
  check(
    '清空后「清空图片」置灰（这一行已经是空位）',
    await page.evaluate(() => document.querySelector('aside [data-crop-clear]').disabled),
  )

  await importImage(2600, 1400, 'd.png')
  rows = await rowsOf()
  check(
    '**导入填回被清空的那一行**（不追加到队尾、也不跳到别的空位）',
    rows.length === 3 && rows[0].img && rows[0].w === 2600,
    JSON.stringify(rows),
  )

  // 文件名：多张成品时必须能区分是哪一个条目
  await clearDownloads(downloadDir)
  await clickBy('[data-crop-item="0"]')
  await new Promise((r) => setTimeout(r, 250))
  await clickBy('[data-export-active]')
  const firstPng = await latestFile(downloadDir, '.png')
  await clearDownloads(downloadDir)
  await clickBy('[data-crop-item="1"]')
  await new Promise((r) => setTimeout(r, 250))
  await clickBy('[data-export-active]')
  const secondPng = await latestFile(downloadDir, '.png')
  const name1 = firstPng.split('/').pop()
  const name2 = secondPng.split('/').pop()
  check(
    '多张成品：导出文件名带列表位置（图片 N）',
    name1.includes('图片1') && name2.includes('图片2'),
    `${name1} / ${name2}`,
  )
  check(
    '**不同条目导出的文件名不重名**（旧版同名，第 2 张被浏览器改成 xxx(1).png）',
    name1 !== name2,
    `${name1} vs ${name2}`,
  )

  // 只有一张成品时不加编号，保持文件名干净
  await page.evaluate(() => {
    const s = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('crop')
    s.items.slice(1).forEach((i) => s.removeItem(i.id))
  })
  await new Promise((r) => setTimeout(r, 250))
  await clearDownloads(downloadDir)
  await clickBy('[data-export-active]')
  const soloPng = await latestFile(downloadDir, '.png')
  const soloName = soloPng.split('/').pop()
  check('只有一张成品时文件名不带条目编号（保持干净）', !soloName.includes('图片'), soloName)

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
