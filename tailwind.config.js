/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surface / ink tokens — resolved through CSS variables so light & dark
        // themes share the exact same class names.
        canvas: 'rgb(var(--c-canvas) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          soft: 'rgb(var(--c-brand-soft) / <alpha-value>)',
          ink: 'rgb(var(--c-brand-ink) / <alpha-value>)',
        },
        gold: { DEFAULT: 'rgb(var(--c-gold) / <alpha-value>)', soft: 'rgb(var(--c-gold-soft) / <alpha-value>)' },
        violet: { DEFAULT: 'rgb(var(--c-violet) / <alpha-value>)', soft: 'rgb(var(--c-violet-soft) / <alpha-value>)' },
        sky: { DEFAULT: 'rgb(var(--c-sky) / <alpha-value>)', soft: 'rgb(var(--c-sky-soft) / <alpha-value>)' },
        success: { DEFAULT: 'rgb(var(--c-success) / <alpha-value>)', soft: 'rgb(var(--c-success-soft) / <alpha-value>)' },
        warning: { DEFAULT: 'rgb(var(--c-warning) / <alpha-value>)', soft: 'rgb(var(--c-warning-soft) / <alpha-value>)' },
        danger: { DEFAULT: 'rgb(var(--c-danger) / <alpha-value>)', soft: 'rgb(var(--c-danger-soft) / <alpha-value>)' },
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      spacing: {
        4.5: '1.125rem',
        8.5: '2.125rem',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        glass: '0 1px 0 0 rgb(var(--c-glass-hi) / 0.9) inset, 0 24px 60px -28px rgb(var(--c-shadow) / 0.55)',
        card: '0 1px 2px rgb(var(--c-shadow) / 0.06), 0 12px 32px -16px rgb(var(--c-shadow) / 0.28)',
        lift: '0 2px 4px rgb(var(--c-shadow) / 0.06), 0 28px 60px -24px rgb(var(--c-shadow) / 0.45)',
        glow: '0 0 0 1px rgb(var(--c-brand) / 0.35), 0 12px 40px -12px rgb(var(--c-brand) / 0.55)',
        admin: '0 1px 2px rgb(0 0 0 / 0.2), 0 20px 50px -20px rgb(0 0 0 / 0.6)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to right, rgb(var(--c-line) / 0.55) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--c-line) / 0.55) 1px, transparent 1px)',
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.96) translateY(6px)' }, to: { opacity: '1', transform: 'none' } },
        'slide-left': { from: { opacity: '0', transform: 'translateX(18px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-9px)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
        'pulse-ring': { '0%': { transform: 'scale(.9)', opacity: '.7' }, '70%': { transform: 'scale(1.5)', opacity: '0' }, '100%': { opacity: '0' } },
        draw: { from: { strokeDashoffset: 'var(--dash)' }, to: { strokeDashoffset: '0' } },
        marquee: { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
      },
      animation: {
        'fade-up': 'fade-up .5s cubic-bezier(.16,1,.3,1) both',
        'fade-in': 'fade-in .35s ease both',
        'scale-in': 'scale-in .28s cubic-bezier(.16,1,.3,1) both',
        'slide-left': 'slide-left .35s cubic-bezier(.16,1,.3,1) both',
        float: 'float 7s ease-in-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(.24,.6,.35,1) infinite',
        draw: 'draw 1.1s cubic-bezier(.16,1,.3,1) forwards',
        marquee: 'marquee 38s linear infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
}
