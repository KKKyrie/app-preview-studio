/**
 * 样式矩阵截图：驱动 window.__studio.store，逐个组合渲染预览并生成对比图。
 * 用法：node scripts/capture-styles.mjs [输出目录]
 */
import { mkdtemp, readdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execSync } from 'node:child_process'

import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const URL = process.env.APP_URL ?? 'http://localhost:5173/'

const LAYOUTS = ['text-top', 'text-bottom', 'text-side', 'bleed-bottom', 'center-hold', 'multi-phone']
const FRAMES = ['island', 'notch', 'home', 'ipad', 'bare']
const THEMES = [
  'minimal-white',
  'dark-premium',
  'brand-solid',
  'aurora',
  'studio',
  'poster',
  'macaron',
  'neon',
  'paper',
  'mesh',
]

const outDir = process.argv[2] ?? (await mkdtemp(join(tmpdir(), 'apv-styles-')))

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1680, height: 1050 })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })

  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30_000 })
  await page.waitForFunction(() => Boolean(window.__studio), { timeout: 10_000 })

  async function capture(name, setup) {
    await page.evaluate((code) => {
      // eslint-disable-next-line no-new-func
      new Function('s', code)(window.__studio.store)
    }, setup)
    await new Promise((r) => setTimeout(r, 350))
    const el = await page.$('main [data-canvas]')
    if (!el) throw new Error('找不到画布元素')
    await el.screenshot({ path: join(outDir, `${name}.png`) })
    console.log(`✓ ${name}`)
  }

  const reset = (layout, frame, theme) => `
    s.activeItem.params = {};
    s.setLayout('${layout}');
    s.setFrame('${frame}');
    s.setTheme('${theme}');
    s.activeItem.frame.tilt = 0;
  `

  for (const l of LAYOUTS) await capture(`layout-${l}`, reset(l, 'island', 'minimal-white'))
  for (const f of FRAMES) await capture(`frame-${f}`, reset('text-top', f, 'minimal-white'))
  for (const t of THEMES) await capture(`theme-${t}`, reset('text-top', 'island', t))

  // 生成对比拼图
  const files = (await readdir(outDir)).filter((f) => f.endsWith('.png'))
  const figures = files
    .map(
      (f) =>
        `<figure><img src="./${f}" /><figcaption>${f.replace(/\.png$/, '')}</figcaption></figure>`,
    )
    .join('\n')
  const html = `<!doctype html><meta charset="utf-8"><style>
    body { margin:0; background:#101116; font:12px -apple-system,sans-serif; }
    .row { display:flex; flex-wrap:wrap; gap:10px; padding:14px; }
    figure { margin:0; text-align:center; }
    img { height:400px; display:block; border-radius:6px; }
    figcaption { color:#9ba0ad; margin-top:5px; font-size:11px; }
  </style><div class="row">${figures}</div>`
  const gridPath = join(outDir, 'grid.html')
  await writeFile(gridPath, html)

  execSync(
    `"${CHROME}" --headless=new --disable-gpu --hide-scrollbars --allow-file-access-from-files --screenshot="${join(outDir, 'contact-sheet.png')}" --window-size=1700,${Math.ceil(files.length / 6) * 460 + 60} "file://${gridPath}"`,
    { stdio: 'ignore' },
  )

  console.log(`\n输出目录: ${outDir}`)
  console.log(`对比图: ${join(outDir, 'contact-sheet.png')}`)
  console.log(`页面错误: ${errors.length === 0 ? '无 ✅' : errors.join(' | ')}`)
  if (errors.length > 0) process.exitCode = 1
} finally {
  await browser.close()
}
