import { useState } from 'react'
import { Check, PackageCheck, Plus } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Badge, Button, Card, Drawer, Field, Input, Modal, SectionHeader, Select, StatusBadge, Tabs } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner, Scoped } from '@/ui/gates'
import { cx, fmtDate, money, num, sum } from '@/core/utils/format'
import type { Purchase } from '@/core/domain/entities'
import type { DictKey } from '@/core/i18n/uz'

export default function PurchasingPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const approve = useAppStore((s) => s.approvePurchase)
  const receive = useAppStore((s) => s.receivePurchase)
  const run = useAction()
  const [tab, setTab] = useState<'ALL' | 'REQUEST' | 'ORDERED' | 'BILLED'>('ALL')
  const [sel, setSel] = useState<Purchase | null>(null)
  const [open, setOpen] = useState(false)
  if (!tenant || !can('purchasing.view')) return <AccessDenied perm="purchasing.view" />
  const sup = (id: string) => tenant.counterparties.find((c) => c.id === id)?.name ?? '—'
  const rows = tenant.purchases.filter((p) => (tab === 'ALL' ? true : tab === 'BILLED' ? ['BILLED', 'PAID', 'RECEIVED'].includes(p.status) : p.status === tab))
  const cols: Column<Purchase>[] = [
    { key: 'n', header: '№', cell: (p) => <span className="font-mono text-xs">{p.number}</span>, sortValue: (p) => p.number },
    { key: 's', header: t('nav.suppliers'), cell: (p) => sup(p.supplierId), sortValue: (p) => sup(p.supplierId) },
    { key: 'd', header: t('common.date'), cell: (p) => <span className="text-muted">{fmtDate(p.createdAt, lang)}</span>, sortValue: (p) => p.createdAt, hideBelow: 'sm' },
    { key: 'lines', header: t('common.qty'), cell: (p) => <span className="text-muted">{p.lines.length} qator · {num(sum(p.lines, (l) => l.qty))}</span>, hideBelow: 'md' },
    { key: 'total', header: t('common.total'), cell: (p) => <Scoped scope="finance.cost.view" compact><span className="tnum font-medium">{money(p.total)}</span></Scoped>, sortValue: (p) => p.total, align: 'right' },
    { key: 'st', header: t('common.status'), cell: (p) => <StatusBadge status={p.status} label={t(`pur.status.${p.status}` as DictKey)} />, align: 'right' },
    { key: 'a', header: '', align: 'right', cell: (p) => (
      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
        {p.status === 'REQUEST' && can('purchasing.approve') && <Button size="xs" onClick={() => run(() => approve(p.id), { title: t('pur.approve') })}>{t('pur.approve')}</Button>}
        {p.status === 'ORDERED' && can('stock.create') && <Button size="xs" variant="secondary" icon={<PackageCheck size={12} />} onClick={() => run(() => receive(p.id), { title: t('pur.receive') })}>{t('pur.receive')}</Button>}
      </span>
    ) },
  ]
  const counts = { REQUEST: tenant.purchases.filter((p) => p.status === 'REQUEST').length, ORDERED: tenant.purchases.filter((p) => p.status === 'ORDERED').length }
  return (
    <PlanGate feature="purchasing.basic">
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={t('pur.title')} sub={t('pur.sub')} actions={<Can perm="purchasing.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>{t('pur.newOrder')}</Button></Can>} />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('pur.requests')}</p><p className={cx('mt-1 text-xl font-semibold tnum', counts.REQUEST && 'text-warning')}>{counts.REQUEST}</p></Card>
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('pur.receive')}</p><p className="mt-1 text-xl font-semibold tnum">{counts.ORDERED}</p></Card>
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('common.thisMonth')}</p><Scoped scope="finance.cost.view" compact><p className="mt-1 text-xl font-semibold tnum">{money(sum(tenant.purchases.filter((p) => p.createdAt.slice(0, 7) === new Date().toISOString().slice(0, 7)), (p) => p.total), { compact: true })}</p></Scoped></Card>
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('pur.supplierBalance')}</p><Scoped scope="finance.counterparty.balances.view" compact><p className="mt-1 text-xl font-semibold tnum text-warning">{money(sum(tenant.invoices.filter((i) => i.direction === 'IN'), (i) => i.total - i.paidAmount), { compact: true })}</p></Scoped></Card>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ALL', label: t('common.all') }, { value: 'REQUEST', label: t('pur.requests'), count: counts.REQUEST }, { value: 'ORDERED', label: t('pur.status.ORDERED'), count: counts.ORDERED }, { value: 'BILLED', label: t('pur.status.RECEIVED') }]} />
        <DataTable rows={rows} columns={cols} rowKey={(p) => p.id} searchable={(p) => `${p.number} ${sup(p.supplierId)}`} onRowClick={setSel} initialSort={{ key: 'd', dir: 'desc' }} emptyTitle={t('pur.empty')} />
        <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.number}>
          {sel && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap items-center gap-2"><StatusBadge status={sel.status} label={t(`pur.status.${sel.status}` as DictKey)} /><Badge tone="muted">{tenant.warehouses.find((w) => w.id === sel.warehouseId)?.name}</Badge></div>
              <div className="grid grid-cols-2 gap-3"><div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('nav.suppliers')}</p><p className="font-medium">{sup(sel.supplierId)}</p></div><div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('sales.by')}</p><p className="font-medium">{tenant.members.find((m) => m.id === sel.requestedByMemberId)?.fullName ?? '—'}</p></div></div>
              <table className="w-full"><thead className="text-2xs uppercase text-faint"><tr className="border-b"><th className="py-2 text-left font-medium">{t('sales.field.product')}</th><th className="py-2 text-right font-medium">{t('common.qty')}</th><th className="py-2 text-right font-medium">{t('common.price')}</th></tr></thead><tbody>{sel.lines.map((l) => <tr key={l.id} className="border-b last:border-0"><td className="py-2">{tenant.products.find((p) => p.id === l.productId)?.name}</td><td className="py-2 text-right tnum">{num(l.receivedQty)}/{num(l.qty)}</td><td className="py-2 text-right tnum"><Scoped scope="finance.cost.view" compact>{money(l.unitPrice, { currency: '' })}</Scoped></td></tr>)}</tbody></table>
              <Scoped scope="finance.cost.view"><div className="space-y-1 rounded-xl border p-3"><div className="flex justify-between text-muted"><span>{t('common.subtotal')}</span><span className="tnum">{money(sel.subtotal)}</span></div><div className="flex justify-between text-muted"><span>{t('sales.field.vat')}</span><span className="tnum">{money(sel.vatAmount)}</span></div><div className="flex justify-between font-semibold"><span>{t('common.total')}</span><span className="tnum">{money(sel.total)}</span></div><div className="flex justify-between text-muted"><span>{t('sales.paid')}</span><span className="tnum">{money(sel.paidAmount)}</span></div></div></Scoped>
              <ul className="space-y-1.5">
                {[['REQUEST', t('pur.status.REQUEST')], ['ORDERED', t('pur.status.ORDERED')], ['BILLED', t('pur.status.RECEIVED')], ['PAID', t('pur.status.PAID')]].map(([k, label], i) => { const order = ['REQUEST', 'APPROVED', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'BILLED', 'PAID']; const done = order.indexOf(sel.status) >= order.indexOf(k as string); return <li key={k} className="flex items-center gap-3"><span className={cx('grid h-5 w-5 place-items-center rounded-full text-[10px]', done ? 'bg-brand text-brand-ink' : 'bg-line/10 text-faint')}>{done ? <Check size={11} /> : i + 1}</span><span className={done ? '' : 'text-faint'}>{label}</span></li> })}
              </ul>
            </div>
          )}
        </Drawer>
        <NewPurchaseModal open={open} onClose={() => setOpen(false)} />
      </div>
    </PlanGate>
  )
}

function NewPurchaseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { tenant, can } = useSession()
  const create = useAppStore((s) => s.createPurchase)
  const run = useAction()
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [lines, setLines] = useState<{ productId: string; qty: number; unitPrice: number }[]>([{ productId: '', qty: 10, unitPrice: 0 }])
  if (!tenant) return null
  const total = sum(lines, (l) => l.qty * l.unitPrice)
  const ok = supplierId && lines.every((l) => l.productId && l.qty > 0 && l.unitPrice > 0)
  return (
    <Modal open={open} onClose={onClose} title={t('pur.newOrder')} subtitle={can('purchasing.approve') ? t('pur.status.ORDERED') : `${t('pur.status.REQUEST')} — tasdiqlash uchun yuboriladi`} size="lg" footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!ok} onClick={() => { const r = run(() => create({ supplierId, warehouseId: warehouseId || tenant.warehouses[0].id, lines }), { title: t('common.saved') }); if (r) { onClose(); setLines([{ productId: '', qty: 10, unitPrice: 0 }]) } }}>{t('common.create')}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('nav.suppliers')} required><Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}><option value="">—</option>{tenant.counterparties.filter((c) => c.type !== 'CUSTOMER').map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Field label={t('inv2.field.warehouse')}><Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{tenant.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_80px_120px_auto] items-end gap-2">
            <Field label={i === 0 ? t('sales.field.product') : undefined}><Select value={l.productId} onChange={(e) => { const p = tenant.products.find((x) => x.id === e.target.value); setLines(lines.map((x, k) => (k === i ? { ...x, productId: e.target.value, unitPrice: p?.purchasePrice || x.unitPrice } : x))) }}><option value="">—</option>{tenant.products.filter((p) => p.type !== 'SERVICE').map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
            <Field label={i === 0 ? t('common.qty') : undefined}><Input type="number" value={l.qty} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, qty: Number(e.target.value) } : x)))} /></Field>
            <Field label={i === 0 ? t('common.price') : undefined}><Input type="number" value={l.unitPrice} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, unitPrice: Number(e.target.value) } : x)))} /></Field>
            <Button variant="ghost" size="sm" onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : lines)}>×</Button>
          </div>
        ))}
        <div className="flex items-center justify-between"><Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setLines([...lines, { productId: '', qty: 10, unitPrice: 0 }])}>{t('common.add')}</Button><span className="text-sm">{t('common.total')} (QQSsiz): <b className="tnum">{money(total)}</b></span></div>
      </div>
    </Modal>
  )
}
