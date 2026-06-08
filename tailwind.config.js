/** @type {import('tailwindcss').Config} */

function c(name) {
  return `rgb(var(--color-${name}) / <alpha-value>)`
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface:                    c('surface'),
        'surface-dim':              c('surface-dim'),
        'surface-bright':           c('surface-bright'),
        'surface-container-lowest': c('surface-container-lowest'),
        'surface-container-low':    c('surface-container-low'),
        'surface-container':        c('surface-container'),
        'surface-container-high':   c('surface-container-high'),
        'surface-container-highest':c('surface-container-highest'),
        'surface-variant':          c('surface-variant'),
        'on-surface':               c('on-surface'),
        'on-surface-variant':       c('on-surface-variant'),
        'inverse-surface':          c('inverse-surface'),
        'inverse-on-surface':       c('inverse-on-surface'),
        outline:                    c('outline'),
        'outline-variant':          c('outline-variant'),
        'surface-tint':             c('surface-tint'),
        primary:                    c('primary'),
        'on-primary':               c('on-primary'),
        'primary-container':        c('primary-container'),
        'on-primary-container':     c('on-primary-container'),
        'primary-fixed':            c('primary-fixed'),
        'primary-fixed-dim':        c('primary-fixed-dim'),
        'on-primary-fixed':         c('on-primary-fixed'),
        'on-primary-fixed-variant': c('on-primary-fixed-variant'),
        secondary:                  c('secondary'),
        'on-secondary':             c('on-secondary'),
        'secondary-container':      c('secondary-container'),
        'on-secondary-container':   c('on-secondary-container'),
        tertiary:                   c('tertiary'),
        'on-tertiary':              c('on-tertiary'),
        'tertiary-container':       c('tertiary-container'),
        'on-tertiary-container':    c('on-tertiary-container'),
        error:                      c('error'),
        'on-error':                 c('on-error'),
        'error-container':          c('error-container'),
        'on-error-container':       c('on-error-container'),
        background:                 c('background'),
        'on-background':            c('on-surface'),
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      fontSize: {
        'display-lg':       ['32px', { lineHeight: '40px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md':      ['24px', { lineHeight: '32px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'body-md':          ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'code-block':       ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'label-caps':       ['11px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg:      '0.5rem',
        xl:      '0.75rem',
        full:    '9999px',
      },
      width:    { sidebar: '280px' },
      minWidth: { sidebar: '280px' },
    },
  },
  plugins: [],
}
