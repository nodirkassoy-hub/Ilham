import { forwardRef, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, Check, ChevronDown, Info, Lock, X, XCircle } from 'lucide-react'
import { cx, initials } from '@/core/utils/format'
import { useToast } from './toast'

/* ------------------------------------------------------------------ Button */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline' | 'gold' | 'glass'
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const V: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:brightness-110 shadow-[0_8px_24px_-10px_rgb(var(--c-brand)/0.7)] border border-transparent',
  gold: 'bg-gold text-[#1c1400] hover:brightness-110 border border-transparent',
  secondary: 'bg-raised text-ink border hover:bg-line/10',
  outline: 'bg-transparent text-ink border hover:bg-line/5',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-line/5 border border-transparent',
  glass: 'glass text-ink hover:bg-line/10',
  danger: 'bg-danger/12 text-danger border border-danger/25 hover:bg-danger/20',
}
const S: Record<Size, string> = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-8.5 px-3 text-[13px] gap-1.5 rounded-xl',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-2xl',
  xl: 'h-14 px-8 text-base gap-2.5 rounded-2xl font-semibold',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'primary', size = 'md', loading, icon, iconRight, block, className, children, disabled, ...rest }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-200 ease-spring active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none select-none', V[variant], S[size], block && 'w-full', className)}
      {...rest}
    >
      {loading ? <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

/* ------------------------------------------------------------------ Card */

export function Card({ className, children, padded = true, hover = false, as: Tag = 'div', ...rest }: { className?: string; children: ReactNode; padded?: boolean; hover?: boolean; as?: 'div' | 'section' | 'article' } & Record<string, unknown>) {
  return (
    <Tag className={cx('card sheen', padded && 'p-5 sm:p-6', hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift', className)} {...(rest as object)}>
      {children}
    </Tag>
  )
}

export function GlassCard({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('glass sheen rounded-3xl shadow-glass', className)}>{children}</div>
}

/* ------------------------------------------------------------------ Badge */

type Tone = 'brand' | 'sky' | 'violet' | 'gold' | 'success' | 'warning' | 'danger' | 'muted' | 'faint' | 'ink'
const TONE_BG: Record<Tone, string> = {
  brand: 'bg-brand/12 text-brand border-brand/20',
  sky: 'bg-sky/12 text-sky border-sky/20',
  violet: 'bg-violet/12 text-violet border-violet/20',
  gold: 'bg-gold/14 text-gold border-gold/25',
  success: 'bg-success/12 text-success border-success/20',
  warning: 'bg-warning/14 text-warning border-warning/25',
  danger: 'bg-danger/12 text-danger border-danger/20',
  muted: 'bg-line/8 text-muted border-line/10',
  faint: 'bg-line/5 text-faint border-line/10',
  ink: 'bg-ink text-canvas border-transparent',
}
export const TONE_TEXT: Record<Tone, string> = {
  brand: 'text-brand',
  sky: 'text-sky',
  violet: 'text-violet',
  gold: 'text-gold',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  muted: 'text-muted',
  faint: 'text-faint',
  ink: 'text-ink',
}
export const TONE_SOLID: Record<Tone, string> = {
  brand: 'bg-brand',
  sky: 'bg-sky',
  violet: 'bg-violet',
  gold: 'bg-gold',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  muted: 'bg-muted',
  faint: 'bg-faint',
  ink: 'bg-ink',
}
export type { Tone }

export function Badge({ tone = 'muted', children, className, dot, size = 'sm' }: { tone?: Tone; children: ReactNode; className?: string; dot?: boolean; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap', size === 'xs' ? 'px-1.5 py-0 text-[10px] h-4.5' : size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-2xs', TONE_BG[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', TONE_SOLID[tone])} />}
      {children}
    </span>
  )
}

export const STATUS_TONE: Record<string, Tone> = {
  TRIAL: 'sky',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  EXPIRED: 'danger',
  SUSPENDED: 'danger',
  CANCELLED: 'muted',
  PAID: 'success',
  UNPAID: 'warning',
  PENDING: 'warning',
  FAILED: 'danger',
  REFUNDED: 'muted',
  DRAFT: 'muted',
  ISSUED: 'sky',
  PARTIALLY_PAID: 'warning',
  OVERDUE: 'danger',
  VOID: 'muted',
  INVOICED: 'sky',
  CONFIRMED: 'sky',
  REQUEST: 'muted',
  APPROVED: 'sky',
  ORDERED: 'sky',
  PARTIALLY_RECEIVED: 'warning',
  RECEIVED: 'success',
  BILLED: 'violet',
  PLANNED: 'muted',
  RELEASED: 'sky',
  IN_PROGRESS: 'warning',
  QC: 'violet',
  COMPLETED: 'success',
  CLOSED: 'faint',
  POSTED: 'success',
  RECONCILED: 'success',
  IN_TRANSIT: 'warning',
  OPEN: 'success',
  SOFT_CLOSE: 'warning',
  FILED: 'sky',
  RUNNING: 'success',
  IDLE: 'muted',
  MAINTENANCE: 'warning',
  DOWN: 'danger',
  PASS: 'success',
  FAIL: 'danger',
  CONCESSION: 'warning',
  PRESENT: 'success',
  ABSENT: 'danger',
  LATE: 'warning',
  LEAVE: 'sky',
  SICK: 'violet',
  OVERTIME: 'gold',
  REJECTED: 'danger',
  INVITED: 'sky',
  CALCULATED: 'sky',
  DONE: 'success',
  BLOCKED: 'danger',
  INFO: 'sky',
  SUCCESS: 'success',
  WARNING: 'warning',
  CRITICAL: 'danger',
  LOW: 'muted',
  NORMAL: 'sky',
  HIGH: 'warning',
  URGENT: 'danger',
  RESOLVED: 'success',
  ERROR: 'danger',
  WARN: 'warning',
  DEBUG: 'faint',
}

export function StatusBadge({ status, label, size }: { status: string; label?: string; size?: 'xs' | 'sm' | 'md' }) {
  return (
    <Badge tone={STATUS_TONE[status] ?? 'muted'} dot size={size}>
      {label ?? status}
    </Badge>
  )
}

/* ------------------------------------------------------------------ Inputs */

export function Field({ label, hint, error, children, required, className }: { label?: string; hint?: string; error?: string; children: ReactNode; required?: boolean; className?: string }) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="mb-1.5 flex items-center gap-1 text-[13px] font-medium text-muted">
          {label}
          {required && <span className="text-danger">*</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1.5 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1.5 block text-xs text-faint">{hint}</span> : null}
    </label>
  )
}

const inputBase = 'w-full rounded-xl border bg-raised/60 px-3.5 text-sm text-ink placeholder:text-faint outline-none transition-all focus:border-brand/50 focus:bg-raised focus:ring-4 focus:ring-brand/10 disabled:opacity-50'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; left?: ReactNode; right?: ReactNode }>(function Input({ className, invalid, left, right, ...rest }, ref) {
  if (left || right) {
    return (
      <div className="relative">
        {left && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint">{left}</span>}
        <input ref={ref} className={cx(inputBase, 'h-10', left && 'pl-9', right && 'pr-9', invalid && 'border-danger/60 focus:border-danger', className)} {...rest} />
        {right && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-faint">{right}</span>}
      </div>
    )
  }
  return <input ref={ref} className={cx(inputBase, 'h-10', invalid && 'border-danger/60 focus:border-danger', className)} {...rest} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cx(inputBase, 'min-h-[88px] py-2.5 resize-y', className)} {...rest} />
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cx(inputBase, 'h-10 appearance-none pr-9', className)} {...rest}>
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-faint" />
    </div>
  )
}) 

export function Toggle({ checked, onChange, label, disabled, size = 'md' }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={cx('inline-flex items-center gap-2.5 disabled:opacity-50', label && 'text-sm text-ink')}>
      <span className={cx('relative inline-flex shrink-0 items-center rounded-full border transition-colors duration-200', size === 'sm' ? 'h-5 w-9' : 'h-6 w-11', checked ? 'bg-brand border-brand' : 'bg-line/15 border-line/10')}>
        <span className={cx('absolute rounded-full bg-white shadow transition-transform duration-200 ease-spring', size === 'sm' ? 'h-3.5 w-3.5 left-0.5' : 'h-4.5 w-4.5 left-0.5', checked && (size === 'sm' ? 'translate-x-4' : 'translate-x-5'))} />
      </span>
      {label}
    </button>
  )
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; badge?: ReactNode }[]; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  return (
    <div className={cx('inline-flex items-center rounded-2xl border bg-raised/60 p-1', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} className={cx('relative inline-flex items-center gap-2 rounded-xl font-medium transition-all duration-200', size === 'sm' ? 'h-7 px-3 text-xs' : size === 'lg' ? 'h-11 px-6 text-sm' : 'h-9 px-4 text-sm', value === o.value ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink')}>
          {o.label}
          {o.badge}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ Modal */

export function Modal({ open, onClose, title, subtitle, children, footer, size = 'md', danger }: { open: boolean; onClose: () => void; title?: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; danger?: boolean }) {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) setMounted(true)
    else {
      const id = setTimeout(() => setMounted(false), 180)
      return () => clearTimeout(id)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])
  if (!mounted) return null
  const w = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }[size]
  return createPortal(
    <div className={cx('fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-6', open ? 'animate-fade-in' : 'opacity-0 transition-opacity duration-150')} role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative w-full glass-strong rounded-t-3xl sm:rounded-3xl shadow-lift max-h-[92vh] flex flex-col', w, open ? 'animate-scale-in' : '', danger && 'ring-1 ring-danger/30')}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div>
              {title && <h3 className="text-lg font-semibold text-ink">{title}</h3>}
              {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-faint hover:bg-line/10 hover:text-ink transition" aria-label="close">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-6 pb-6 overflow-y-auto">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = 'Tasdiqlash', cancelLabel = 'Bekor qilish', danger, loading }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; body: ReactNode; confirmLabel?: string; cancelLabel?: string; danger?: boolean; loading?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} size="sm" danger={danger} footer={<><Button variant="ghost" onClick={onClose}>{cancelLabel}</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button></>}>
      <div className="flex gap-4">
        <div className={cx('shrink-0 grid h-11 w-11 place-items-center rounded-2xl', danger ? 'bg-danger/12 text-danger' : 'bg-brand/12 text-brand')}>
          {danger ? <AlertTriangle size={20} /> : <Info size={20} />}
        </div>
        <div>
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <div className="mt-1.5 text-sm text-muted leading-relaxed">{body}</div>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------ Drawer */

export function Drawer({ open, onClose, title, children, width = 'max-w-xl' }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: string }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[85] flex justify-end animate-fade-in">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={onClose} />
      <aside className={cx('relative h-full w-full glass-strong border-l shadow-lift animate-slide-left flex flex-col', width)}>
        <div className="flex items-center justify-between px-6 py-5 border-b">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-faint hover:bg-line/10 hover:text-ink" aria-label="close">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
      </aside>
    </div>,
    document.body,
  )
}

