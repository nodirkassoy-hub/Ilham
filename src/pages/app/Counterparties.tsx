import { useState } from 'react'
import { Building2, Phone, Plus, UserRound } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Avatar, Badge, Button, Card, Drawer, Field, Input, Modal, SectionHeader, StatusBadge } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner, Scoped } from '@/ui/gates'
import { cx, fmtDate, money, sum } from '@/core/utils/format'
import type { Counterparty } from '@/core/domain/entities'
import type { DictKey } from '@/core/i18n/uz'

export default function CounterpartiesPage({ kind }: { kind: 'CUSTOMER' | 'SUPPLIER' }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can, principal } = useSession()
  const create = useAppStore((s) => s.createCounterparty)
  const run = useAction()
  const [sel, setSel] = useState<Counterparty | null>(null)
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', tin: '', contactName: '', phone: '+998 ', email: '', paymentTermDays: 14, creditLimit: 0, segment: kind === 'SUPPLIER' ? 'Ta‘minotchi' : 'O‘rta biznes' })
  const perm = kind === 'SUPPLIER' ? 'suppliers.view' : 'customers.view'
  if (!tenant || !can(perm)) return <AccessDenied perm={perm} />
  const rows = tenant.counterparties.filter((c) => (kind === 'SUPPLIER' ? c.type !== 'CUSTOMER' : c.type !== 'SUPPLIER') && (principal?.dataScope === 'SELF' ? c.ownerMemberId === principal.memberId || c.segment === 'Chakana' : true))
  const dir = kind === 'SUPPLIER' ? 'IN' : 'OUT'
  const openInv = (id: string) => tenant.invoices.filter((i) => i.counterpartyId === id && i.direction === dir && !['PAID', 'VOID'].includes(i.status))
  const overdueAmt = (id: string) => sum(openInv(id).filter((i) => i.status === 'OVERDUE'), (i) => i.total - i.paidAmount)
  const totalSales = (id: string) => (kind === 'SUPPLIER' ? sum(tenant.purchases.filter((p) => p.supplierId === id), (p) => p.total) : sum(tenant.sales.filter((s) => s.customerId === id), (s) => s.total))
  const lastDoc = (id: string) => (kind === 'SUPPLIER' ? tenant.purchases.filter((p) => p.supplierId === id)[0]?.createdAt : tenant.sales.filter((s) => s.customerId === id)[0]?.occurredAt) ?? null
  const cols: Column<Counterparty>[] = [
    { key: 'n', header: t('inv2.field.name'), cell: (c) => <div className="flex items-center gap-3"><Avatar name={c.name.replace(/[«»]/g, '')} size="sm" tone={kind === 'SUPPLIER' ? 'violet' : 'sky'} /><span className="min-w-0"><span className="block truncate font-medium">{c.name}</span><span className="text-2xs text-faint">{c.tin ? `STIR ${c.tin}` : c.segment}</span></span></div>, sortValue: (c) => c.name },
    { key: 'seg', header: 'Segment', cell: (c) => <Badge tone="muted">{c.segment}</Badge>, hideBelow: 'md' },
    { key: 'contact', header: 'Aloqa', cell: (c) => <span className="text-muted">{c.contactName}<br /><span className="text-2xs">{c.phone}</span></span>, hideBelow: 'lg' },
    { key: 'terms', header: t('crm.terms'), cell: (c) => <span className="tnum text-muted">{c.paymentTermDays ? `${c.paymentTermDays} kun` : '—'}</span>, hideBelow: 'md', align: 'right' },
    { key: 'total', header: kind === 'SUPPLIER' ? t('nav.purchasing') : t('crm.totalSales'), cell: (c) => <Scoped scope={kind === 'SUPPLIER' ? 'finance.cost.view' : 'finance.revenue.view'} compact><span className="tnum">{money(totalSales(c.id), { compact: true })}</span></Scoped>, sortValue: (c) => totalSales(c.id), align: 'right' },
    { key: 'bal', header: t('crm.balance'), cell: (c) => <Scoped scope="finance.counterparty.balances.view" compact><span className={cx('tnum font-medium', overdueAmt(c.id) > 0 && 'text-danger')}>{money(sum(openInv(c.id), (i) => i.total - i.paidAmount), { compact: true })}</span></Scoped>, sortValue: (c) => sum(openInv(c.id), (i) => i.total - i.paidAmount), align: 'right' },
    { key: 'last', header: t('crm.lastSale'), cell: (c) => <span className="text-muted">{fmtDate(lastDoc(c.id), lang)}</span>, hideBelow: 'lg' },
  ]
  return (
    <PlanGate feature={kind === 'SUPPLIER' ? 'purchasing.basic' : 'customers.basic'}>
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={kind === 'SUPPLIER' ? t('crm.suppliers') : t('crm.customers')} sub={t('crm.sub')} actions={<Can perm={kind === 'SUPPLIER' ? 'suppliers.create' : 'customers.create'}><Button icon={<Plus size={16} />} onClick={() => setOpen(true)}>{kind === 'SUPPLIER' ? t('crm.newSupplier') : t('crm.newCustomer')}</Button></Can>} />
        <div className="grid grid-cols-3 gap-4">
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('common.all')}</p><p className="mt-1 text-xl font-semibold tnum">{rows.length}</p></Card>
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('crm.balance')}</p><Scoped scope="finance.counterparty.balances.view" compact><p className="mt-1 text-xl font-semibold tnum">{money(sum(rows, (c) => sum(openInv(c.id), (i) => i.total - i.paidAmount)), { compact: true })}</p></Scoped></Card>
          <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('crm.overdue')}</p><Scoped scope="finance.counterparty.balances.view" compact><p className="mt-1 text-xl font-semibold tnum text-danger">{money(sum(rows, (c) => overdueAmt(c.id)), { compact: true })}</p></Scoped></Card>
        </div>
        <DataTable rows={rows} columns={cols} rowKey={(c) => c.id} searchable={(c) => `${c.name} ${c.tin ?? ''} ${c.contactName} ${c.phone}`} onRowClick={setSel} initialSort={{ key: 'n', dir: 'asc' }} emptyTitle={t('crm.empty')} />
        <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name}>
          {sel && (
            <div className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2"><Badge tone="muted">{sel.segment}</Badge>{sel.tin && <Badge tone="muted">STIR {sel.tin}</Badge>}<Badge tone="muted">{sel.paymentTermDays} kun</Badge></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border p-3"><p className="text-2xs text-faint"><UserRound size={10} className="mr-1 inline" />Aloqa</p><p className="font-medium">{sel.contactName || '—'}</p><p className="text-xs text-muted"><Phone size={10} className="mr-1 inline" />{sel.phone || '—'}</p></div>
                <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('crm.balance')}</p><Scoped scope="finance.counterparty.balances.view" compact><p className="font-medium tnum">{money(sum(openInv(sel.id), (i) => i.total - i.paidAmount))}</p>{sel.creditLimit > 0 && <p className="text-xs text-muted">{t('crm.creditLimit')}: {money(sel.creditLimit, { compact: true })}</p>}</Scoped></div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('nav.invoices')}</p>
                <ul className="divide-y rounded-xl border">{openInv(sel.id).slice(0, 8).map((i) => <li key={i.id} className="flex items-center justify-between px-3 py-2"><span><span className="font-mono text-xs">{i.number}</span><span className="ml-2 text-2xs text-faint">{fmtDate(i.dueDate, lang)}</span></span><span className="flex items-center gap-2"><Scoped scope="finance.counterparty.balances.view" compact><span className="tnum">{money(i.total - i.paidAmount, { compact: true })}</span></Scoped><StatusBadge status={i.status} size="xs" label={t(`inv.status.${i.status}` as DictKey)} /></span></li>)}{!openInv(sel.id).length && <li className="px-3 py-3 text-faint">{t('common.empty')}</li>}</ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{kind === 'SUPPLIER' ? t('nav.purchasing') : t('nav.sales')}</p>
                <ul className="divide-y rounded-xl border">{(kind === 'SUPPLIER' ? tenant.purchases.filter((p) => p.supplierId === sel.id).slice(0, 6).map((p) => ({ id: p.id, n: p.number, d: p.createdAt, a: p.total, s: p.status })) : tenant.sales.filter((s) => s.customerId === sel.id).slice(0, 6).map((s) => ({ id: s.id, n: s.number, d: s.occurredAt, a: s.total, s: s.status }))).map((x) => <li key={x.id} className="flex items-center justify-between px-3 py-2"><span><span className="font-mono text-xs">{x.n}</span><span className="ml-2 text-2xs text-faint">{fmtDate(x.d, lang)}</span></span><span className="flex items-center gap-2"><span className="tnum">{money(x.a, { compact: true })}</span><StatusBadge status={x.s} size="xs" /></span></li>)}</ul>
              </div>
            </div>
          )}
        </Drawer>
        <Modal open={open} onClose={() => setOpen(false)} title={kind === 'SUPPLIER' ? t('crm.newSupplier') : t('crm.newCustomer')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!f.name.trim()} onClick={() => { const r = run(() => create({ type: kind, name: f.name, tin: f.tin || null, contactName: f.contactName, phone: f.phone, email: f.email, paymentTermDays: f.paymentTermDays, creditLimit: f.creditLimit, segment: f.segment }), { title: t('common.saved') }); if (r) setOpen(false) }}>{t('common.create')}</Button></>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('inv2.field.name')} required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus left={<Building2 size={14} />} /></Field>
            <Field label="STIR"><Input value={f.tin} onChange={(e) => setF({ ...f, tin: e.target.value })} /></Field>
            <Field label="Mas‘ul shaxs"><Input value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></Field>
            <Field label={t('onb.field.phone')}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
            <Field label="Email"><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label={t('crm.terms')}><Input type="number" value={f.paymentTermDays} onChange={(e) => setF({ ...f, paymentTermDays: Number(e.target.value) })} /></Field>
            <Field label={t('crm.creditLimit')}><Input type="number" value={f.creditLimit} onChange={(e) => setF({ ...f, creditLimit: Number(e.target.value) })} /></Field>
          </div>
        </Modal>
      </div>
    </PlanGate>
  )
}
