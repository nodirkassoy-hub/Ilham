import { useMemo, useState } from 'react'
import { Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { BarChart3, Download, FileText, Lock, Scale, TrendingUp, Wallet, Boxes, HandCoins, Factory, Users, ArrowRight } from 'lucide-react'
import { useSession } from '@/app/useSession'
import { useT } from '@/core/i18n'
import { Ledger, aging, balanceSheet, cashFlow, monthlySeries, profitAndLoss, trialBalance } from '@/core/services/accounting'
import { Badge, Button, Card, SectionHeader, Select } from '@/ui/primitives'
import { AreaChart, BarChart } from '@/ui/charts'
import { AccessDenied, LockedValue } from '@/ui/gates'
import { cx, fmtMonth, money, pct, sum } from '@/core/utils/format'
import type { DataScope } from '@/core/rbac/permissions'
import type { FeatureId } from '@/core/billing/plans'
import { toast } from '@/ui/toast'
import type { DictKey } from '@/core/i18n/uz'

interface ReportDef {
  id: string
  labelKey: DictKey
  icon: typeof BarChart3
  scope: DataScope | null
  feature: FeatureId | null
  tone: string
}

const REPORTS: ReportDef[] = [
  { id: 'pnl', labelKey: 'rep.pnl', icon: TrendingUp, scope: 'finance.profit.view', feature: 'pnl', tone: 'brand' },
  { id: 'balance', labelKey: 'rep.balance', icon: Scale, scope: 'finance.executive.view', feature: 'balance.sheet', tone: 'sky' },
  { id: 'cashflow', labelKey: 'rep.cashflow', icon: Wallet, scope: 'finance.cash.view', feature: 'cashflow', tone: 'violet' },
  { id: 'trial', labelKey: 'rep.trial', icon: FileText, scope: 'finance.executive.view', feature: 'trial.balance', tone: 'gold' },
  { id: 'sales', labelKey: 'rep.sales', icon: BarChart3, scope: null, feature: null, tone: 'brand' },
  { id: 'stock', labelKey: 'rep.stock', icon: Boxes, scope: null, feature: null, tone: 'sky' },
  { id: 'receivables', labelKey: 'rep.receivables', icon: HandCoins, scope: 'finance.counterparty.balances.view', feature: 'receivables', tone: 'warning' },
  { id: 'production', labelKey: 'rep.production', icon: Factory, scope: 'finance.cost.view', feature: 'production.costing', tone: 'gold' },
  { id: 'payroll', labelKey: 'rep.payroll', icon: Users, scope: 'finance.payroll.view', feature: 'payroll', tone: 'danger' },
]

export default function ReportsPage() {
  return (
    <Routes>
      <Route index element={<ReportsIndex />} />
      <Route path=":id" element={<ReportView />} />
    </Routes>
  )
}

function ReportsIndex() {
  const t = useT()
  const nav = useNavigate()
  const { can, has } = useSession()
  if (!can('reports.view')) return <AccessDenied perm="reports.view" />
  return (
    <div className="space-y-6">
      <SectionHeader title={t('rep.title')} sub={t('rep.sub')} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => {
          const scopeOk = !r.scope || can(r.scope)
          const planOk = !r.feature || has(r.feature)
          const ok = scopeOk && planOk
          return (
            <button key={r.id} onClick={() => nav(`/app/reports/${r.id}`)} className={cx('card sheen group p-5 text-left transition-all', ok ? 'hover:-translate-y-0.5 hover:shadow-lift' : 'opacity-75')}>
              <div className="flex items-start justify-between"><span className={cx('grid h-10 w-10 place-items-center rounded-xl', ok ? 'bg-brand/12 text-brand' : 'bg-line/6 text-faint')}><r.icon size={18} /></span>{!ok && <Lock size={14} className="text-faint" />}</div>
              <h3 className="mt-3 font-semibold">{t(r.labelKey)}</h3>
              <p className="mt-1 text-xs text-muted">{!planOk ? t('rep.locked') : !scopeOk ? t('rep.scopeLocked') : 'Excel · PDF · davrlar taqqoslash'}</p>
              {ok && <span className="mt-3 inline-flex items-center gap-1 text-xs text-brand">Ochish <ArrowRight size={12} /></span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function useMonths(n: number) {
  return useMemo(() => {
    const now = new Date()
    const out: string[] = []
    for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7))
    return out
  }, [n])
}

function ReportView() {
  const { id } = useParams()
  const t = useT()
  const nav = useNavigate()
  const { tenant, can, has } = useSession()
  const months = useMonths(12)
  const [period, setPeriod] = useState(months.at(-2)!)
  const def = REPORTS.find((r) => r.id === id)
  if (!tenant || !def) return <AccessDenied />
  if (!can('reports.view')) return <AccessDenied perm="reports.view" />
  if (def.feature && !has(def.feature)) return <LockedReport reason="plan" />
  if (def.scope && !can(def.scope)) return <LockedReport reason="scope" scope={def.scope} />
  const ledger = new Ledger(tenant.accounts)
  const from = `${period}-01`
  const to = `${period}-31`
  const exportBtn = (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" icon={<Download size={14} />} onClick={() => (can('reports.export') ? toast.success(t('rep.generated'), t('rep.pdfNote')) : toast.error(t('err.permission')))}>{t('rep.excel')}</Button>
      <Button size="sm" variant="secondary" icon={<FileText size={14} />} onClick={() => (can('reports.export') ? toast.success(t('rep.generated'), t('rep.pdfNote')) : toast.error(t('err.permission')))}>{t('rep.pdf')}</Button>
    </div>
  )
  return (
    <div className="space-y-6">
      <SectionHeader title={t(def.labelKey)} sub={<button onClick={() => nav('/app/reports')} className="hover:text-ink">← {t('rep.title')}</button>} actions={<><Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-40">{months.map((m) => <option key={m} value={m}>{fmtMonth(`${m}-01`)}</option>)}</Select>{exportBtn}</>} />
      {def.id === 'pnl' && <PnlReport ledger={ledger} from={from} to={to} months={months} />}
      {def.id === 'balance' && <BalanceReport ledger={ledger} asOf={to} />}
      {def.id === 'cashflow' && <CashflowReport ledger={ledger} months={months} />}
      {def.id === 'trial' && <TrialReport ledger={ledger} from={from} to={to} />}
      {def.id === 'sales' && <SalesReport period={period} />}
      {def.id === 'stock' && <StockReport />}
      {def.id === 'receivables' && <ReceivablesReport />}
      {def.id === 'production' && <ProductionReport />}
      {def.id === 'payroll' && <PayrollReport />}
    </div>
  )
}

function LockedReport({ reason, scope }: { reason: 'plan' | 'scope'; scope?: DataScope }) {
  const t = useT()
  const nav = useNavigate()
  return (
    <div className="space-y-6">
      <SectionHeader title={t('rep.title')} sub={<button onClick={() => nav('/app/reports')} className="hover:text-ink">← {t('rep.title')}</button>} />
      <Card className="mx-auto max-w-md text-center"><div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-line/6 text-faint"><Lock size={22} /></div><p className="font-semibold">{reason === 'plan' ? t('access.plan.title') : t('access.scope.title')}</p><p className="mt-1 text-sm text-muted">{reason === 'plan' ? t('rep.locked') : t('rep.scopeLocked')}</p>{scope && <div className="mt-3 flex justify-center"><LockedValue scope={scope} /></div>}</Card>
    </div>
  )
}

function Line({ k, v, bold, indent, tone }: { k: string; v: string; bold?: boolean; indent?: boolean; tone?: 'brand' | 'danger' | 'muted' }) {
  return (
    <div className={cx('flex items-center justify-between py-2', bold ? 'border-t font-semibold' : 'text-sm', indent && 'pl-5')}>
      <span className={cx(!bold && 'text-muted', tone === 'brand' && 'text-brand', tone === 'danger' && 'text-danger')}>{k}</span>
      <span className={cx('tnum', tone === 'brand' && 'text-brand', tone === 'danger' && 'text-danger')}>{v}</span>
    </div>
  )
}

function PnlReport({ ledger, from, to, months }: { ledger: Ledger; from: string; to: string; months: string[] }) {
  const t = useT()
  const { tenant } = useSession()
  const pl = profitAndLoss(ledger, tenant!.journal, from, to)
  const prevM = months[months.indexOf(from.slice(0, 7)) - 1]
  const prev = prevM ? profitAndLoss(ledger, tenant!.journal, `${prevM}-01`, `${prevM}-31`) : null
  const series = monthlySeries(ledger, tenant!.journal, months.slice(-6))
  const d = (a: number, b?: number) => (b ? ` (${pct(((a - b) / Math.abs(b)) * 100, 1, true)})` : '')
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <Card>
        <p className="text-xs font-semibold uppercase tracking-wider text-faint">1. {t('rep.revenue')}</p>
        <Line k={t('rep.revenue')} v={money(pl.revenue) + d(pl.revenue, prev?.revenue)} />
        <Line k="Boshqa daromadlar" v={money(pl.otherIncome)} />
        <Line k={t('rep.cogs')} v={'−' + money(pl.cogs)} tone="danger" />
        <Line k={t('rep.gross')} v={`${money(pl.grossProfit)} · ${pct(pl.grossMarginPct)}`} bold />
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-faint">2. {t('rep.opex')}</p>
        {pl.opexByAccount.map((r) => <Line key={r.account.id} k={r.account.name} v={'−' + money(r.amount)} indent />)}
        <Line k={t('rep.opex')} v={'−' + money(pl.opex)} bold />
        <Line k="Soliqlar" v={'−' + money(pl.taxes)} />
        <div className="mt-4 rounded-2xl bg-brand/8 p-4"><div className="flex items-center justify-between"><span className="font-semibold">{t('rep.net')}</span><span className="text-xl font-bold tnum text-brand">{money(pl.netProfit)}</span></div><div className="mt-1 flex items-center justify-between text-xs text-muted"><span>{t('rep.margin')}</span><span className="tnum">{pct(pl.netMarginPct)}{prev ? ` · o‘tgan oy ${pct(prev.netMarginPct)}` : ''}</span></div></div>
      </Card>
      <div className="space-y-4">
        <Card><p className="mb-3 text-sm font-semibold">{t('dash.trend')}</p><AreaChart height={220} labels={series.map((s) => fmtMonth(`${s.month}-01`))} formatY={(v) => money(v, { compact: true, currency: '' })} formatTip={(v) => money(v, { compact: true })} series={[{ key: 'r', label: t('rep.revenue'), color: 'brand', values: series.map((s) => s.revenue) }, { key: 'c', label: t('rep.cogs'), color: 'gold', values: series.map((s) => s.cogs), dashed: true }, { key: 'p', label: t('rep.net'), color: 'sky', values: series.map((s) => s.profit) }]} /></Card>
        <Card><p className="mb-3 text-sm font-semibold">{t('rep.margin')} · 6 oy</p><BarChart height={160} color="sky" data={series.map((s) => ({ label: fmtMonth(`${s.month}-01`), value: s.revenue ? Math.round((s.profit / s.revenue) * 1000) / 10 : 0 }))} formatY={(v) => `${v.toFixed(0)}%`} /></Card>
      </div>
    </div>
  )
}

function BalanceReport({ ledger, asOf }: { ledger: Ledger; asOf: string }) {
  const t = useT()
  const { tenant } = useSession()
  const bs = balanceSheet(ledger, tenant!.journal, asOf)
  return (
    <div className="space-y-4">
      <div className={cx('flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm', bs.balanced ? 'border-success/30 bg-success/8' : 'border-danger/30 bg-danger/8')}><Scale size={16} className={bs.balanced ? 'text-success' : 'text-danger'} />{bs.balanced ? t('rep.balanced') : t('rep.notBalanced')} · {money(bs.totalAssets)} = {money(bs.totalLiabilities)} + {money(bs.totalEquity)}</div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><p className="text-xs font-semibold uppercase tracking-wider text-faint">{t('rep.assets')}</p>{bs.assets.map((r) => <Line key={r.account.id} k={`${r.account.code} ${r.account.name}`} v={money(r.amount)} />)}<Line k={t('rep.assets')} v={money(bs.totalAssets)} bold /></Card>
        <Card><p className="text-xs font-semibold uppercase tracking-wider text-faint">{t('rep.liabilities')}</p>{bs.liabilities.map((r) => <Line key={r.account.id} k={`${r.account.code} ${r.account.name}`} v={money(r.amount)} />)}<Line k={t('rep.liabilities')} v={money(bs.totalLiabilities)} bold /><p className="mt-5 text-xs font-semibold uppercase tracking-wider text-faint">{t('rep.equity')}</p>{bs.equity.map((r) => <Line key={r.account.id} k={`${r.account.code} ${r.account.name}`} v={money(r.amount)} />)}<Line k="Joriy davr foydasi" v={money(bs.currentPeriodProfit)} /><Line k={t('rep.equity')} v={money(bs.totalEquity)} bold /></Card>
      </div>
    </div>
  )
}

function CashflowReport({ ledger, months }: { ledger: Ledger; months: string[] }) {
  const t = useT()
  const { tenant } = useSession()
  const cf = cashFlow(ledger, tenant!.journal, `${months.at(-6)}-01`, `${months.at(-1)}-31`)
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
      <Card><Line k="Boshlang‘ich qoldiq" v={money(cf.opening)} /><Line k={t('rep.operating')} v={money(cf.operating, { sign: true })} tone={cf.operating >= 0 ? 'brand' : 'danger'} /><Line k={t('rep.investing')} v={money(cf.investing, { sign: true })} /><Line k={t('rep.financing')} v={money(cf.financing, { sign: true })} /><Line k="Sof o‘zgarish" v={money(cf.net, { sign: true })} bold /><Line k="Yakuniy qoldiq" v={money(cf.closing)} bold tone="brand" /><p className="mt-3 text-2xs text-faint">Kirim {money(cf.inflows, { compact: true })} · Chiqim {money(cf.outflows, { compact: true })} · so‘nggi 6 oy</p></Card>
      <Card><p className="mb-3 text-sm font-semibold">Oylik kirim va chiqim</p><BarChart height={240} data={cf.byMonth.map((m) => ({ label: fmtMonth(`${m.month}-01`), value: m.inflow, value2: m.outflow }))} stacked={{ label1: 'Kirim', label2: 'Chiqim', color2: 'danger' }} formatY={(v) => money(v, { compact: true, currency: '' })} /></Card>
    </div>
  )
}

function TrialReport({ ledger, from, to }: { ledger: Ledger; from: string; to: string }) {
  const { tenant } = useSession()
  const tb = trialBalance(ledger, tenant!.journal, from, to)
  const D = sum(tb, (b) => b.debit)
  const C = sum(tb, (b) => b.credit)
  return (
    <Card padded={false}>
      <table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">Hisob</th><th className="px-5 py-2 text-right font-medium">Debet</th><th className="px-5 py-2 text-right font-medium">Kredit</th><th className="px-5 py-2 text-right font-medium">Qoldiq</th></tr></thead><tbody>{tb.map((b) => <tr key={b.account.id} className="border-b last:border-0"><td className="px-5 py-2"><span className="font-mono text-xs text-muted">{b.account.code}</span> {b.account.name}</td><td className="px-5 py-2 text-right tnum">{money(b.debit, { currency: '' })}</td><td className="px-5 py-2 text-right tnum">{money(b.credit, { currency: '' })}</td><td className="px-5 py-2 text-right tnum font-medium">{money(b.balance, { currency: '' })}</td></tr>)}</tbody><tfoot><tr className="border-t font-semibold"><td className="px-5 py-3">Jami</td><td className="px-5 py-3 text-right tnum">{money(D, { currency: '' })}</td><td className="px-5 py-3 text-right tnum">{money(C, { currency: '' })}</td><td className="px-5 py-3 text-right"><Badge tone={Math.abs(D - C) < 2 ? 'success' : 'danger'}>{Math.abs(D - C) < 2 ? 'D = K' : 'D ≠ K'}</Badge></td></tr></tfoot></table>
    </Card>
  )
}

function SalesReport({ period }: { period: string }) {
  const t = useT()
  const { tenant, can, principal } = useSession()
  const sales = tenant!.sales.filter((s) => s.occurredAt.startsWith(period) && (principal?.dataScope === 'SELF' ? s.soldByMemberId === principal.memberId : true))
  const byDay = Object.entries(sales.reduce<Record<string, number>>((a, s) => ((a[s.occurredAt.slice(8, 10)] = (a[s.occurredAt.slice(8, 10)] ?? 0) + s.total), a), {})).sort(([a], [b]) => a.localeCompare(b))
  const byProd = Object.entries(sales.flatMap((s) => s.lines).reduce<Record<string, { q: number; r: number; c: number }>>((a, l) => { a[l.productId] ??= { q: 0, r: 0, c: 0 }; a[l.productId].q += l.qty; a[l.productId].r += l.qty * l.unitPrice * (1 - l.discountPct / 100); a[l.productId].c += l.qty * l.unitCost; return a }, {})).map(([id, v]) => ({ p: tenant!.products.find((x) => x.id === id)!, ...v })).filter((x) => x.p).sort((a, b) => b.r - a.r)
  const byChannel = Object.entries(sales.reduce<Record<string, number>>((a, s) => ((a[s.channel] = (a[s.channel] ?? 0) + s.total), a), {}))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4"><Card><p className="text-2xs uppercase text-faint">Savdolar</p><p className="mt-1 text-xl font-semibold tnum">{sales.length}</p></Card><Card><p className="text-2xs uppercase text-faint">{t('common.total')}</p><p className="mt-1 text-xl font-semibold tnum">{money(sum(sales, (s) => s.total), { compact: true })}</p></Card><Card><p className="text-2xs uppercase text-faint">{t('dash.avgCheck')}</p><p className="mt-1 text-xl font-semibold tnum">{money(sales.length ? sum(sales, (s) => s.total) / sales.length : 0, { compact: true })}</p></Card><Card><p className="text-2xs uppercase text-faint">{t('sales.margin')}</p>{can('finance.cost.view') ? <p className="mt-1 text-xl font-semibold tnum">{(() => { const r = sum(sales, (s) => s.total - s.vatAmount); const c = sum(sales, (s) => s.cogs); return r ? pct(((r - c) / r) * 100) : '—' })()}</p> : <LockedValue scope="finance.cost.view" compact />}</Card></div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card><p className="mb-3 text-sm font-semibold">Kunlik savdo</p><BarChart height={200} data={byDay.map(([d, v]) => ({ label: d, value: v }))} formatY={(v) => money(v, { compact: true, currency: '' })} /></Card>
        <Card><p className="mb-3 text-sm font-semibold">Kanallar</p>{byChannel.map(([k, v]) => <Line key={k} k={k} v={money(v, { compact: true })} />)}</Card>
      </div>
      <Card padded={false}><table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">Mahsulot</th><th className="px-5 py-2 text-right font-medium">Miqdor</th><th className="px-5 py-2 text-right font-medium">Summa</th><th className="px-5 py-2 text-right font-medium">Marja</th></tr></thead><tbody>{byProd.slice(0, 12).map((x) => <tr key={x.p.id} className="border-b last:border-0"><td className="px-5 py-2">{x.p.name}</td><td className="px-5 py-2 text-right tnum">{x.q}</td><td className="px-5 py-2 text-right tnum">{money(x.r, { compact: true })}</td><td className="px-5 py-2 text-right tnum">{can('finance.cost.view') ? pct(x.r ? ((x.r / 1.12 - x.c) / (x.r / 1.12)) * 100 : 0) : <LockedValue scope="finance.cost.view" compact />}</td></tr>)}</tbody></table></Card>
    </div>
  )
}

function StockReport() {
  const t = useT()
  const { tenant, can } = useSession()
  const rows = tenant!.warehouses.map((w) => { const st = tenant!.stock.filter((s) => s.warehouseId === w.id); return { w, sku: st.length, qty: sum(st, (s) => s.onHand), value: sum(st, (s) => (s.onHand + s.inTransit) * s.avgCost), low: st.filter((s) => { const p = tenant!.products.find((x) => x.id === s.productId); return p && p.reorderLevel > 0 && s.onHand - s.reserved <= p.reorderLevel }).length } })
  return (
    <div className="space-y-4">
      <Card padded={false}><table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">{t('inv2.field.warehouse')}</th><th className="px-5 py-2 text-right font-medium">SKU</th><th className="px-5 py-2 text-right font-medium">Miqdor</th><th className="px-5 py-2 text-right font-medium">{t('inv2.lowStock')}</th><th className="px-5 py-2 text-right font-medium">{t('inv2.value')}</th></tr></thead><tbody>{rows.map((r) => <tr key={r.w.id} className="border-b last:border-0"><td className="px-5 py-2">{r.w.name}</td><td className="px-5 py-2 text-right tnum">{r.sku}</td><td className="px-5 py-2 text-right tnum">{money(r.qty, { currency: '' })}</td><td className={cx('px-5 py-2 text-right tnum', r.low && 'text-warning')}>{r.low}</td><td className="px-5 py-2 text-right tnum">{can('finance.cost.view') ? money(r.value, { compact: true }) : <LockedValue scope="finance.cost.view" compact />}</td></tr>)}</tbody></table></Card>
      <Card><p className="mb-3 text-sm font-semibold">Harakatlar (so‘nggi 30 kun)</p><BarChart height={180} data={Object.entries(tenant!.movements.filter((m) => m.occurredAt > new Date(Date.now() - 30 * 86_400_000).toISOString()).reduce<Record<string, number>>((a, m) => ((a[m.type] = (a[m.type] ?? 0) + Math.abs(m.qty)), a), {})).map(([k, v]) => ({ label: t(`inv2.movement.${k}` as DictKey).slice(0, 14), value: v }))} formatY={(v) => String(Math.round(v))} /></Card>
    </div>
  )
}

function ReceivablesReport() {
  const t = useT()
  const { tenant } = useSession()
  const ar = aging(tenant!.invoices, 'OUT')
  const ap = aging(tenant!.invoices, 'IN')
  const labels = ['acc.aging.current', 'acc.aging.30', 'acc.aging.60', 'acc.aging.90', 'acc.aging.over'] as const
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[{ title: t('dash.receivables'), a: ar }, { title: t('dash.payables'), a: ap }].map(({ title, a }) => (
        <Card key={title}><p className="text-sm font-semibold">{title}</p><p className="text-xs text-muted">{money(a.total)} · {t('dash.overdue').toLowerCase()} {money(a.overdue, { compact: true })}</p><BarChart height={180} className="mt-3" data={a.buckets.map((b, i) => ({ label: t(labels[i]), value: b.amount, color: i === 0 ? 'brand' : i === 4 ? 'danger' : 'warning' }))} formatY={(v) => money(v, { compact: true, currency: '' })} /></Card>
      ))}
    </div>
  )
}

