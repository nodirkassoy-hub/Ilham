import type { Language } from '../domain/enums'

const LOCALES: Record<Language, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' }

/** 12 345 678 so'm — space-grouped, no decimals (UZS has no usable minor unit). */
export function money(n: number | null | undefined, opts: { compact?: boolean; sign?: boolean; currency?: string } = {}): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const { compact = false, sign = false, currency = "so'm" } = opts
  const abs = Math.abs(n)
  let body: string
  if (compact && abs >= 1_000_000_000) body = `${trim(abs / 1_000_000_000)} mlrd`
  else if (compact && abs >= 1_000_000) body = `${trim(abs / 1_000_000)} mln`
  else if (compact && abs >= 10_000) body = `${trim(abs / 1_000)} ming`
  else body = group(Math.round(abs))
  const s = n < 0 ? '−' : sign && n > 0 ? '+' : ''
  return `${s}${body} ${currency}`.trim()
}

export function num(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return group(Number(n.toFixed(digits)))
}

export function pct(n: number | null | undefined, digits = 1, sign = false): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  const s = n < 0 ? '−' : sign && n > 0 ? '+' : ''
  return `${s}${Math.abs(n).toFixed(digits)}%`
}

function trim(n: number): string {
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)
  return s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1').replace('.', ',')
}

function group(n: number): string {
  const [int, dec] = String(n).split('.')
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return dec ? `${g},${dec}` : g
}

export function fmtDate(iso: string | null | undefined, lang: Language = 'uz', withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }
  return new Intl.DateTimeFormat(LOCALES[lang], opts).format(d)
}

export function fmtMonth(iso: string, lang: Language = 'uz'): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { month: 'short', year: '2-digit' }).format(new Date(iso))
}

export function relTime(iso: string | null | undefined, lang: Language = 'uz'): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.round(diff / 60_000)
  const rtf = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' })
  if (Math.abs(m) < 60) return rtf.format(-m, 'minute')
  const h = Math.round(m / 60)
  if (Math.abs(h) < 24) return rtf.format(-h, 'hour')
  const d = Math.round(h / 24)
  if (Math.abs(d) < 30) return rtf.format(-d, 'day')
  return rtf.format(-Math.round(d / 30), 'month')
}

export function daysBetween(a: string | Date, b: string | Date): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

export function addDays(d: Date | string, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function iso(d: Date = new Date()): string {
  return d.toISOString()
}

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10)
}

export function startOfMonth(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7)
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
}

let seq = 0
export function uid(prefix = 'id'): string {
  seq += 1
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function docNumber(prefix: string, n: number, d: Date = new Date()): string {
  return `${prefix}-${d.getFullYear()}-${String(n).padStart(5, '0')}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((a, x) => a + f(x), 0)
}

export function groupBy<T, K extends string>(arr: T[], f: (x: T) => K): Record<K, T[]> {
  return arr.reduce(
    (acc, x) => {
      const k = f(x)
      ;(acc[k] ||= []).push(x)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export const cx = (...xs: (string | false | null | undefined | 0 | '')[]): string => xs.filter(Boolean).join(' ')

/** Deterministic PRNG so demo data is identical on every load. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
