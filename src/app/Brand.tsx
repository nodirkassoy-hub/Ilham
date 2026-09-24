import { cx } from '@/core/utils/format'

export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cx('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3BE8A8" />
          <stop offset="1" stopColor="#0FA3B1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#07121A" />
      <path d="M9 22V10h6.2a3.9 3.9 0 0 1 1.1 7.65A4.1 4.1 0 0 1 15.6 22H9z" fill="url(#lg)" />
      <rect x="9" y="15" width="7.4" height="1.7" rx=".85" fill="#07121A" opacity=".55" />
      <circle cx="23" cy="20.5" r="2.6" fill="none" stroke="url(#lg)" strokeWidth="1.9" />
    </svg>
  )
}

export function Wordmark({ size = 'md', admin, className }: { size?: 'sm' | 'md' | 'lg'; admin?: boolean; className?: string }) {
  const px = { sm: 26, md: 32, lg: 40 }[size]
  return (
    <span className={cx('inline-flex items-center gap-2.5', className)}>
      <Logo size={px} />
      <span className="flex flex-col leading-none">
        <span className={cx('font-display font-bold tracking-tight text-ink', size === 'sm' ? 'text-[15px]' : size === 'lg' ? 'text-2xl' : 'text-lg')}>
          Balans<span className="text-brand">ERP</span>
        </span>
        {admin && <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-danger">Platform Admin</span>}
      </span>
    </span>
  )
}