function ProductionReport() {
  const t = useT()
  const { tenant } = useSession()
  const done = tenant!.productionOrders.filter((o) => o.status === 'COMPLETED' || o.status === 'CLOSED').slice(0, 12)
  return (
    <Card padded={false}><table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">Buyurtma</th><th className="px-5 py-2 text-right font-medium">Dona</th><th className="px-5 py-2 text-right font-medium">{t('mfg.planned')}</th><th className="px-5 py-2 text-right font-medium">{t('mfg.actual')}</th><th className="px-5 py-2 text-right font-medium">{t('mfg.variance')}</th><th className="px-5 py-2 text-right font-medium">{t('mfg.cost.perUnit')}</th></tr></thead><tbody>{done.map((o) => { const pl = sum(o.costs, (c) => c.planned); const ac = sum(o.costs, (c) => c.actual); const v = pl ? ((ac - pl) / pl) * 100 : 0; return <tr key={o.id} className="border-b last:border-0"><td className="px-5 py-2"><span className="font-mono text-xs text-muted">{o.number}</span> {tenant!.products.find((p) => p.id === o.productId)?.name}</td><td className="px-5 py-2 text-right tnum">{o.producedQty}</td><td className="px-5 py-2 text-right tnum">{money(pl, { compact: true })}</td><td className="px-5 py-2 text-right tnum">{money(ac, { compact: true })}</td><td className={cx('px-5 py-2 text-right tnum', v > 3 ? 'text-danger' : v < -3 ? 'text-success' : '')}>{pct(v, 1, true)}</td><td className="px-5 py-2 text-right tnum">{money(ac / Math.max(1, o.producedQty), { compact: true })}</td></tr> })}</tbody></table></Card>
  )
}

