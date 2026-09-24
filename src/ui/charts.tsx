/**
 * Lightweight SVG charts. No chart library → tiny bundle, crisp on retina,
 * themeable through CSS variables. All charts are pure functions of props.
 */
import { useId, useMemo, useState } from 'react'
import { cx } from '@/core/utils/format'

const COLORS = {
  brand: 'rgb(var(--c-brand))',
  sky: 'rgb(var(--c-sky))',
  violet: 'rgb(var(--c-violet))',
  gold: 'rgb(var(--c-gold))',
  danger: 'rgb(var(--c-danger))',
  success: 'rgb(var(--c-success))',
  warning: 'rgb(var(--c-warning))',
  muted: 'rgb(var(--c-muted))',
  faint: 'rgb(var(--c-faint))',
}
export type ChartColor = keyof typeof COLORS

/* ------------------------------------------------------------- AreaChart */

export interface Series {
  key: string
  label: string
  color: ChartColor
  values: number[]
  dashed?: boolean
}

function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return ''
  let d = `M ${pts[0][0]} ${pts[0][1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2[0]} ${p2[1]}`
  }
  return d
}

export function AreaChart({ series, labels, height = 220, formatY = (v) => String(v), formatTip, className, showLegend = true, yTicks = 4 }: { series: Series[]; labels: string[]; height?: number; formatY?: (v: number) => string; formatTip?: (v: number) => string; className?: string; showLegend?: boolean; yTicks?: number }) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = height
  const padL = 56
  const padR = 14
  const padT = 14
  const padB = 28
  const all = series.flatMap((s) => s.values)
  const max = Math.max(1, ...all) * 1.08
  const min = Math.min(0, ...all)
  const n = labels.length
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1)
  const y = (v: number) => padT + (H - padT - padB) * (1 - (v - min) / (max - min))
  const paths = useMemo(
    () =>
      series.map((s) => {
        const pts = s.values.map((v, i) => [x(i), y(v)] as [number, number])
        const line = smoothPath(pts)
        const area = `${line} L ${x(n - 1)} ${y(min)} L ${x(0)} ${y(min)} Z`
        return { line, area, pts }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, labels, height],
  )
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => min + ((max - min) * i) / yTicks)
  return (
    <div className={cx('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" onMouseLeave={() => setHover(null)}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={COLORS[s.color]} stopOpacity="0.28" />
              <stop offset="100%" stopColor={COLORS[s.color]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="rgb(var(--c-line) / 0.08)" strokeDasharray={i === 0 ? undefined : '3 5'} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" className="fill-faint" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {formatY(t)}
            </text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className="fill-faint" fontSize="11">
            {l}
          </text>
        ))}
        {paths.map((p, si) => (
          <g key={series[si].key}>
            {!series[si].dashed && <path d={p.area} fill={`url(#${id}-${series[si].key})`} />}
            <path d={p.line} fill="none" stroke={COLORS[series[si].color]} strokeWidth={2.2} strokeLinecap="round" strokeDasharray={series[si].dashed ? '5 5' : undefined} style={{ ['--dash' as string]: 2000 }} className="animate-draw" pathLength={2000} />
          </g>
        ))}
        {/* hover */}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - (W - padL - padR) / (2 * Math.max(1, n - 1))} y={0} width={(W - padL - padR) / Math.max(1, n - 1)} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="rgb(var(--c-line) / 0.25)" />
            {series.map((s) => (
              <circle key={s.key} cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={COLORS[s.color]} stroke="rgb(var(--c-surface))" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-raised/70 px-3 py-2 text-xs">
          <span className="font-medium text-ink">{labels[hover]}</span>
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5 text-muted">
              <i className="h-2 w-2 rounded-full" style={{ background: COLORS[s.color] }} />
              {s.label}: <b className="text-ink tnum">{(formatTip ?? formatY)(s.values[hover])}</b>
            </span>
          ))}
        </div>
      )}
      {showLegend && hover === null && (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <i className={cx('h-2 w-2 rounded-full', s.dashed && 'ring-1 ring-current')} style={{ background: s.dashed ? 'transparent' : COLORS[s.color], color: COLORS[s.color] }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- BarChart */

export function BarChart({ data, height = 200, color = 'brand', formatY = (v) => String(v), className, stacked }: { data: { label: string; value: number; value2?: number; color?: ChartColor }[]; height?: number; color?: ChartColor; formatY?: (v: number) => string; className?: string; stacked?: { label1: string; label2: string; color2: ChartColor } }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 720
  const H = height
  const padL = 52
  const padB = 26
  const padT = 12
  const max = Math.max(1, ...data.map((d) => d.value + (d.value2 ?? 0))) * 1.1
  const bw = (W - padL - 10) / data.length
  const y = (v: number) => padT + (H - padT - padB) * (1 - v / max)
  return (
    <div className={cx('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" onMouseLeave={() => setHover(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - 10} y1={y(max * f)} y2={y(max * f)} stroke="rgb(var(--c-line) / 0.08)" strokeDasharray={f === 0 ? undefined : '3 5'} />
            <text x={padL - 8} y={y(max * f) + 4} textAnchor="end" className="fill-faint" fontSize="11" fontFamily="JetBrains Mono, monospace">
              {formatY(max * f)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = padL + i * bw + bw * 0.22
          const w = bw * 0.56
          const h1 = y(0) - y(d.value)
          const h2 = d.value2 ? y(0) - y(d.value2) : 0
          return (
            <g key={i} onMouseEnter={() => setHover(i)} opacity={hover === null || hover === i ? 1 : 0.45} className="transition-opacity">
              <rect x={x0} y={y(d.value)} width={w} height={h1} rx={6} fill={COLORS[d.color ?? color]} />
              {d.value2 !== undefined && stacked && <rect x={x0} y={y(d.value + d.value2)} width={w} height={h2} rx={6} fill={COLORS[stacked.color2]} />}
              <text x={x0 + w / 2} y={H - 8} textAnchor="middle" className="fill-faint" fontSize="11">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
      {hover !== null && (
        <div className="mt-2 inline-flex items-center gap-3 rounded-xl border bg-raised/70 px-3 py-1.5 text-xs">
          <span className="font-medium text-ink">{data[hover].label}</span>
          <span className="text-muted">
            {stacked?.label1 ?? ''} <b className="text-ink tnum">{formatY(data[hover].value)}</b>
          </span>
          {data[hover].value2 !== undefined && (
            <span className="text-muted">
              {stacked?.label2 ?? ''} <b className="text-ink tnum">{formatY(data[hover].value2!)}</b>
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------- Donut */

export function Donut({ data, size = 160, thickness = 18, centerLabel, centerValue, className, formatValue = (v) => String(v) }: { data: { label: string; value: number; color: ChartColor }[]; size?: number; thickness?: number; centerLabel?: string; centerValue?: string; className?: string; formatValue?: (v: number) => string }) {
  const total = Math.max(1, data.reduce((a, d) => a + d.value, 0))
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let acc = 0
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div className={cx('flex items-center gap-5', className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-line) / 0.08)" strokeWidth={thickness} />
          {data.map((d, i) => {
            const len = (d.value / total) * c
            const el = <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={COLORS[d.color]} strokeWidth={hover === i ? thickness + 4 : thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} strokeLinecap="butt" className="transition-all duration-300" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            acc += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-lg font-semibold text-ink tnum leading-none">{hover !== null ? `${Math.round((data[hover].value / total) * 100)}%` : centerValue}</span>
          <span className="mt-1 text-2xs text-faint max-w-[80%] truncate">{hover !== null ? data[hover].label : centerLabel}</span>
        </div>
      </div>
      <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
        {data.map((d, i) => (
          <li key={i} className="flex items-center justify-between gap-3" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="inline-flex min-w-0 items-center gap-2 text-muted">
              <i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: COLORS[d.color] }} />
              <span className="truncate">{d.label}</span>
            </span>
            <span className="shrink-0 text-ink tnum text-[13px]">{formatValue(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------- Sparkline */

export function Sparkline({ values, color = 'brand', width = 100, height = 32, className }: { values: number[]; color?: ChartColor; width?: number; height?: number; className?: string }) {
  const id = useId()
  if (!values.length) return null
  const max = Math.max(...values)
  const min = Math.min(...values)
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * width, height - 3 - ((v - min) / Math.max(1e-9, max - min)) * (height - 6)] as [number, number])
  const d = smoothPath(pts)
  return (
    <svg width={width} height={height} className={cx('overflow-visible', className)}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={COLORS[color]} stopOpacity="0.3" />
          <stop offset="100%" stopColor={COLORS[color]} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={COLORS[color]} strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

/* ------------------------------------------------------------- Gauge */

export function Gauge({ value, label, color = 'brand', size = 120 }: { value: number; label?: string; color?: ChartColor; size?: number }) {
  const r = size / 2 - 10
  const c = Math.PI * r
  const v = Math.max(0, Math.min(100, value))
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`} fill="none" stroke="rgb(var(--c-line) / 0.1)" strokeWidth={10} strokeLinecap="round" />
        <path d={`M 10 ${size / 2} A ${r} ${r} 0 0 1 ${size - 10} ${size / 2}`} fill="none" stroke={COLORS[color]} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} className="transition-all duration-700" />
      </svg>
      <span className="absolute bottom-3 text-xl font-semibold text-ink tnum">{Math.round(v)}%</span>
      {label && <span className="mt-1 text-2xs text-faint">{label}</span>}
    </div>
  )
}
