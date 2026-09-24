import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Layers, Plus, Wrench } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Badge, Button, Card, Drawer, Field, Input, Modal, Progress, SectionHeader, Select, StatusBadge, Tabs } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner, Scoped } from '@/ui/gates'
import { cx, fmtDate, isoDate, money, num, pct, sum } from '@/core/utils/format'
import type { ProductionOrder } from '@/core/domain/entities'
import { MACHINE_STATES } from '@/core/domain/enums'
import type { DictKey } from '@/core/i18n/uz'
import { Gauge } from '@/ui/charts'

export default function ManufacturingPages() {
  return (
    <PlanGate feature="manufacturing">
      <Routes>
        <Route index element={<Navigate to="orders" replace />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="bom" element={<BomPage />} />
        <Route path="machines" element={<MachinesPage />} />
        <Route path="quality" element={<QualityPage />} />
      </Routes>
    </PlanGate>
  )
}

function SubNav() {
  const t = useT()
  const nav = useNavigate()
  const { can } = useSession()
  const path = window.location.pathname.split('/').pop() as string
  const tabs = [can('production.view') && { value: 'orders', label: t('mfg.orders') }, can('bom.view') && { value: 'bom', label: t('mfg.bom') }, can('machines.view') && { value: 'machines', label: t('mfg.machines') }, can('quality.view') && { value: 'quality', label: t('mfg.quality') }].filter(Boolean) as { value: string; label: string }[]
  return <Tabs value={path} onChange={(v) => nav(`/app/manufacturing/${v}`)} tabs={tabs} />
}

const NEXT: Record<string, DictKey> = { PLANNED: 'mfg.release', RELEASED: 'mfg.consume', IN_PROGRESS: 'mfg.finish', QC: 'mfg.output', COMPLETED: 'acc.period.close' }

function OrdersPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const [sp] = useSearchParams()
  const { tenant, can } = useSession()
  const advance = useAppStore((s) => s.advanceProductionOrder)
  const run = useAction()
  const [sel, setSel] = useState<ProductionOrder | null>(null)
  const [open, setOpen] = useState(sp.get('new') === '1')
  const [status, setStatus] = useState('ACTIVE')
  if (!tenant || !can('production.view')) return <AccessDenied perm="production.view" />
  const rows = tenant.productionOrders.filter((o) => (status === 'ACTIVE' ? !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(o.status) : status === 'ALL' ? true : o.status === status))
  const prod = (id: string) => tenant.products.find((p) => p.id === id)?.name ?? '—'
  const cols: Column<ProductionOrder>[] = [
    { key: 'n', header: '№', cell: (o) => <span className="font-mono text-xs">{o.number}</span>, sortValue: (o) => o.number },
    { key: 'p', header: t('sales.field.product'), cell: (o) => <span className="font-medium">{prod(o.productId)}</span>, sortValue: (o) => prod(o.productId) },
    { key: 'q', header: t('mfg.progress'), cell: (o) => <div className="min-w-[120px]"><div className="flex justify-between text-2xs text-muted"><span className="tnum">{o.producedQty}/{o.plannedQty}</span><span className="tnum">{pct((o.producedQty / o.plannedQty) * 100, 0)}</span></div><Progress value={(o.producedQty / o.plannedQty) * 100} tone="gold" className="mt-1" /></div> },
    { key: 'dates', header: t('common.date'), cell: (o) => <span className="text-muted">{fmtDate(o.plannedStart, lang)} → {fmtDate(o.plannedEnd, lang)}</span>, sortValue: (o) => o.plannedStart, hideBelow: 'md' },
    { key: 'cost', header: t('mfg.cost'), cell: (o) => <Scoped scope="finance.cost.view" compact><span className="tnum">{money(sum(o.costs, (c) => c.actual || c.planned), { compact: true })}</span></Scoped>, align: 'right', hideBelow: 'lg' },
    { key: 's', header: t('common.status'), cell: (o) => <StatusBadge status={o.status} label={t(`mfg.status.${o.status}` as DictKey)} />, align: 'right' },
    { key: 'a', header: '', align: 'right', cell: (o) => NEXT[o.status] && can('production.edit') ? <Button size="xs" variant={o.status === 'QC' ? 'primary' : 'secondary'} iconRight={<ArrowRight size={12} />} onClick={(e) => { e.stopPropagation(); run(() => advance(o.id), { title: t('common.saved') }) }}>{t(NEXT[o.status])}</Button> : null },
  ]
  const active = tenant.productionOrders.filter((o) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(o.status))
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('mfg.title')} sub={t('mfg.sub')} actions={<Can perm="production.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t('mfg.newOrder')}</Button></Can>} />
      <SubNav />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('dash.production.active')}</p><p className="mt-1 text-xl font-semibold tnum">{active.length}</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('mfg.planned')}</p><p className="mt-1 text-xl font-semibold tnum">{sum(active, (o) => o.plannedQty)} dona</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('mfg.produced')}</p><p className="mt-1 text-xl font-semibold tnum">{sum(active, (o) => o.producedQty)} dona</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('mfg.material.coverage')}</p><MaterialCoverage /></Card>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(o) => o.id} searchable={(o) => `${o.number} ${prod(o.productId)}`} onRowClick={setSel} initialSort={{ key: 'dates', dir: 'desc' }} emptyTitle={t('mfg.empty')}
        toolbar={<Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-44"><option value="ACTIVE">Faol</option><option value="ALL">{t('common.all')}</option>{['PLANNED', 'RELEASED', 'IN_PROGRESS', 'QC', 'COMPLETED', 'CLOSED'].map((s) => <option key={s} value={s}>{t(`mfg.status.${s}` as DictKey)}</option>)}</Select>} />
      <OrderDrawer o={sel} onClose={() => setSel(null)} />
      <NewOrderModal open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

function MaterialCoverage() {
  const t = useT()
  const { tenant } = useSession()
  if (!tenant) return null
  const active = tenant.productionOrders.filter((o) => ['RELEASED', 'IN_PROGRESS', 'PLANNED'].includes(o.status))
  const daily = new Map<string, number>()
  for (const o of active) {
    const b = tenant.boms.find((x) => x.id === o.bomId)
    if (!b) continue
    const days = Math.max(3, Math.round((new Date(o.plannedEnd).getTime() - new Date(o.plannedStart).getTime()) / 86_400_000))
    for (const l of b.lines) daily.set(l.productId, (daily.get(l.productId) ?? 0) + (l.qty * (1 + l.scrapPct / 100) * Math.max(0, o.plannedQty - o.producedQty)) / days)
  }
  const cov = tenant.products.filter((p) => p.type === 'RAW_MATERIAL').map((p) => { const on = sum(tenant.stock.filter((s) => s.productId === p.id), (s) => s.onHand); const u = daily.get(p.id) ?? 0; return { p, days: u > 0 ? on / u : Infinity } }).filter((x) => Number.isFinite(x.days)).sort((a, b) => a.days - b.days)
  const worst = cov[0]
  if (!worst) return <p className="mt-1 text-xl font-semibold">—</p>
  return <><p className={cx('mt-1 text-xl font-semibold tnum', worst.days < 10 && 'text-warning')}>{t('mfg.material.days', { days: Math.floor(worst.days) })}</p><p className="truncate text-xs text-muted">{worst.p.name}</p></>
}

function OrderDrawer({ o, onClose }: { o: ProductionOrder | null; onClose: () => void }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const advance = useAppStore((s) => s.advanceProductionOrder)
  const run = useAction()
  if (!o || !tenant) return null
  const b = tenant.boms.find((x) => x.id === o.bomId)
  const wos = tenant.workOrders.filter((w) => w.productionOrderId === o.id)
  const plan = sum(o.costs, (c) => c.planned)
  const act = sum(o.costs, (c) => c.actual)
  const qc = tenant.qualityChecks.find((q) => q.productionOrderId === o.id)
  const price = tenant.products.find((p) => p.id === o.productId)?.salePrice ?? 0
  const unitAct = act / Math.max(1, o.producedQty)
  return (
    <Drawer open={!!o} onClose={onClose} title={`${o.number} · ${tenant.products.find((p) => p.id === o.productId)?.name}`} width="max-w-2xl">
      <div className="space-y-5 text-sm">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={o.status} label={t(`mfg.status.${o.status}` as DictKey)} /><Badge tone="muted">{b?.name} {b?.version}</Badge><span className="ml-auto text-xs text-faint">{fmtDate(o.plannedStart, lang)} → {fmtDate(o.plannedEnd, lang)}</span></div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('mfg.planned')}</p><p className="text-lg font-semibold tnum">{o.plannedQty}</p></div>
          <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('mfg.produced')}</p><p className="text-lg font-semibold tnum">{o.producedQty}</p></div>
          <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('mfg.scrap')}</p><p className={cx('text-lg font-semibold tnum', o.scrapQty > 0 && 'text-warning')}>{o.scrapQty}</p></div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('mfg.workorders')}</p>
          <ol className="grid grid-cols-5 gap-1">{wos.map((w, i) => <li key={w.id} className={cx('rounded-lg border p-2 text-center text-2xs', w.status === 'DONE' ? 'border-success/30 bg-success/8' : w.status === 'RUNNING' ? 'border-warning/30 bg-warning/8' : 'opacity-60')}><p className="font-medium">{['Kesish', 'Kromkalash', 'Parmalash', 'Yig‘ish', 'QC'][i]}</p><p className="mt-0.5 tnum text-faint">{w.completedQty}/{w.plannedQty}</p></li>)}</ol>
        </div>
        <Scoped scope="finance.cost.view" fallback={<div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted">{t('access.scope.body')} — {t('mfg.cost')}</div>}>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('mfg.cost')}</p>
            <table className="w-full"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="py-2 text-left font-medium">Komponent</th><th className="py-2 text-right font-medium">{t('mfg.planned')}</th><th className="py-2 text-right font-medium">{t('mfg.actual')}</th><th className="py-2 text-right font-medium">{t('mfg.variance')}</th></tr></thead><tbody>{o.costs.map((c) => { const v = c.planned ? ((c.actual - c.planned) / c.planned) * 100 : 0; return <tr key={c.component} className="border-b last:border-0"><td className="py-2">{t(`mfg.cost.${c.component}` as DictKey)}</td><td className="py-2 text-right tnum text-muted">{money(c.planned, { compact: true })}</td><td className="py-2 text-right tnum">{c.actual ? money(c.actual, { compact: true }) : '—'}</td><td className={cx('py-2 text-right tnum', c.actual && v > 3 ? 'text-danger' : c.actual && v < -3 ? 'text-success' : 'text-faint')}>{c.actual ? pct(v, 1, true) : '—'}</td></tr> })}</tbody><tfoot><tr className="font-semibold"><td className="py-2">{t('mfg.cost.total')}</td><td className="py-2 text-right tnum">{money(plan, { compact: true })}</td><td className="py-2 text-right tnum">{act ? money(act, { compact: true }) : '—'}</td><td className={cx('py-2 text-right tnum', act && (act - plan) / plan > 0.03 ? 'text-danger' : '')}>{act ? pct(((act - plan) / plan) * 100, 1, true) : '—'}</td></tr></tfoot></table>
            {o.producedQty > 0 && act > 0 && <div className="mt-3 grid grid-cols-3 gap-3"><div className="rounded-xl bg-line/5 p-3"><p className="text-2xs text-faint">{t('mfg.cost.perUnit')}</p><p className="font-semibold tnum">{money(unitAct, { compact: true })}</p></div><div className="rounded-xl bg-line/5 p-3"><p className="text-2xs text-faint">{t('inv2.field.salePrice')}</p><p className="font-semibold tnum">{money(price, { compact: true })}</p></div><div className="rounded-xl bg-brand/8 p-3"><p className="text-2xs text-faint">{t('sales.margin')}</p><p className="font-semibold tnum text-brand">{pct(price ? ((price / 1.12 - unitAct) / (price / 1.12)) * 100 : 0)}</p></div></div>}
          </div>
        </Scoped>
        {qc && <div className="flex items-center justify-between rounded-xl border p-3"><span>{t('mfg.quality')}: {qc.passQty} ✓ / {qc.failQty} ✗</span><StatusBadge status={qc.result} label={t(`mfg.qc.${qc.result}` as DictKey)} /></div>}
        {NEXT[o.status] && can('production.edit') && <Button block icon={<ArrowRight size={16} />} onClick={() => run(() => advance(o.id), { title: t('common.saved') })}>{t(NEXT[o.status])}</Button>}
      </div>
    </Drawer>
  )
}

function NewOrderModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { tenant } = useSession()
  const create = useAppStore((s) => s.createProductionOrder)
  const run = useAction()
  const [bomId, setBomId] = useState('')
  const [qty, setQty] = useState(30)
  const [start, setStart] = useState(isoDate())
  const [end, setEnd] = useState(isoDate(new Date(Date.now() + 5 * 86_400_000)))
  if (!tenant) return null
  const b = tenant.boms.find((x) => x.id === bomId)
  const shortages = b ? b.lines.map((l) => { const need = l.qty * (1 + l.scrapPct / 100) * qty; const on = sum(tenant.stock.filter((s) => s.productId === l.productId), (s) => s.onHand); return { p: tenant.products.find((x) => x.id === l.productId)!, need, on } }).filter((x) => x.on < x.need) : []
  return (
    <Modal open={open} onClose={onClose} title={t('mfg.newOrder')} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!bomId || qty <= 0} onClick={() => { const r = run(() => create({ bomId, plannedQty: qty, plannedStart: `${start}T08:00:00.000Z`, plannedEnd: `${end}T18:00:00.000Z` }), { title: t('common.saved') }); if (r) onClose() }}>{t('common.create')}</Button></>}>
      <div className="space-y-3">
        <Field label={t('mfg.bom')} required><Select value={bomId} onChange={(e) => setBomId(e.target.value)}><option value="">—</option>{tenant.boms.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.version}</option>)}</Select></Field>
        <div className="grid grid-cols-3 gap-3"><Field label={t('common.qty')}><Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field><Field label="Boshlanish"><Input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field><Field label="Tugash"><Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></Field></div>
        {b && <div className="rounded-xl border p-3 text-xs"><p className="font-medium">{t('mfg.cost.standard')}: <Scoped scope="finance.cost.view" compact><span className="tnum">{money(b.standardCost)} × {qty} = {money(b.standardCost * qty, { compact: true })}</span></Scoped></p>{shortages.length > 0 && <p className="mt-2 text-warning">{t('mfg.material.short')}: {shortages.map((s) => `${s.p.name} (${num(s.on)} / ${num(s.need, 1)})`).join(', ')}</p>}</div>}
      </div>
    </Modal>
  )
}