function PayrollReport() {
  const { tenant } = useSession()
  const runs = tenant!.payrollRuns.slice(-6)
  return (
    <div className="space-y-4">
      <Card><BarChart height={200} data={runs.map((r) => ({ label: fmtMonth(`${r.periodLabel}-01`), value: r.netTotal, value2: r.taxTotal }))} stacked={{ label1: 'Qo‘lga', label2: 'Soliqlar', color2: 'danger' }} formatY={(v) => money(v, { compact: true, currency: '' })} /></Card>
      <Card padded={false}><table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">Davr</th><th className="px-5 py-2 text-right font-medium">Xodimlar</th><th className="px-5 py-2 text-right font-medium">Hisoblangan</th><th className="px-5 py-2 text-right font-medium">Soliqlar</th><th className="px-5 py-2 text-right font-medium">Qo‘lga</th><th className="px-5 py-2 text-right font-medium">Holat</th></tr></thead><tbody>{[...runs].reverse().map((r) => <tr key={r.id} className="border-b last:border-0"><td className="px-5 py-2 font-mono">{r.periodLabel}</td><td className="px-5 py-2 text-right tnum">{r.headcount}</td><td className="px-5 py-2 text-right tnum">{money(r.grossTotal, { compact: true })}</td><td className="px-5 py-2 text-right tnum">{money(r.taxTotal, { compact: true })}</td><td className="px-5 py-2 text-right tnum font-medium">{money(r.netTotal, { compact: true })}</td><td className="px-5 py-2 text-right"><Badge tone={r.status === 'PAID' ? 'success' : 'warning'}>{r.status}</Badge></td></tr>)}</tbody></table></Card>
    </div>
  )
}
