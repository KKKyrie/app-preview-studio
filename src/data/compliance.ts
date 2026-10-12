/**
 * 合规检查规则库。
 *
 * Apple 对商店素材（截图 / 预览 / 创意素材）有明确的硬性内容限制。
 * 来源：https://developer.apple.com/app-store/asset-best-practices/
 *   "Don't include specific pricing, discounts, website URLs, copyright symbols."
 *   "Avoid claims that can't be verified, such as awards or recognition …"
 *   "Assets displayed on the App Store must meet a 4+ age rating."
 *
 * 这里把上述规则做成可执行的正则校验——竞品目前都只是把这些条款写成文字说明，
 * 没有人做成机器校验，这是本工具的差异化点之一。
 */

export type Severity = 'error' | 'warn'

export interface ComplianceRule {
  id: string
  label: string
  /** Apple 官方依据的原文要点 */
  basis: string
  pattern: RegExp
  severity: Severity
  advice: string
}

/**
 * 注意：全部使用 `gi` 标志但**不使用 `g`**——
 * 需要 `.test()` 复用同一个正则时，带 `g` 会因 lastIndex 导致状态漂移。
 */
export const COMPLIANCE_RULES: ComplianceRule[] = [
  {
    id: 'pricing',
    label: '价格 / 折扣',
    basis: "Don't include specific pricing, discounts",
    pattern:
      /[¥￥$€£]|\d+\s*(?:元|折)|\b(?:off|deal|sale)\b|限时|折扣|立减|满减|特价|优惠|秒杀|半价|免费/g,
    severity: 'error',
    advice: '商店素材应保持「常青」，删掉价格与促销信息，全球各地区都通用',
  },
  {
    id: 'url',
    label: '网址',
    basis: 'website URLs',
    pattern: /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|cn|net|org|io|app|dev)\b/gi,
    severity: 'error',
    advice: '不要在素材里放网址，用户在下载前无法访问',
  },
  {
    id: 'copyright',
    label: '版权符号',
    basis: 'copyright symbols',
    pattern: /[©®™]/g,
    severity: 'error',
    advice: '移除 © ® ™ 等版权符号',
  },
  {
    id: 'award',
    label: '奖项 / 榜单',
    basis: "Avoid claims that can't be verified, such as awards",
    pattern:
      /editor'?s?\s?choice|app\s?of\s?the\s?day|game\s?of\s?the\s?day|apple\s?design\s?award|最佳(?:应用|游戏|设计)?|年度(?:应用|游戏)?|获奖|精选项|榜上有名/gi,
    severity: 'error',
    advice: '未实际获得的奖项不能出现在素材里；Apple 指定的荣誉会自行展示',
  },
  {
    id: 'platform',
    label: '其他平台标识',
    basis: "Don't include logos or references to other platforms",
    // 纯文本只能做弱提示：无法从文案判断图里的 logo
    pattern: /微信|支付宝|安卓|android|google\s?play|应用宝|华为应用|app\s?store/gi,
    severity: 'warn',
    advice: '素材里不要出现其他平台或应用商店的标识（文案弱提示，图形需人工确认）',
  },
]

export interface ComplianceHit {
  ruleId: string
  label: string
  severity: Severity
  advice: string
  /** 命中的来源字段，如「主标题」 */
  field: string
  /** 命中的原文片段 */
  snippet: string
}

export interface ComplianceInput {
  field: string
  text: string
}

/**
 * 扫描一组文案，返回命中的规则。
 * 空文本字段直接跳过。
 */
export function checkCompliance(inputs: ComplianceInput[]): ComplianceHit[] {
  const hits: ComplianceHit[] = []
  for (const { field, text } of inputs) {
    if (!text.trim()) continue
    for (const rule of COMPLIANCE_RULES) {
      // 每次匹配新建正则实例，避免共享 lastIndex
      const re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''))
      const m = re.exec(text)
      if (m) {
        hits.push({
          ruleId: rule.id,
          label: rule.label,
          severity: rule.severity,
          advice: rule.advice,
          field,
          snippet: m[0],
        })
      }
    }
  }
  return hits
}

/** error 级命中才算阻塞（warn 仅为提示） */
export function hasBlockingIssue(hits: ComplianceHit[]): boolean {
  return hits.some((h) => h.severity === 'error')
}