/* ------------------------------------------------------------------- BOM */

function BomPage() {
  const t = useT()
  const { tenant, can } = useSession()
  if (!tenant || !can('bom.view')) return <AccessDenied perm="bom.view" />
  return (
    <div className="space-y-6">
      <SectionHeader title={t('mfg.bom')} sub="Har bir tayyor mahsulot uchun material, ish haqi, energiya va uskuna normasi." />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-2">
        {tenant.boms.map((b) => {
          const p = tenant.products.find((x) => x.id === b.productId)
          const mat = sum(b.lines, (l) => l.qty * (1 + l.scrapPct / 100) * (tenant.products.find((x) => x.id === l.productId)?.purchasePrice ?? 0))
          const labor = (b.laborMinutes / 60) * b.laborRatePerHour
          const energy = b.energyKwh * b.energyRatePerKwh
          const machine = b.machineHours * b.machineRatePerHour
          const oh = (mat + labor) * (b.overheadRate / 100)
          return (
            <Card key={b.id}>
              <div className="flex items-start justify-between"><div><h3 className="font-semibold">{b.name}</h3><p className="text-xs text-muted">{p?.sku} · {b.version} · {b.outputQty} dona</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/14 text-gold"><Layers size={18} /></span></div>
              <table className="mt-4 w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="py-1.5 text-left font-medium">Material</th><th className="py-1.5 text-right font-medium">Norma</th><th className="py-1.5 text-right font-medium">Chiqindi</th><th className="py-1.5 text-right font-medium">{t('mfg.cost')}</th></tr></thead><tbody>{b.lines.map((l) => { const m = tenant.products.find((x) => x.id === l.productId)!; return <tr key={l.productId} className="border-b last:border-0"><td className="py-1.5">{m.name}</td><td className="py-1.5 text-right tnum">{l.qty} {tenant.units.find((u) => u.id === m.unitId)?.symbol}</td><td className="py-1.5 text-right tnum text-muted">{l.scrapPct}%</td><td className="py-1.5 text-right tnum"><Scoped scope="finance.cost.view" compact>{money(l.qty * (1 + l.scrapPct / 100) * m.purchasePrice, { compact: true })}</Scoped></td></tr> })}</tbody></table>
              <Scoped scope="finance.cost.view" fallback={<p className="mt-3 text-xs text-faint">{t('access.scope.body')}</p>}>
                <div className="mt-4 grid grid-cols-5 gap-1 text-center text-2xs">
                  {[['MATERIAL', mat], ['LABOR', labor], ['ENERGY', energy], ['MACHINE', machine], ['OVERHEAD', oh]].map(([k, v]) => <div key={k as string} className="rounded-lg bg-line/5 p-2"><p className="text-faint">{t(`mfg.cost.${k}` as DictKey)}</p><p className="font-medium tnum">{money(v as number, { compact: true, currency: '' })}</p></div>)}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl bg-brand/8 px-4 py-2.5"><span className="text-sm font-medium">{t('mfg.cost.standard')}</span><span className="font-semibold tnum text-brand">{money(b.standardCost)}</span></div>
                <p className="mt-2 text-2xs text-faint">{t('inv2.field.salePrice')} {money(p?.salePrice ?? 0)} · {t('sales.margin')} {pct(p?.salePrice ? ((p.salePrice / 1.12 - b.standardCost) / (p.salePrice / 1.12)) * 100 : 0)}</p>
              </Scoped>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Machines */

function MachinesPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const setState = useAppStore((s) => s.setMachineState)
  const run = useAction()
  if (!tenant || !can('machines.view')) return <AccessDenied perm="machines.view" />
  const running = tenant.machines.filter((m) => m.state === 'RUNNING').length
  return (
    <div className="space-y-6">
      <SectionHeader title={t('mfg.machines')} sub={`${running}/${tenant.machines.length} ${t('mfg.machine.RUNNING').toLowerCase()}`} />
      <SubNav />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tenant.machines.map((m) => {
          const overdue = m.nextMaintenanceAt < new Date().toISOString()
          const wos = tenant.workOrders.filter((w) => w.machineId === m.id && w.status === 'RUNNING')
          return (
            <Card key={m.id} className={cx(overdue && 'border-warning/40')}>
              <div className="flex items-start justify-between"><div><h3 className="font-semibold">{m.name}</h3><p className="text-xs text-muted">{m.code} · {m.model}</p></div><StatusBadge status={m.state} label={t(`mfg.machine.${m.state}` as DictKey)} /></div>
              <div className="mt-4 flex items-center gap-4"><Gauge value={m.state === 'RUNNING' ? 72 + (m.totalRuntimeHours % 20) : m.state === 'IDLE' ? 0 : 0} label={t('mfg.machine.load')} size={100} color={m.state === 'RUNNING' ? 'brand' : 'muted'} /><div className="flex-1 space-y-1 text-xs"><div className="flex justify-between"><span className="text-muted">Quvvat</span><span className="tnum">{m.capacityPerHour}/soat</span></div><div className="flex justify-between"><span className="text-muted">Ish vaqti</span><span className="tnum">{num(m.totalRuntimeHours)} soat</span></div><div className="flex justify-between"><span className="text-muted">Soatlik narx</span><Scoped scope="finance.cost.view" compact><span className="tnum">{money(m.hourlyCost, { compact: true })}</span></Scoped></div><div className="flex justify-between"><span className="text-muted">{t('mfg.machine.nextService')}</span><span className={cx('tnum', overdue && 'text-warning font-medium')}>{fmtDate(m.nextMaintenanceAt, lang)}</span></div></div></div>
              {wos.length > 0 && <p className="mt-3 text-2xs text-faint">Faol: {wos.map((w) => w.number).join(', ')}</p>}
              {can('machines.edit') && <div className="mt-4 flex flex-wrap gap-1.5">{MACHINE_STATES.filter((s) => s !== m.state).map((s) => <Button key={s} size="xs" variant="secondary" icon={s === 'MAINTENANCE' ? <Wrench size={11} /> : undefined} onClick={() => run(() => setState(m.id, s), { title: t('common.saved') })}>{t(`mfg.machine.${s}` as DictKey)}</Button>)}</div>}
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Quality */

function QualityPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  if (!tenant || !can('quality.view')) return <AccessDenied perm="quality.view" />
  const rows = [...tenant.qualityChecks].sort((a, b) => b.checkedAt.localeCompare(a.checkedAt))
  const checked = sum(rows, (q) => q.checkedQty)
  const fail = sum(rows, (q) => q.failQty)
  return (
    <div className="space-y-6">
      <SectionHeader title={t('mfg.quality')} sub="Har bir yakunlangan buyurtma sifat nazoratidan o‘tadi." />
      <SubNav />
      <div className="grid grid-cols-3 gap-4">
        <Card><p className="text-2xs uppercase tracking-wider text-faint">Tekshirilgan</p><p className="mt-1 text-xl font-semibold tnum">{checked}</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('mfg.scrap')}</p><p className={cx('mt-1 text-xl font-semibold tnum', fail && 'text-warning')}>{fail} · {pct(checked ? (fail / checked) * 100 : 0)}</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('mfg.qc.PASS')}</p><p className="mt-1 text-xl font-semibold tnum text-success">{pct(checked ? ((checked - fail) / checked) * 100 : 0)}</p></Card>
      </div>
      <Card padded={false}><table className="w-full text-sm"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="px-5 py-2 text-left font-medium">Buyurtma</th><th className="px-5 py-2 text-left font-medium">{t('common.date')}</th><th className="px-5 py-2 text-right font-medium">Tekshirildi</th><th className="px-5 py-2 text-right font-medium">✓</th><th className="px-5 py-2 text-right font-medium">✗</th><th className="px-5 py-2 text-left font-medium">Izoh</th><th className="px-5 py-2 text-right font-medium">Natija</th></tr></thead><tbody>{rows.slice(0, 30).map((q) => { const o = tenant.productionOrders.find((x) => x.id === q.productionOrderId); return <tr key={q.id} className="border-b last:border-0"><td className="px-5 py-2"><span className="font-mono text-xs text-muted">{o?.number}</span> {tenant.products.find((p) => p.id === o?.productId)?.name}</td><td className="px-5 py-2 text-muted">{fmtDate(q.checkedAt, lang)}</td><td className="px-5 py-2 text-right tnum">{q.checkedQty}</td><td className="px-5 py-2 text-right tnum text-success">{q.passQty}</td><td className={cx('px-5 py-2 text-right tnum', q.failQty && 'text-danger')}>{q.failQty}</td><td className="px-5 py-2 text-xs text-muted">{q.note || '—'}</td><td className="px-5 py-2 text-right"><StatusBadge status={q.result} label={t(`mfg.qc.${q.result}` as DictKey)} /></td></tr> })}</tbody></table></Card>
    </div>
  )
}