/* ------------------------------------------------------------------ Tabs */

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { value: T; label: ReactNode; count?: number; locked?: boolean }[]; className?: string }) {
  return (
    <div className={cx('flex items-center gap-1 overflow-x-auto no-scrollbar border-b', className)}>
      {tabs.map((tb) => (
        <button key={tb.value} onClick={() => onChange(tb.value)} className={cx('relative flex items-center gap-2 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors', value === tb.value ? 'text-ink' : 'text-muted hover:text-ink')}>
          {tb.locked && <Lock size={12} className="text-faint" />}
          {tb.label}
          {tb.count !== undefined && <span className="rounded-full bg-line/10 px-1.5 text-2xs text-muted tnum">{tb.count}</span>}
          {value === tb.value && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ Misc */

export function Avatar({ name, tone = 'brand', size = 'md', className }: { name: string; tone?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sz = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-xl' }[size]
  const tn = (TONE_BG as Record<string, string>)[tone] ?? TONE_BG.brand
  return <span className={cx('inline-grid shrink-0 place-items-center rounded-full border font-semibold', sz, tn, className)}>{initials(name)}</span>
}

export function EmptyState({ icon, title, body, action, compact }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'py-8' : 'py-16')}>
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-line/6 text-faint">{icon}</div>}
      <h4 className="text-base font-semibold text-ink">{title}</h4>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('skeleton', className)} />
}

export function Progress({ value, tone = 'brand', className, height = 'h-1.5' }: { value: number; tone?: Tone; className?: string; height?: string }) {
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-line/10', height, className)}>
      <div className={cx('h-full rounded-full transition-all duration-700 ease-spring', TONE_SOLID[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function SectionHeader({ title, sub, actions, className }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-ink">{title}</h2>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx('border-t', className)} />
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border bg-raised px-1.5 py-0.5 font-mono text-2xs text-muted">{children}</kbd>
}

export function CheckIcon({ ok, limited }: { ok: boolean | string; limited?: boolean }) {
  if (typeof ok === 'string' || limited) return <span className="text-xs font-medium text-warning">{typeof ok === 'string' ? ok : 'Cheklangan'}</span>
  return ok ? (
    <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-brand/15 text-brand">
      <Check size={14} strokeWidth={3} />
    </span>
  ) : (
    <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-line/6 text-faint">
      <Lock size={12} />
    </span>
  )
}

/* ------------------------------------------------------------------ Toasts */

export function ToastViewport() {
  const { toasts, dismiss } = useToast()
  const icons = { success: <Check size={16} />, error: <XCircle size={16} />, info: <Info size={16} />, warning: <AlertTriangle size={16} /> }
  const tones: Record<string, string> = { success: 'text-success bg-success/12', error: 'text-danger bg-danger/12', info: 'text-sky bg-sky/12', warning: 'text-warning bg-warning/14' }
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-5 sm:left-auto">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto glass-strong flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-lift animate-scale-in">
          <span className={cx('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg', tones[t.kind])}>{icons[t.kind]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{t.title}</p>
            {t.body && <p className="mt-0.5 text-xs text-muted leading-relaxed">{t.body}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} className="text-faint hover:text-ink">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------ Dropdown */

export function Menu({ trigger, items, align = 'right' }: { trigger: ReactNode; items: { label: ReactNode; onClick?: () => void; danger?: boolean; icon?: ReactNode; disabled?: boolean; divider?: boolean }[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative inline-block" ref={ref}>
      <div onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} aria-controls={id}>
        {trigger}
      </div>
      {open && (
        <div id={id} role="menu" className={cx('absolute z-40 mt-1.5 min-w-[190px] glass-strong rounded-2xl p-1.5 shadow-lift animate-scale-in', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((it, i) =>
            it.divider ? (
              <hr key={i} className="my-1 border-t" />
            ) : (
              <button
                key={i}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false)
                  it.onClick?.()
                }}
                className={cx('flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition disabled:opacity-40', it.danger ? 'text-danger hover:bg-danger/10' : 'text-ink hover:bg-line/8')}
              >
                {it.icon && <span className="text-faint">{it.icon}</span>}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  )
}
