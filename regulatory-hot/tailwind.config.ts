import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 主色：Anthropic 风格的暖橙棕（rust / burnt orange / terracotta）
        brand: {
          50:  '#fdf6f0',
          100: '#fae9d9',
          200: '#f3d1b3',
          300: '#e9b287',
          400: '#dc8e57',
          500: '#c9713b',   // 浅色主色：焦糖棕
          600: '#b25a2b',   // 深色主色：赤陶
          700: '#944824',
          800: '#783a20',
          900: '#5e2e1c',
          950: '#3a1c11',
        },
        // 中性灰：暖色调灰（Anthropic 风格的暖灰褐，替代冷蓝灰）
        ink: {
          25:  '#fdfcfa',  // 极浅亮
          50:  '#faf9f6',  // 暖米白（Anthropic 主背景）
          100: '#f5f2ea',  // 浅米色
          200: '#ebe6d9',
          300: '#d6cebd',
          400: '#a89f8d',
          500: '#7c7363',
          600: '#5d5649',
          700: '#3d3a35',  // 主文字色（Anthropic 深灰褐）
          800: '#2a2823',
          900: '#1c1a16',  // 暗色背景
          925: '#131210',
          950: '#0a0908',
        },
        // 重要度色阶（暖色调，弱化饱和度）
        importance: {
          5: '#b91c1c',  // 砖红（不是刺眼的红）
          4: '#c2410c',  // 暗橙
          3: '#a16207',  // 暗黄
          2: '#1d4ed8',  // 深蓝
          1: '#78716c',  // 暖灰
        },
        // 暖光阴影（Anthropic 风格，柔和的暖色阴影）
        warmShadow: {
          xs: '0 1px 2px 0 rgb(61 58 53 / 0.04)',
          sm: '0 1px 2px 0 rgb(61 58 53 / 0.06), 0 1px 3px 0 rgb(61 58 53 / 0.04)',
          md: '0 4px 6px -1px rgb(61 58 53 / 0.08), 0 2px 4px -2px rgb(61 58 53 / 0.04)',
          lg: '0 10px 15px -3px rgb(61 58 53 / 0.08), 0 4px 6px -4px rgb(61 58 53 / 0.04)',
          xl: '0 20px 25px -5px rgb(61 58 53 / 0.10), 0 8px 10px -6px rgb(61 58 53 / 0.04)',
        },
      },
      fontFamily: {
        // Anthropic 风格：Inter (英文) + 现代无衬线中文
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans CN"',
          'sans-serif',
        ],
        serif: [
          '"Source Serif Pro"',
          '"Noto Serif SC"',
          'Georgia',
          'serif',
        ],
        mono: [
          '"JetBrains Mono"',
          '"SF Mono"',
          'Consolas',
          'ui-monospace',
          'monospace',
        ],
      },
      fontSize: {
        // 重新定义：更精细的字号阶梯
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],  // 11px
        'xs':  ['0.75rem',  { lineHeight: '1.125rem' }], // 12px
        'sm':  ['0.8125rem', { lineHeight: '1.375rem' }], // 13px
        'base':['0.9375rem', { lineHeight: '1.625rem' }], // 15px (v0.2 用 14)
        'lg':  ['1.0625rem', { lineHeight: '1.75rem' }],  // 17px
        'xl':  ['1.25rem',  { lineHeight: '1.875rem' }],  // 20px
        '2xl': ['1.5rem',   { lineHeight: '2rem' }],       // 24px
        '3xl': ['1.875rem', { lineHeight: '2.375rem' }],   // 30px
        '4xl': ['2.25rem',  { lineHeight: '2.625rem' }],   // 36px
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter:  '-0.025em',
        tight:    '-0.015em',  // 标题用
        normal:   '0',
        wide:     '0.015em',
        wider:    '0.04em',    // caps 用
        widest:   '0.08em',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        sm: '0.375rem',     // 6px - 按钮/小标签
        md: '0.5rem',       // 8px - 按钮（Anthropic 风格）
        lg: '0.75rem',      // 12px - 卡片
        xl: '1rem',         // 16px - 大卡片（Anthropic 风格）
        '2xl': '1.25rem',   // 20px - 容器
      },
      boxShadow: {
        // 浅色模式：暖色调阴影（Anthropic 风格）
        'soft': '0 1px 2px 0 rgb(61 58 53 / 0.04), 0 1px 3px 0 rgb(61 58 53 / 0.04)',
        'card': '0 1px 2px 0 rgb(61 58 53 / 0.05), 0 1px 3px 0 rgb(61 58 53 / 0.04), 0 0 0 1px rgb(235 230 217 / 0.5)',
        'pop':  '0 10px 20px -5px rgb(61 58 53 / 0.10), 0 4px 6px -2px rgb(61 58 53 / 0.04)',
        // 暗色模式：内发光 + 微光
        'card-dark': '0 0 0 1px rgb(61 58 53 / 1), 0 4px 12px -2px rgb(0 0 0 / 0.4)',
        'glow':   '0 0 24px -8px rgb(201 113 59 / 0.4)',
      },
      animation: {
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'fade-in':    'fadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':    'shimmer 2.4s linear infinite',
        'breath':     'breath 4s ease-in-out infinite',
      },
      keyframes: {
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breath: {
          '0%, 100%': { opacity: '0.5' },
          '50%':      { opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'in-out-quart': 'cubic-bezier(0.76, 0, 0.24, 1)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.5 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};

export default config;
