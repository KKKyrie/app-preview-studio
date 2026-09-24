import type { ThemeTokens } from '@/types'

/**
 * 风格主题注册表：每套主题 = 一组设计 token（背景 / 文字色 / 强调色 / 手机投影）。
 * token 通过内联样式注入画布；用户可在主题基础上覆盖单个 token。
 *
 * 注意：background 必须铺满且不透明（Apple 不接受带透明通道的截图）。
 */
export interface Theme {
  id: string
  name: string
  /** 缩略图展示用的渐变预览（css background） */
  swatch: string
  tokens: ThemeTokens
}

/** 纸感噪点（SVG feTurbulence 平铺纹理，data URI 内嵌，导出安全） */
const PAPER_NOISE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E\")"

export const THEMES: Theme[] = [
  {
    id: 'minimal-white',
    name: '极简白',
    swatch: 'linear-gradient(135deg, #ffffff, #eef0f4)',
    tokens: {
      background: 'linear-gradient(180deg, #ffffff 0%, #f2f4f8 100%)',
      headline: '#0b0d12',
      subtitle: '#5b6172',
      accent: '#3b6fff',
      phoneShadow: '0 48px 96px rgba(16, 24, 40, 0.22)',
    },
  },
  {
    id: 'dark-premium',
    name: '深色高级',
    swatch: 'linear-gradient(135deg, #12141a, #2a2f3d)',
    tokens: {
      background: 'linear-gradient(180deg, #0f1116 0%, #1b1f2a 100%)',
      headline: '#f5f6f8',
      subtitle: '#a7adbd',
      accent: '#7aa2ff',
      phoneShadow: '0 48px 120px rgba(0, 0, 0, 0.65)',
    },
  },
  {
    id: 'brand-solid',
    name: '品牌纯色',
    swatch: '#2c55d6',
    tokens: {
      background: '#2c55d6',
      headline: '#ffffff',
      subtitle: '#c8d5ff',
      accent: '#ffd66b',
      phoneShadow: '0 48px 96px rgba(10, 26, 78, 0.5)',
    },
  },
  {
    id: 'aurora',
    name: 'Aurora 极光',
    swatch: 'linear-gradient(135deg, #4c1d95, #0f766e)',
    tokens: {
      background: 'linear-gradient(150deg, #1e1b4b 0%, #4c1d95 42%, #0f766e 82%, #155e75 100%)',
      headline: '#f8fafc',
      subtitle: '#c7d2fe',
      accent: '#5eead4',
      phoneShadow: '0 48px 100px rgba(0, 0, 0, 0.55)',
    },
  },
  {
    id: 'studio',
    name: '投影摄影棚',
    swatch: 'linear-gradient(180deg, #f4f2ee, #c4bfb5)',
    tokens: {
      background:
        'radial-gradient(120% 90% at 50% 0%, #f6f4f0 0%, #dedad2 55%, #c2bdb2 100%)',
      headline: '#2b2a27',
      subtitle: '#6f6b63',
      accent: '#b4552d',
      phoneShadow: '0 60px 90px rgba(60, 55, 45, 0.35)',
    },
  },
  {
    id: 'poster',
    name: '粗排版海报',
    swatch: 'linear-gradient(135deg, #ffe45c, #ffd23d)',
    tokens: {
      background: 'linear-gradient(180deg, #ffe45c 0%, #ffd23d 100%)',
      headline: '#111318',
      subtitle: '#4a4426',
      accent: '#e63946',
      phoneShadow: '0 40px 80px rgba(120, 90, 0, 0.35)',
    },
  },
  {
    id: 'macaron',
    name: '马卡龙粉彩',
    swatch: 'linear-gradient(135deg, #ffe3ef, #dff3ff)',
    tokens: {
      background: 'linear-gradient(180deg, #ffe9f2 0%, #e8f1ff 55%, #e7fbf4 100%)',
      headline: '#43384f',
      subtitle: '#8b7f9b',
      accent: '#ff8fb1',
      phoneShadow: '0 44px 88px rgba(160, 130, 165, 0.35)',
    },
  },
  {
    id: 'neon',
    name: '霓虹辉光',
    swatch: 'linear-gradient(135deg, #0a0a12, #7c3aed)',
    tokens: {
      background: 'linear-gradient(180deg, #08080f 0%, #151030 60%, #1e1045 100%)',
      headline: '#ffffff',
      subtitle: '#b9a8ff',
      accent: '#22d3ee',
      phoneShadow: '0 0 90px rgba(124, 58, 237, 0.7), 0 40px 80px rgba(0, 0, 0, 0.6)',
    },
  },
  {
    id: 'paper',
    name: '纸感噪点',
    swatch: 'linear-gradient(135deg, #f5f1e8, #e6ded0)',
    tokens: {
      background: `${PAPER_NOISE}, linear-gradient(180deg, #f7f3ea 0%, #e9e2d4 100%)`,
      headline: '#33302a',
      subtitle: '#7a7468',
      accent: '#c2410c',
      phoneShadow: '0 46px 90px rgba(90, 80, 60, 0.3)',
    },
  },
  {
    id: 'mesh',
    name: 'Mesh 网格渐变',
    swatch: 'radial-gradient(circle at 30% 30%, #ffd6e7, #a78bfa)',
    tokens: {
      background:
        'radial-gradient(at 0% 0%, #ffd9e8 0px, transparent 55%), radial-gradient(at 85% 8%, #d6e4ff 0px, transparent 50%), radial-gradient(at 55% 95%, #d1fae5 0px, transparent 55%), radial-gradient(at 10% 80%, #fff3c4 0px, transparent 50%), #fdfdff',
      headline: '#1c1e26',
      subtitle: '#5d6272',
      accent: '#7c3aed',
      phoneShadow: '0 48px 96px rgba(60, 60, 120, 0.28)',
    },
  },
]

export function getTheme(id: string): Theme {
  const theme = THEMES.find((t) => t.id === id)
  if (!theme) throw new Error(`未知的主题: ${id}`)
  return theme
}

/** 合并主题 token 与用户覆盖，得到最终生效的 token */
export function resolveTokens(id: string, overrides: Partial<ThemeTokens>): ThemeTokens {
  return { ...getTheme(id).tokens, ...stripEmpty(overrides) }
}

function stripEmpty(overrides: Partial<ThemeTokens>): Partial<ThemeTokens> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === 'string' && v !== '') out[k] = v
  }
  return out as Partial<ThemeTokens>
}
