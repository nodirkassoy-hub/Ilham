import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, ClipboardCheck, EyeOff, Factory, HandCoins, Landmark, Lock, PackageCheck, Settings2, ShoppingCart, Sparkles, Truck, Users, Wallet, Wrench } from 'lucide-react'
import { useSession } from '@/app/useSession'
import { useT } from '@/core/i18n'
import { fmtMonth, money, num, pct, relTime, sum } from '@/core/utils/format'
import { Badge, Button, Card, Modal, SectionHeader, StatusBadge, Toggle } from '@/ui/primitives'
import { AreaChart, BarChart, Donut, Sparkline } from '@/ui/charts'
import { LockedValue, ReadOnlyBanner, whoCanSee } from '@/ui/gates'
import { useDashboardData, type DashboardData } from './dashboardData'
import type { DataScope, RoleId } from '@/core/rbac/permissions'
import { ROLE_ORDER } from '@/core/rbac/permissions'
import { useAppStore, type DashboardMetric } from '@/store/appStore'
import { proactiveInsights } from '@/core/services/aiCfo'
import { ClaimTag } from './AiCfoDock'
import { cx } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'
import { useI18nStore } from '@/core/i18n'

/* ---------------------------------------------------------- role → view */

type View = 'owner' | 'accountant' | 'sales' | 'warehouse' | 'production' | 'hr' | 'basic'
const VIEW_OF: Record<RoleId, View> = {
  OWNER: 'owner',
  ADMIN: 'owner',
  DIRECTOR: 'owner',
  AUDITOR: 'owner',
  CHIEF_ACCOUNTANT: 'accountant',
  ACCOUNTANT: 'accountant',
  SALES_MANAGER: 'sales',
  SALES_EMPLOYEE: 'sales',
  CASHIER: 'sales',
  WAREHOUSE_MANAGER: 'warehouse',
  WAREHOUSE_EMPLOYEE: 'warehouse',
  PURCHASING_MANAGER: 'warehouse',
  PRODUCTION_MANAGER: 'production',
  FACTORY_WORKER: 'production',
  HR_MANAGER: 'hr',
  CUSTOM: 'basic',
}

export default function Dashboard() {
  const { member, tenant } = useSession()
  const data = useDashboardData()
  if (!member || !tenant || !data) return null
  const view = VIEW_OF[member.role]
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      {view === 'owner' && <OwnerDashboard d={data} />}
      {view === 'accountant' && <AccountantDashboard d={data} />}
      {view === 'sales' && <SalesDashboard d={data} />}
      {view === 'warehouse' && <WarehouseDashboard d={data} />}
      {view === 'production' && <ProductionDashboard d={data} />}
      {view === 'hr' && <HrDashboard d={data} />}
      {view === 'basic' && <SalesDashboard d={data} />}
    </div>
  )
}

/* -------------------------------------------------------------- pieces */

const KPI_TONE = {
  brand: 'bg-brand/12 text-brand',
  sky: 'bg-sky/12 text-sky',
  violet: 'bg-violet/12 text-violet',
  gold: 'bg-gold/14 text-gold',
  danger: 'bg-danger/12 text-danger',
  success: 'bg-success/12 text-success',
  warning: 'bg-warning/14 text-warning',
} as const

