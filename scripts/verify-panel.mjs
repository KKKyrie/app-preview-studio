/**
 * 左侧面板拖拽调宽验证：
 *  1. 默认宽度 = 320（同时是允许的最小宽度）
 *  2. 手柄拖拽 +150 → 宽度 470，且写入 localStorage
 *  3. 双击手柄 → 恢复默认 320
 *  4. 再拖到 500 → 刷新后宽度保留
 * 用法：node scripts/verify-panel.mjs   （KEEP=1 保留截图产物）
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'
const PANEL_KEY = 'app-preview-studio.panelWidth.v1'

let failures = 0
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS ✅' : 'FAIL ❌'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures += 1
}

const artifacts = await mkdtemp(join(tmpdir(), 'apv-panel-'))
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

  // 从干净状态开始
  await page.goto(URL, { waitUntil: 'networkidle0' })
  await page.evaluate((key) => localStorage.removeItem(key), PANEL_KEY)
  await page.reload({ waitUntil: 'networkidle0' })

  /** 取手柄与 aside 的当前几何（拖拽后坐标会变，每步都要重新取） */
  const box = async () => {
    const handle = await page.$('[data-panel-resizer]')
    const b = await handle.boundingBox()
    const asideW = await page.evaluate(
      () => document.querySelector('aside').getBoundingClientRect().width,
    )
    return { handle: b, asideW: Math.round(asideW) }
  }

  // 1. 默认宽度
  let { handle, asideW } = await box()
  check('默认宽度 = 320（最小）', asideW === 320, `width=${asideW}`)

  // 2. 向右拖 150px
  let x = handle.x + handle.width / 2
  let y = handle.y + handle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 150, y, { steps: 8 })
  await page.mouse.up()
  ;({ handle, asideW } = await box())
  check('拖拽 +150 → 宽度 470', asideW === 470, `width=${asideW}`)
  const saved = await page.evaluate((k) => localStorage.getItem(k), PANEL_KEY)
  check('宽度写入 localStorage', saved === '470', `saved=${saved}`)

  // 3. 双击复位（手柄已右移 150，先重新取坐标；click 的 count:2 才会派发 dblclick）
  await page.mouse.click(handle.x + handle.width / 2, handle.y + handle.height / 2, { count: 2 })
  await new Promise((r) => setTimeout(r, 150))
  ;({ handle, asideW } = await box())
  check('双击手柄复位 320', asideW === 320, `width=${asideW}`)

  // 4. 再拖到 500 → 刷新保留（复位后手柄回到原位，重新取坐标）
  x = handle.x + handle.width / 2
  y = handle.y + handle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + 180, y, { steps: 8 })
  await page.mouse.up()
  ;({ asideW } = await box())
  check('再次拖拽 → 宽度 500', asideW === 500, `width=${asideW}`)

  await page.reload({ waitUntil: 'networkidle0' })
  ;({ asideW } = await box())
  check('刷新后宽度保留', asideW === 500, `width=${asideW}`)

  await page.screenshot({ path: join(artifacts, 'panel-drag.png') })
  check('页面无错误', pageErrors.length === 0, pageErrors.join(' | '))

  // 清理测试偏好
  await page.evaluate((key) => localStorage.removeItem(key), PANEL_KEY)
} finally {
  await browser.close()
  if (process.env.KEEP) {
    console.log(`产物已保留: ${artifacts}`)
  } else {
    await rm(artifacts, { recursive: true, force: true }).catch(() => {})
  }
}

console.log(failures === 0 ? '\n全部通过 🎉' : `\n${failures} 项失败 ❌`)
process.exitCode = failures === 0 ? 0 : 1
