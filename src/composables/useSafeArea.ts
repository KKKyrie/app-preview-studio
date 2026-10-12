import type { Rect, SafeAreaViolation } from '@/types'

/**
 * 安全区检查：测量画布上各关键元素的真实像素矩形，判断是否越出安全区。
 *
 * ── 为什么用 getBoundingClientRect + 反算缩放 ────────────────────────────
 * 预览区把画布整体 `transform: scale(s)`（横幅画布在桌面视口下 s 常常只有 0.2），
 * 所有 getBoundingClientRect 的返回值都是缩放后的。因此用
 * 「画布根矩形」与「元素矩形」相减再除以实际缩放，即可还原出画布坐标系下的
 * 精确位置 —— 无论预览缩放到多少，判定结果都一致。
 *
 * 用 offsetLeft/offsetTop 是**不行**的：元素若被多层定位容器包裹，
 * offsetParent 可能不是画布根，需要逐级累加，容易出错。
 *
 * 安全区的意义（见 docs/creative-assets-design.md §2.2）：它是 Apple 所有
 * 设备 / 方向裁切方式的**交集**，关键元素落在其中就一定不会被裁掉。
 */

/** 可检查的元素（对应画布上的 data-role） */
export interface CheckableRole {
  role: 'brand' | 'headline' | 'subtitle' | 'image'
  label: string
}

export interface SafeAreaInput {
  /** 画布根元素（需带 data-canvas） */
  rootEl: HTMLElement
  /** 画布像素宽高 */
  canvasW: number
  /** 安全区（画布坐标系的像素矩形） */
  safe: Rect
  /** 待检查元素 */
  targets: CheckableRole[]
}

export interface SafeAreaReport {
  violations: SafeAreaViolation[]
  /** 参与检查的元素数（空内容与未渲染的元素不计入） */
  checked: number
  /** 各元素在画布坐标系下的实测矩形，供叠加层高亮 / 面板定位使用 */
  boxes: Map<'brand' | 'headline' | 'subtitle' | 'image', Rect>
}

type Role = CheckableRole['role']

const EMPTY_REPORT: SafeAreaReport = { violations: [], checked: 0, boxes: new Map() }

/** 逐个测量元素并与安全区求交。任一方向超出即记为越界，并记录该方向超出的像素数 */
export function checkSafeArea(input: SafeAreaInput): SafeAreaReport {
  const { rootEl, canvasW, safe, targets } = input
  const rootRect = rootEl.getBoundingClientRect()
  if (rootRect.width === 0 || canvasW === 0) return EMPTY_REPORT

  // 由画布根的实际渲染宽度反推预览缩放
  const scale = rootRect.width / canvasW
  if (!Number.isFinite(scale) || scale <= 0) return EMPTY_REPORT

  const violations: SafeAreaViolation[] = []
  const boxes: SafeAreaReport['boxes'] = new Map()
  let checked = 0

  for (const { role, label } of targets) {
    const el = rootEl.querySelector<HTMLElement>(`[data-role="${role}"]`)
    if (!el) continue
    // 空内容不参与检查（副标题留空等）
    if (role !== 'image' && !el.textContent?.trim()) continue

    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    checked++

    const box: Rect = {
      x: (r.left - rootRect.left) / scale,
      y: (r.top - rootRect.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
    }
    boxes.set(role as Role, box)

    const over = {
      top: Math.max(0, safe.y - box.y),
      left: Math.max(0, safe.x - box.x),
      right: Math.max(0, box.x + box.width - (safe.x + safe.width)),
      bottom: Math.max(0, box.y + box.height - (safe.y + safe.height)),
    }
    const worst = Math.max(over.top, over.right, over.bottom, over.left)
    if (worst > 0.5) violations.push({ role: role as Role, label, over, worst })
  }

  violations.sort((a, b) => b.worst - a.worst)
  return { violations, checked, boxes }
}

/** 把超出量格式化成一句人话，例如「超出安全区 214px（下）」 */
export function describeOver(over: SafeAreaViolation['over']): string {
  const parts: string[] = []
  if (over.top > 0.5) parts.push(`${Math.round(over.top)}px（上）`)
  if (over.right > 0.5) parts.push(`${Math.round(over.right)}px（右）`)
  if (over.bottom > 0.5) parts.push(`${Math.round(over.bottom)}px（下）`)
  if (over.left > 0.5) parts.push(`${Math.round(over.left)}px（左）`)
  return `超出安全区 ${parts.join(' · ')}`
}

/** 矩形是否完全包含另一个矩形 */
export function containsRect(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}