function Kpi({ label, value, delta, sub, scope, metric, spark, icon, tone = 'brand', to }: { label: string; value: ReactNode; delta?: number; sub?: ReactNode; scope?: DataScope; metric?: DashboardMetric; spark?: number[]; icon?: ReactNode; tone?: 'brand' | 'sky' | 'violet' | 'gold' | 'danger' | 'success' | 'warning'; to?: string }) {
  const { can, member, tenant } = useSession()
  const hidden = useAppStore((s) => (tenant ? s.dashboardHidden[tenant.company.tenantId] : undefined))
  const t = useT()
  const roleHidden = metric && member ? (hidden?.[metric] ?? []).includes(member.role) && !['OWNER', 'ADMIN'].includes(member.role) : false
  const locked = (scope && !can(scope)) || roleHidden
  const body = (
    <Card className={cx('relative h-full', locked && 'opacity-90')} hover={!!to && !locked}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-medium uppercase tracking-wider text-faint">{label}</p>
        {icon && <span className={cx('grid h-8 w-8 place-items-center rounded-xl', KPI_TONE[tone])}>{icon}</span>}
      </div>
      {locked ? (
        <div className="mt-3">
          <LockedValue scope={scope ?? 'finance.executive.view'} compact />
          <p className="mt-2 text-2xs text-faint">{roleHidden ? t('dash.hiddenFor') : t('access.scope.body')}</p>
        </div>
      ) : (
        <div className="mt-2 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tnum sm:text-2xl">{value}</p>
            {delta !== undefined ? (
              <p className={cx('mt-1 inline-flex items-center gap-1 text-xs tnum', delta >= 0 ? 'text-success' : 'text-danger')}>
                {delta >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {pct(delta, 1, true)} <span className="text-faint">{t('dash.kpi.vsLast')}</span>
              </p>
            ) : sub ? (
              <p className="mt-1 text-xs text-muted">{sub}</p>
            ) : null}
          </div>
          {spark && spark.length > 1 && <Sparkline values={spark} color={tone} width={80} height={28} />}
        </div>
      )}
    </Card>
  )
  return to && !locked ? <Link to={to}>{body}</Link> : body
}

function AlertsCard({ d }: { d: DashboardData }) {
  const t = useT()
  const { tenant, principal, ent, can } = useSession()
  const items: { tone: 'danger' | 'warning' | 'sky'; text: string; to: string }[] = []
  if (can('finance.counterparty.balances.view') && d.ar.overdue > 0) items.push({ tone: 'danger', text: `${d.ar.buckets.slice(1).reduce((a, b) => a + b.count, 0)} ta faktura muddati o'tgan — ${money(d.ar.overdue, { compact: true })}`, to: '/app/invoices' })
  if (can('stock.view') && d.low.length) items.push({ tone: 'warning', text: `${d.low.length} ta mahsulot minimal zaxiradan past`, to: '/app/inventory/stock' })
  if (can('payments.approve') && d.pendingPayments.length) items.push({ tone: 'sky', text: `${d.pendingPayments.length} ta to'lov tasdiq kutmoqda`, to: '/app/payments' })
  if (can('purchasing.approve') && d.purchasesPendingApproval.length) items.push({ tone: 'sky', text: `${d.purchasesPendingApproval.length} ta xarid talabi tasdiq kutmoqda`, to: '/app/purchasing' })
  if (can('machines.view') && d.overdueMachines.length) items.push({ tone: 'warning', text: `${d.overdueMachines.length} ta uskuna texnik xizmat muddati o'tgan`, to: '/app/manufacturing/machines' })
  if (can('leave.approve') && d.pendingLeaves.length) items.push({ tone: 'sky', text: `${d.pendingLeaves.length} ta ta'til arizasi kutmoqda`, to: '/app/hr/leave' })
  const ai = tenant && principal && can('ai.view') ? proactiveInsights(tenant, principal, ent).slice(0, 2) : []
  return (
    <Card>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t('dash.alerts')}</p>
        <AlertTriangle size={15} className="text-warning" />
      </div>
      {items.length === 0 && ai.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{t('dash.alerts.none')}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((it, i) => (
            <li key={i}>
              <Link to={it.to} className="flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition hover:bg-line/5">
                <span className={cx('h-2 w-2 shrink-0 rounded-full', it.tone === 'danger' ? 'bg-danger' : it.tone === 'warning' ? 'bg-warning' : 'bg-sky')} />
                <span className="flex-1">{it.text}</span>
                <ArrowRight size={14} className="text-faint" />
              </Link>
            </li>
          ))}
          {ai.map((i, k) => (
            <li key={`ai${k}`} className="rounded-xl border border-brand/25 bg-brand/6 px-3 py-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand">
                  <Sparkles size={12} /> AI CFO · {i.title}
                </span>
                <ClaimTag type={i.claimType} />
              </div>
              <p className="mt-0.5 text-xs text-muted">{i.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function RecentOps({ d, mineOnly }: { d: DashboardData; mineOnly?: boolean }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, principal } = useSession()
  const rows = (mineOnly ? d.salesMonth : tenant!.sales).slice(0, 7)
  return (
    <Card padded={false}>
      <div className="flex items-center justify-between px-5 py-4">
        <p className="text-sm font-semibold">{t('dash.recentOps')}</p>
        <Link to="/app/sales" className="text-xs text-muted hover:text-ink">
          {t('common.viewAll')}
        </Link>
      </div>
      <ul className="divide-y">
        {rows.map((s) => {
          const c = tenant!.counterparties.find((x) => x.id === s.customerId)
          const seller = tenant!.members.find((m) => m.id === s.soldByMemberId)
          return (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <ShoppingCart size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{c?.name ?? '—'}</span>
                <span className="block text-2xs text-faint">
                  {s.number} · {principal?.dataScope === 'SELF' ? '' : `${seller?.fullName.split(' ')[0] ?? ''} · `}
                  {relTime(s.occurredAt, lang)}
                </span>
              </span>
              <span className="text-right">
                <span className="block tnum font-medium">{money(s.total, { compact: true })}</span>
                <StatusBadge status={s.status} size="xs" label={s.status === 'PAID' ? t('sales.paid') : s.status === 'PARTIALLY_PAID' ? t('sales.partial') : t('sales.unpaid')} />
              </span>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

/* --------------------------------------------------------- OWNER */

function OwnerDashboard({ d }: { d: DashboardData }) {
  const t = useT()
  const { member, can } = useSession()
  const [cfg, setCfg] = useState(false)
  const labels = d.months.map((m) => fmtMonth(`${m}-01`))
  return (
    <>
      <SectionHeader
        title={t('dash.owner.title')}
        sub={t('dash.owner.sub')}
        actions={
          <>
            <Badge tone="muted">{t('common.thisMonth')}: {fmtMonth(`${d.cur}-01`)}</Badge>
            {['OWNER', 'ADMIN'].includes(member!.role) && (
              <Button variant="secondary" size="sm" icon={<Settings2 size={14} />} onClick={() => setCfg(true)}>
                {t('dash.customize')}
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('dash.salesMonth')} value={money(sum(d.salesMonth, (s) => s.total), { compact: true })} delta={d.salesDelta} spark={d.series.map((s) => s.revenue)} scope="finance.revenue.view" metric="revenue" icon={<ShoppingCart size={15} />} to="/app/sales" />
        <Kpi label={t('dash.profit')} value={money(d.plCur.netProfit, { compact: true })} delta={d.profitDelta} spark={d.series.map((s) => s.profit)} scope="finance.profit.view" metric="profit" tone="sky" icon={<ArrowUpRight size={15} />} to="/app/reports/pnl" />
        <Kpi label={t('dash.cash')} value={money(d.bs.cash + d.bs.bank, { compact: true })} sub={`${t('dash.cash')} ${money(d.bs.cash, { compact: true })} · ${t('dash.bank')} ${money(d.bs.bank, { compact: true })}`} scope="finance.cash.view" metric="cash" tone="violet" icon={<Landmark size={15} />} to="/app/reports/cashflow" />
        <Kpi label={t('dash.receivables')} value={money(d.bs.receivables, { compact: true })} sub={<span className={d.ar.overdue > 0 ? 'text-danger' : ''}>{money(d.ar.overdue, { compact: true })} {t('dash.overdue').toLowerCase()}</span>} scope="finance.counterparty.balances.view" metric="receivables" tone="gold" icon={<HandCoins size={15} />} to="/app/invoices" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">{t('dash.trend')}</p>
              <p className="text-xs text-faint">{t('dash.trend.sub')}</p>
            </div>
            <Link to="/app/reports/pnl" className="text-xs text-muted hover:text-ink">
              {t('rep.pnl')} →
            </Link>
          </div>
          {can('finance.revenue.view') ? (
            <AreaChart
              height={240}
              labels={labels}
              formatY={(v) => money(v, { compact: true, currency: '' })}
              formatTip={(v) => money(v, { compact: true })}
              series={[
                { key: 'rev', label: t('dash.revenue'), color: 'brand', values: d.series.map((s) => s.revenue) },
                ...(can('finance.expense.view') ? [{ key: 'exp', label: t('dash.expenses'), color: 'danger' as const, values: d.series.map((s) => s.expenses + s.cogs), dashed: true }] : []),
                ...(can('finance.profit.view') ? [{ key: 'pr', label: t('dash.profit'), color: 'sky' as const, values: d.series.map((s) => s.profit) }] : []),
              ]}
            />
          ) : (
            <div className="grid h-[240px] place-items-center">
              <LockedValue scope="finance.revenue.view" />
            </div>
          )}
        </Card>
        <div className="grid gap-4">
          <Card>
            <p className="text-sm font-semibold">{t('dash.structure')}</p>
            <p className="mb-3 text-xs text-faint">{t('dash.structure.sub')}</p>
            {can('finance.expense.view') ? (
              <Donut size={130} thickness={16} centerLabel={t('common.thisMonth')} centerValue={money(d.plCur.opex + d.plCur.taxes, { compact: true, currency: '' })} formatValue={(v) => money(v, { compact: true, currency: '' })} data={d.plCur.opexByAccount.slice(0, 5).map((r, i) => ({ label: r.account.name.replace(/Ma'muriy xarajatlar — /, ''), value: r.amount, color: (['brand', 'sky', 'violet', 'gold', 'danger'] as const)[i] }))} />
            ) : (
              <LockedValue scope="finance.expense.view" />
            )}
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Kpi label={t('dash.payables')} value={money(d.bs.payables, { compact: true })} scope="finance.counterparty.balances.view" metric="payables" tone="warning" sub={`${money(d.ap.overdue, { compact: true })} ${t('dash.overdue').toLowerCase()}`} to="/app/payments" />
            <Kpi label={t('dash.inventoryValue')} value={money(d.stockValue, { compact: true })} scope="finance.cost.view" metric="inventory" tone="success" sub={`${d.low.length} ${t('dash.lowStock').toLowerCase()}`} to="/app/inventory/stock" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <AlertsCard d={d} />
        <Card>
          <p className="text-sm font-semibold">{t('dash.topProducts')}</p>
          <ul className="mt-3 space-y-2.5">
            {d.topProducts.map((x) => (
              <li key={x.product.id} className="flex items-center gap-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{x.product.name}</span>
                <span className="text-2xs text-faint tnum">{num(x.qty)} dona</span>
                {can('finance.revenue.view') ? <span className="tnum font-medium">{money(x.rev, { compact: true })}</span> : <LockedValue scope="finance.revenue.view" compact />}
              </li>
            ))}
          </ul>
        </Card>
        {can('finance.counterparty.balances.view') ? (
          <Card>
            <p className="text-sm font-semibold">{t('dash.topCustomers')}</p>
            <ul className="mt-3 space-y-2.5">
              {d.topCustomers.map((x) => (
                <li key={x.customer.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate">{x.customer.name}</span>
                  <span className="tnum font-medium">{money(x.total, { compact: true })}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <RecentOps d={d} />
        )}
      </div>
      {d.activeProd.length > 0 && can('production.view') && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{t('dash.production')}</p>
            <Link to="/app/manufacturing/orders" className="text-xs text-muted hover:text-ink">
              {t('common.viewAll')}
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {d.activeProd.slice(0, 4).map((o) => (
              <ProdMini key={o.id} o={o} />
            ))}
          </div>
        </Card>
      )}
      <DashboardConfig open={cfg} onClose={() => setCfg(false)} />
    </>
  )
}

function ProdMini({ o }: { o: DashboardData['activeProd'][number] }) {
  const { tenant } = useSession()
  const t = useT()
  const p = tenant!.products.find((x) => x.id === o.productId)
  const prog = Math.round((o.producedQty / o.plannedQty) * 100)
  return (
    <div className="rounded-xl border p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="truncate font-medium">{p?.name}</span>
        <StatusBadge status={o.status} size="xs" label={t(`mfg.status.${o.status}` as DictKey)} />
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line/10">
        <div className="h-full rounded-full bg-gold" style={{ width: `${prog}%` }} />
      </div>
      <p className="mt-1 text-2xs text-faint tnum">
        {o.number} · {o.producedQty}/{o.plannedQty}
      </p>
    </div>
  )
}

/** Owner decides which metrics directors/managers see (spec §15). */
function DashboardConfig({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { tenant } = useSession()
  const hidden = useAppStore((s) => (tenant ? (s.dashboardHidden[tenant.company.tenantId] ?? {}) : {}))
  const setHidden = useAppStore((s) => s.setDashboardHidden)
  const metrics: { key: DashboardMetric; label: string; scope: DataScope }[] = [
    { key: 'revenue', label: t('dash.revenue'), scope: 'finance.revenue.view' },
    { key: 'profit', label: t('dash.profit'), scope: 'finance.profit.view' },
    { key: 'cash', label: t('dash.cash'), scope: 'finance.cash.view' },
    { key: 'receivables', label: t('dash.receivables'), scope: 'finance.counterparty.balances.view' },
    { key: 'payables', label: t('dash.payables'), scope: 'finance.counterparty.balances.view' },
    { key: 'inventory', label: t('dash.inventoryValue'), scope: 'finance.cost.view' },
  ]
  const [sel, setSel] = useState<DashboardMetric>('profit')
  const m = metrics.find((x) => x.key === sel)!
  const eligible = useMemo(() => whoCanSee(m.scope).filter((r) => !['OWNER', 'ADMIN'].includes(r)), [m.scope])
  const hiddenRoles = hidden[sel] ?? []
  return (
    <Modal open={open} onClose={onClose} title={t('dash.customize')} subtitle={t('dash.customize.body')} size="lg">
      <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
        <ul className="space-y-1">
          {metrics.map((x) => (
            <li key={x.key}>
              <button onClick={() => setSel(x.key)} className={cx('flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm', sel === x.key ? 'bg-brand/12 text-brand' : 'hover:bg-line/6')}>
                {x.label}
                {(hidden[x.key]?.length ?? 0) > 0 && <EyeOff size={12} />}
              </button>
            </li>
          ))}
        </ul>
        <div className="rounded-2xl border p-4">
          <p className="text-sm font-semibold">{t('dash.visibleTo')}</p>
          <p className="mt-1 text-xs text-muted">Rol standart ruxsatiga ega bo‘lsa ham, siz bu kartani yashirishingiz mumkin. Egasi va Admin har doim ko‘radi.</p>
          <ul className="mt-3 space-y-2">
            {ROLE_ORDER.filter((r) => !['OWNER', 'ADMIN', 'CUSTOM'].includes(r)).map((r) => {
              const canByScope = eligible.includes(r)
              const on = canByScope && !hiddenRoles.includes(r)
              return (
                <li key={r} className="flex items-center justify-between text-sm">
                  <span className={cx(!canByScope && 'text-faint')}>
                    {t(`role.${r}` as DictKey)}
                    {!canByScope && <Lock size={10} className="ml-1.5 inline" />}
                  </span>
                  <Toggle size="sm" checked={on} disabled={!canByScope} onChange={(v) => setHidden(sel, v ? hiddenRoles.filter((x) => x !== r) : [...hiddenRoles, r])} />
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------- ACCOUNTANT */

function AccountantDashboard({ d }: { d: DashboardData }) {
  const t = useT()
  const { tenant, can } = useSession()
  const openPeriods = tenant!.periods.filter((p) => p.status !== 'CLOSED')
  const dueTax = tenant!.taxes.filter((x) => x.status !== 'PAID')
  return (
    <>
      <SectionHeader title={t('dash.accountant.title')} sub={t('dash.accountant.sub')} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('dash.acc.pending')} value={d.pendingPayments.length} sub={money(sum(d.pendingPayments, (p) => p.amount), { compact: true })} icon={<ClipboardCheck size={15} />} to="/app/payments" />
        <Kpi label={t('dash.acc.invoices')} value={d.openInvoices.length} sub={can('finance.counterparty.balances.view') ? money(d.ar.total, { compact: true }) : undefined} tone="sky" icon={<HandCoins size={15} />} to="/app/invoices" />
        <Kpi label={t('dash.acc.tax')} value={money(sum(dueTax, (x) => x.amount), { compact: true })} sub={`${dueTax.length} ta deklaratsiya`} scope="finance.tax.view" tone="warning" icon={<Landmark size={15} />} to="/app/accounting/taxes" />
        <Kpi label={t('dash.acc.closing')} value={openPeriods.length} sub={openPeriods.map((p) => p.label).join(', ')} tone="violet" icon={<ClipboardCheck size={15} />} to="/app/accounting/periods" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <p className="text-sm font-semibold">{t('acc.aging')} · {t('dash.receivables')}</p>
          {can('finance.counterparty.balances.view') ? (
            <BarChart height={200} className="mt-3" formatY={(v) => money(v, { compact: true, currency: '' })} data={d.ar.buckets.map((b) => ({ label: t(`acc.aging.${b.label === 'current' ? 'current' : b.label === 'd30' ? '30' : b.label === 'd60' ? '60' : b.label === 'd90' ? '90' : 'over'}` as DictKey), value: b.amount, color: b.label === 'current' ? 'brand' : b.label === 'over' ? 'danger' : 'warning' }))} />
          ) : (
            <LockedValue scope="finance.counterparty.balances.view" />
          )}
        </Card>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Kpi label={t('dash.cash')} value={money(d.bs.cash, { compact: true })} scope="finance.cash.view" tone="violet" />
            <Kpi label={t('dash.bank')} value={money(d.bs.bank, { compact: true })} scope="finance.bank.view" tone="sky" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Kpi label={t('dash.revenue')} value={money(d.plCur.revenue, { compact: true })} delta={d.revenueDelta} scope="finance.revenue.view" />
            <Kpi label={t('dash.profit')} value={money(d.plCur.netProfit, { compact: true })} delta={d.profitDelta} scope="finance.profit.view" tone="sky" />
          </div>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AlertsCard d={d} />
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-semibold">{t('nav.journal')}</p>
            <Link to="/app/accounting/journal" className="text-xs text-muted hover:text-ink">
              {t('common.viewAll')}
            </Link>
          </div>
          <ul className="divide-y">
            {[...tenant!.journal].slice(-6).reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{e.memo}</span>
                  <span className="text-2xs text-faint">
                    {e.number} · {e.source}
                  </span>
                </span>
                <span className="tnum text-muted">{money(e.totalDebit, { compact: true })}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/* --------------------------------------------------------- SALES */

function SalesDashboard({ d }: { d: DashboardData }) {
  const t = useT()
  const { principal, can, tenant } = useSession()
  const mine = principal?.dataScope === 'SELF'
  const todayTotal = sum(d.salesToday, (s) => s.total)
  const monthTotal = sum(d.salesMonth, (s) => s.total)
  const unpaid = d.salesMonth.filter((s) => s.paidAmount < s.total)
  const avg = d.salesMonth.length ? monthTotal / d.salesMonth.length : 0
  const teamByRep = !mine
    ? Object.entries(d.salesMonth.reduce<Record<string, number>>((a, s) => ((a[s.soldByMemberId] = (a[s.soldByMemberId] ?? 0) + s.total), a), {}))
        .map(([id, v]) => ({ m: tenant!.members.find((x) => x.id === id), v }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 5)
    : []
  return (
    <>
      <SectionHeader
        title={t('dash.sales.title')}
        sub={t('dash.sales.sub')}
        actions={
          can('sales.create') && (
            <Link to="/app/sales/new">
              <Button icon={<ShoppingCart size={16} />}>{t('sales.new')}</Button>
            </Link>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={mine ? t('dash.sales.my') : t('dash.salesToday')} value={money(todayTotal, { compact: true })} sub={`${d.salesToday.length} ta savdo`} icon={<ShoppingCart size={15} />} to="/app/sales" />
        <Kpi label={t('dash.salesMonth')} value={money(monthTotal, { compact: true })} delta={d.salesDelta} tone="sky" spark={d.series.map((s) => s.revenue)} />
        <Kpi label={t('dash.avgCheck')} value={money(avg, { compact: true })} sub={`${d.salesMonth.length} ta savdo`} tone="violet" />
        <Kpi label={t('sales.unpaid')} value={unpaid.length} sub={money(sum(unpaid, (s) => s.total - s.paidAmount), { compact: true })} tone="warning" icon={<HandCoins size={15} />} to="/app/invoices" />
      </div>
      {/* Deliberately NO company revenue/profit/cash cards here — a sales workspace shows only what a seller needs. */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <RecentOps d={d} mineOnly={mine} />
        <div className="grid gap-4">
          <Card>
            <p className="text-sm font-semibold">{t('dash.topProducts')}</p>
            <ul className="mt-3 space-y-2.5">
              {d.topProducts.map((x) => {
                const st = tenant!.stock.filter((s) => s.productId === x.product.id)
                const avail = sum(st, (s) => s.onHand - s.reserved)
                return (
                  <li key={x.product.id} className="flex items-center gap-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{x.product.name}</span>
                    <Badge tone={avail <= x.product.reorderLevel ? 'warning' : 'success'} size="xs">
                      {num(avail)} {t('sales.stock.available').toLowerCase()}
                    </Badge>
                    <span className="tnum text-muted">{money(x.product.salePrice, { compact: true })}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
          {teamByRep.length > 0 && (
            <Card>
              <p className="text-sm font-semibold">{t('dash.sales.team')}</p>
              <ul className="mt-3 space-y-2">
                {teamByRep.map((r) => (
                  <li key={r.m?.id} className="flex items-center justify-between text-sm">
                    <span>{r.m?.fullName ?? '—'}</span>
                    <span className="tnum font-medium">{money(r.v, { compact: true })}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {mine && (
            <div className="rounded-2xl border border-dashed p-4 text-xs text-muted">
              <Lock size={12} className="mr-1.5 inline text-faint" />
              {t('access.scope.body')} — {t('dash.profit').toLowerCase()}, {t('dash.expenses').toLowerCase()}, {t('dash.bank').toLowerCase()}.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------ WAREHOUSE */

function WarehouseDashboard({ d }: { d: DashboardData }) {
  const t = useT()
  const { tenant, can, principal } = useSession()
  const whIds = principal?.dataScope === 'WAREHOUSE' ? new Set(principal.warehouseIds) : null
  const byWh = tenant!.warehouses
    .filter((w) => !whIds || whIds.has(w.id))
    .map((w) => ({ w, rows: d.stock.filter((s) => s.warehouseId === w.id), low: d.low.filter((s) => s.warehouseId === w.id).length }))
  return (
    <>
      <SectionHeader
        title={t('dash.warehouse.title')}
        sub={t('dash.warehouse.sub')}
        actions={
          <>
            {can('transfers.create') && (
              <Link to="/app/inventory/transfers">
                <Button variant="secondary" size="sm" icon={<Truck size={14} />}>
                  {t('inv2.transfer')}
                </Button>
              </Link>
            )}
            {can('stockcounts.create') && (
              <Link to="/app/inventory/counts">
                <Button size="sm" icon={<ClipboardCheck size={14} />}>
                  {t('inv2.count.new')}
                </Button>
              </Link>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('dash.warehouse.pending')} value={d.purchasesToReceive.length} sub={`${sum(d.purchasesToReceive, (p) => p.lines.length)} qator`} icon={<PackageCheck size={15} />} to="/app/purchasing" />
        <Kpi label={t('nav.transfers')} value={d.transfersInTransit.length} sub="yo‘lda" tone="sky" icon={<Truck size={15} />} to="/app/inventory/transfers" />
        <Kpi label={t('dash.warehouse.low')} value={d.low.length} sub={`${d.stock.length} pozitsiyadan`} tone="warning" icon={<AlertTriangle size={15} />} to="/app/inventory/stock" />
        <Kpi label={t('dash.warehouse.value')} value={money(d.stockValue, { compact: true })} scope="finance.cost.view" tone="success" icon={<Boxes size={15} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {byWh.map(({ w, rows, low }) => (
          <Card key={w.id}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{w.name}</p>
              <Badge tone="muted">{w.code}</Badge>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-line/5 p-2">
                <p className="text-lg font-semibold tnum">{rows.length}</p>
                <p className="text-2xs text-faint">SKU</p>
              </div>
              <div className="rounded-xl bg-line/5 p-2">
                <p className="text-lg font-semibold tnum">{num(sum(rows, (s) => s.reserved))}</p>
                <p className="text-2xs text-faint">{t('inv2.field.reserved')}</p>
              </div>
              <div className={cx('rounded-xl p-2', low ? 'bg-warning/10' : 'bg-line/5')}>
                <p className={cx('text-lg font-semibold tnum', low && 'text-warning')}>{low}</p>
                <p className="text-2xs text-faint">{t('inv2.lowStock')}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-semibold">{t('dash.warehouse.low')}</p>
            <Link to="/app/inventory/stock" className="text-xs text-muted hover:text-ink">
              {t('common.viewAll')}
            </Link>
          </div>
          <ul className="divide-y">
            {d.low.slice(0, 6).map((s) => {
              const p = tenant!.products.find((x) => x.id === s.productId)!
              const w = tenant!.warehouses.find((x) => x.id === s.warehouseId)
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="text-2xs text-faint">
                      {p.sku} · {w?.code}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={cx('block tnum font-medium', s.onHand - s.reserved <= 0 ? 'text-danger' : 'text-warning')}>{num(s.onHand - s.reserved)}</span>
                    <span className="text-2xs text-faint">min {p.reorderLevel}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
        <AlertsCard d={d} />
      </div>
    </>
  )
}

/* ----------------------------------------------------- PRODUCTION */

function ProductionDashboard({ d }: { d: DashboardData }) {
  const t = useT()
  const { tenant, can, member } = useSession()
  const worker = member?.role === 'FACTORY_WORKER'
  const myWos = worker ? tenant!.workOrders.filter((w) => w.workerMemberId === member!.id && w.status !== 'DONE') : []
  const total = tenant!.productionOrders.filter((o) => o.status === 'IN_PROGRESS' || o.status === 'QC' || o.status === 'RELEASED')
  const plan = sum(total, (o) => o.plannedQty)
  const made = sum(total, (o) => o.producedQty)
  return (
    <>
      <SectionHeader
        title={t('dash.production.title')}
        sub={t('dash.production.sub')}
        actions={
          can('production.create') && (
            <Link to="/app/manufacturing/orders?new=1">
              <Button icon={<Factory size={16} />}>{t('mfg.newOrder')}</Button>
            </Link>
          )
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('dash.production.active')} value={d.activeProd.length} sub={`${d.activeProd.filter((o) => o.status === 'QC').length} QC da`} icon={<Factory size={15} />} to="/app/manufacturing/orders" />
        <Kpi label={t('dash.production.plan')} value={pct(plan ? (made / plan) * 100 : 0, 0)} sub={`${made}/${plan} dona`} tone="gold" />
        <Kpi label={t('dash.production.oee')} value={pct(tenant!.machines.length ? (d.machinesRunning / tenant!.machines.length) * 100 : 0, 0)} sub={`${d.machinesRunning}/${tenant!.machines.length} ${t('mfg.machine.RUNNING').toLowerCase()}`} tone="sky" icon={<Wrench size={15} />} to="/app/manufacturing/machines" />
        <Kpi label={t('dash.production.scrap')} value={pct(d.scrapPct)} sub={t('common.last30')} tone={d.scrapPct > 3 ? 'danger' : 'success'} />
      </div>
      {worker && (
        <Card>
          <p className="text-sm font-semibold">Mening ish buyurtmalarim</p>
          {myWos.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Sizga biriktirilgan faol ish buyurtmasi yo‘q.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {myWos.map((w) => {
                const o = tenant!.productionOrders.find((x) => x.id === w.productionOrderId)
                return (
                  <li key={w.id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
                    <span>
                      {w.number} · {o?.number}
                    </span>
                    <StatusBadge status={w.status} size="xs" />
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card padded={false}>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-sm font-semibold">{t('mfg.orders')}</p>
            <Link to="/app/manufacturing/orders" className="text-xs text-muted hover:text-ink">
              {t('common.viewAll')}
            </Link>
          </div>
          <ul className="divide-y">
            {d.activeProd.slice(0, 6).map((o) => {
              const p = tenant!.products.find((x) => x.id === o.productId)
              const prog = Math.round((o.producedQty / o.plannedQty) * 100)
              return (
                <li key={o.id} className="px-5 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {o.number} · {p?.name}
                    </span>
                    <StatusBadge status={o.status} size="xs" label={t(`mfg.status.${o.status}` as DictKey)} />
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/10">
                      <div className="h-full rounded-full bg-gold" style={{ width: `${prog}%` }} />
                    </div>
                    <span className="text-2xs text-faint tnum">
                      {o.producedQty}/{o.plannedQty}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <div className="grid gap-4">
          <Card>
            <p className="text-sm font-semibold">{t('mfg.machines')}</p>
            <ul className="mt-3 space-y-2">
              {tenant!.machines.map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{m.name}</span>
                  <StatusBadge status={m.state} size="xs" label={t(`mfg.machine.${m.state}` as DictKey)} />
                </li>
              ))}
            </ul>
          </Card>
          <AlertsCard d={d} />
        </div>
      </div>
    </>
  )
}

/* ------------------------------------------------------------- HR */

function HrDashboard({ d }: { d: DashboardData }) {
  const t = useT()
  const { tenant } = useSession()
  const present = d.attendanceToday.filter((a) => a.state === 'PRESENT' || a.state === 'LATE').length
  const leave = d.attendanceToday.filter((a) => a.state === 'LEAVE' || a.state === 'SICK').length
  const byDept = tenant!.departments.map((dp) => ({ label: dp.name, value: tenant!.employees.filter((e) => e.departmentId === dp.id).length }))
  return (
    <>
      <SectionHeader
        title={t('dash.hr.title')}
        sub={t('dash.hr.sub')}
        actions={
          <Link to="/app/hr/employees?new=1">
            <Button icon={<Users size={16} />}>{t('hr.newEmployee')}</Button>
          </Link>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label={t('hr.employees')} value={tenant!.employees.filter((e) => e.status === 'ACTIVE').length} sub={`${tenant!.departments.length} bo‘lim`} icon={<Users size={15} />} to="/app/hr/employees" />
        <Kpi label={t('dash.hr.present')} value={present} sub={`${leave} ${t('dash.hr.leave').toLowerCase()}`} tone="success" to="/app/hr/attendance" />
        <Kpi label={t('dash.hr.pending')} value={d.pendingLeaves.length} tone="warning" icon={<ClipboardCheck size={15} />} to="/app/hr/leave" />
        <Kpi label={t('dash.hr.payroll')} value={d.payrollLast ? money(d.payrollLast.grossTotal, { compact: true }) : '—'} sub={d.payrollLast ? `${d.payrollLast.periodLabel} · ${t(`sub.${d.payrollLast.status === 'PAID' ? 'ACTIVE' : 'TRIAL'}` as DictKey) && d.payrollLast.status}` : undefined} scope="finance.payroll.view" tone="violet" icon={<Wallet size={15} />} to="/app/hr/payroll" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <p className="text-sm font-semibold">{t('hr.departments')}</p>
          <BarChart height={200} className="mt-3" data={byDept} color="violet" formatY={(v) => String(Math.round(v))} />
        </Card>
        <AlertsCard d={d} />
      </div>
    </>
  )
}
