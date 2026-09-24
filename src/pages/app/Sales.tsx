import { useMemo, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, BookOpen, Boxes, Check, CheckCircle2, CreditCard, FileText, HandCoins, Minus, Plus, Printer, Search, ShoppingCart, Trash2, Wallet } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useT, useI18nStore } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Badge, Button, Card, Drawer, EmptyState, Field, Input, Modal, SectionHeader, Select, StatusBadge, Tabs } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner, Scoped } from '@/ui/gates'
import { cx, fmtDate, money, num, sum } from '@/core/utils/format'
import type { Invoice, Payment, Sale } from '@/core/domain/entities'
import type { PaymentMethod } from '@/core/domain/enums'
import type { DictKey } from '@/core/i18n/uz'
import { PAYMENT_METHODS } from '@/core/domain/enums'
import { toast } from '@/ui/toast'

export default function SalesPages({ view }: { view?: 'invoices' | 'payments' }) {
  if (view === 'invoices') return <InvoicesPage />
  if (view === 'payments') return <PaymentsPage />
  return (
    <Routes>
      <Route index element={<SalesList />} />
      <Route path="new" element={<NewSale />} />
    </Routes>
  )
}

/* ------------------------------------------------------------ Sales list */

function SalesList() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can, principal } = useSession()
  const [sel, setSel] = useState<Sale | null>(null)
  if (!tenant || !can('sales.view')) return <AccessDenied perm="sales.view" />
  const rows = principal?.dataScope === 'SELF' ? tenant.sales.filter((s) => s.soldByMemberId === principal.memberId) : principal?.dataScope === 'BRANCH' ? tenant.sales.filter((s) => principal.branchIds.includes(s.branchId)) : tenant.sales
  const cust = (id: string | null) => tenant.counterparties.find((c) => c.id === id)?.name ?? '—'
  const cols: Column<Sale>[] = [
    { key: 'number', header: t('sales.number'), cell: (s) => <span className="font-mono text-xs">{s.number}</span>, sortValue: (s) => s.number },
    { key: 'date', header: t('common.date'), cell: (s) => <span className="text-muted">{fmtDate(s.occurredAt, lang, true)}</span>, sortValue: (s) => s.occurredAt, hideBelow: 'sm' },
    { key: 'customer', header: t('sales.field.customer'), cell: (s) => cust(s.customerId), sortValue: (s) => cust(s.customerId) },
    { key: 'items', header: t('common.qty'), cell: (s) => <span className="tnum">{num(sum(s.lines, (l) => l.qty))}</span>, hideBelow: 'md', align: 'right' },
    { key: 'by', header: t('sales.by'), cell: (s) => tenant.members.find((m) => m.id === s.soldByMemberId)?.fullName.split(' ')[0] ?? '—', hideBelow: 'lg' },
    { key: 'method', header: t('sales.field.method'), cell: (s) => <Badge tone="muted">{t(`pmt.method.${s.paymentMethod}` as DictKey)}</Badge>, hideBelow: 'md' },
    { key: 'total', header: t('common.total'), cell: (s) => <span className="tnum font-medium">{money(s.total)}</span>, sortValue: (s) => s.total, align: 'right' },
    { key: 'status', header: t('sales.paymentStatus'), cell: (s) => <StatusBadge status={s.status} label={s.status === 'PAID' ? t('sales.paid') : s.status === 'PARTIALLY_PAID' ? t('sales.partial') : t('sales.unpaid')} />, align: 'right' },
  ]
  const today = rows.filter((s) => s.occurredAt.slice(0, 10) === new Date().toISOString().slice(0, 10))
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader
        title={t('sales.title')}
        sub={t('sales.sub')}
        actions={
          <Can perm="sales.create">
            <Link to="/app/sales/new">
              <Button icon={<ShoppingCart size={16} />}>{t('sales.new')}</Button>
            </Link>
          </Can>
        }
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Mini label={t('sales.today')} value={`${today.length} ta`} sub={money(sum(today, (s) => s.total), { compact: true })} />
        <Mini label={t('common.thisMonth')} value={`${rows.filter((s) => s.occurredAt.slice(0, 7) === new Date().toISOString().slice(0, 7)).length} ta`} sub={money(sum(rows.filter((s) => s.occurredAt.slice(0, 7) === new Date().toISOString().slice(0, 7)), (s) => s.total), { compact: true })} />
        <Mini label={t('sales.unpaid')} value={`${rows.filter((s) => s.paidAmount < s.total).length} ta`} sub={money(sum(rows.filter((s) => s.paidAmount < s.total), (s) => s.total - s.paidAmount), { compact: true })} tone="warning" />
        <Card className="flex items-center justify-between">
          <div>
            <p className="text-2xs uppercase tracking-wider text-faint">{t('sales.margin')}</p>
            <Scoped scope="finance.cost.view" compact>
              <p className="mt-1 text-xl font-semibold tnum">{(() => { const m = rows.slice(0, 200); const r = sum(m, (s) => s.total - s.vatAmount); const c = sum(m, (s) => s.cogs); return r ? `${(((r - c) / r) * 100).toFixed(1)}%` : '—' })()}</p>
            </Scoped>
          </div>
        </Card>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(s) => s.id} searchable={(s) => `${s.number} ${cust(s.customerId)}`} onRowClick={setSel} initialSort={{ key: 'date', dir: 'desc' }} emptyTitle={t('sales.empty')} />
      <SaleDrawer sale={sel} onClose={() => setSel(null)} />
    </div>
  )
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warning' }) {
  return (
    <Card>
      <p className="text-2xs uppercase tracking-wider text-faint">{label}</p>
      <p className={cx('mt-1 text-xl font-semibold tnum', tone === 'warning' && 'text-warning')}>{value}</p>
      {sub && <p className="text-xs text-muted tnum">{sub}</p>}
    </Card>
  )
}

function SaleDrawer({ sale, onClose }: { sale: Sale | null; onClose: () => void }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const [pay, setPay] = useState(false)
  if (!sale || !tenant) return null
  const inv = tenant.invoices.find((i) => i.id === sale.invoiceId)
  const je = tenant.journal.find((e) => e.sourceId === sale.id)
  const cust = tenant.counterparties.find((c) => c.id === sale.customerId)
  return (
    <Drawer open={!!sale} onClose={onClose} title={`${t('sales.number')} ${sale.number}`}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={sale.status} label={sale.status === 'PAID' ? t('sales.paid') : sale.status === 'PARTIALLY_PAID' ? t('sales.partial') : t('sales.unpaid')} />
          <Badge tone="muted">{t(`pmt.method.${sale.paymentMethod}` as DictKey)}</Badge>
          <Badge tone="muted">{sale.channel}</Badge>
          <span className="ml-auto text-xs text-faint">{fmtDate(sale.occurredAt, lang, true)}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border p-3">
            <p className="text-2xs text-faint">{t('sales.field.customer')}</p>
            <p className="font-medium">{cust?.name ?? '—'}</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-2xs text-faint">{t('sales.by')}</p>
            <p className="font-medium">{tenant.members.find((m) => m.id === sale.soldByMemberId)?.fullName ?? '—'}</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="text-2xs uppercase text-faint">
            <tr className="border-b">
              <th className="py-2 text-left font-medium">{t('sales.field.product')}</th>
              <th className="py-2 text-right font-medium">{t('common.qty')}</th>
              <th className="py-2 text-right font-medium">{t('common.price')}</th>
              <th className="py-2 text-right font-medium">{t('common.total')}</th>
            </tr>
          </thead>
          <tbody>
            {sale.lines.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="py-2">{tenant.products.find((p) => p.id === l.productId)?.name}</td>
                <td className="py-2 text-right tnum">{num(l.qty)}</td>
                <td className="py-2 text-right tnum">{money(l.unitPrice, { currency: '' })}{l.discountPct ? <span className="ml-1 text-2xs text-faint">−{l.discountPct}%</span> : null}</td>
                <td className="py-2 text-right tnum">{money(l.qty * l.unitPrice * (1 - l.discountPct / 100), { currency: '' })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="space-y-1 rounded-xl border p-3 text-sm">
          <Row k={t('sales.field.vat')} v={money(sale.vatAmount)} />
          <Row k={t('common.total')} v={money(sale.total)} bold />
          <Row k={t('sales.field.paid')} v={money(sale.paidAmount)} />
          {sale.paidAmount < sale.total && <Row k={t('sales.unpaid')} v={money(sale.total - sale.paidAmount)} tone="warning" />}
          <div className="flex items-center justify-between pt-1">
            <span className="text-muted">{t('sales.margin')}</span>
            <Scoped scope="finance.cost.view" compact>
              <span className="tnum font-medium">{money(sale.total - sale.vatAmount - sale.cogs)} ({(((sale.total - sale.vatAmount - sale.cogs) / Math.max(1, sale.total - sale.vatAmount)) * 100).toFixed(1)}%)</span>
            </Scoped>
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('sales.effects')}</p>
          <ul className="space-y-1.5 text-sm">
            <Effect ok icon={<Boxes size={14} />} label={t('sales.effect.stock')} detail={`${sale.lines.filter((l) => tenant.products.find((p) => p.id === l.productId)?.type !== 'SERVICE').length} pozitsiya kamaydi`} />
            <Effect ok={!!inv} icon={<FileText size={14} />} label={t('sales.effect.invoice')} detail={inv ? inv.number : 'Chakana — faktura talab qilinmaydi'} />
            <Effect ok icon={<HandCoins size={14} />} label={t('sales.effect.revenue')} detail={money(sale.total - sale.vatAmount)} />
            <Effect ok={sale.paidAmount < sale.total} icon={<CreditCard size={14} />} label={t('sales.effect.receivable')} detail={sale.paidAmount < sale.total ? money(sale.total - sale.paidAmount) : '—'} />
            <Effect ok={!!je} icon={<BookOpen size={14} />} label={t('sales.effect.journal')} detail={je ? `${je.number} · ${je.lines.length} qator · D=K ${money(je.totalDebit, { compact: true })}` : '—'} />
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          {sale.paidAmount < sale.total && can('payments.create') && (
            <Button size="sm" icon={<Wallet size={14} />} onClick={() => setPay(true)}>
              {t('inv.recordPayment')}
            </Button>
          )}
          <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => toast.info(t('rep.generated'), t('rep.pdfNote'))}>
            {t('sales.printCheck')}
          </Button>
        </div>
      </div>
      {inv && <RecordPaymentModal open={pay} onClose={() => setPay(false)} invoice={inv} />}
    </Drawer>
  )
}

function Row({ k, v, bold, tone }: { k: string; v: string; bold?: boolean; tone?: 'warning' }) {
  return (
    <div className={cx('flex items-center justify-between', bold && 'font-semibold', tone === 'warning' && 'text-warning')}>
      <span className={cx(!bold && 'text-muted')}>{k}</span>
      <span className="tnum">{v}</span>
    </div>
  )
}

function Effect({ ok, icon, label, detail }: { ok: boolean; icon: React.ReactNode; label: string; detail: string }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <span className={cx('grid h-6 w-6 place-items-center rounded-md', ok ? 'bg-brand/12 text-brand' : 'bg-line/6 text-faint')}>{ok ? <Check size={13} /> : icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-xs text-muted tnum">{detail}</span>
    </li>
  )
}

/* -------------------------------------------------------------- New Sale */

type Line = { productId: string; qty: number; warehouseId: string; discountPct: number }

function NewSale() {
  const t = useT()
  const nav = useNavigate()
  const { tenant, can, principal, readOnly } = useSession()
  const createSale = useAppStore((s) => s.createSale)
  const run = useAction()
  const [step, setStep] = useState(0)
  const [q, setQ] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [customerId, setCustomerId] = useState<string>('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [paid, setPaid] = useState<number | ''>('')
  const [done, setDone] = useState<Sale | null>(null)

  const products = useMemo(() => tenant?.products.filter((p) => p.isActive && p.type !== 'RAW_MATERIAL' && p.type !== 'WIP') ?? [], [tenant])
  const filtered = useMemo(() => products.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()) || p.barcode?.includes(q)), [products, q])
  if (!tenant) return null
  if (!can('sales.create')) return <AccessDenied perm="sales.create" />
  const whAllowed = principal?.dataScope === 'WAREHOUSE' ? tenant.warehouses.filter((w) => principal.warehouseIds.includes(w.id)) : tenant.warehouses
  const avail = (pid: string, wid: string) => {
    const p = tenant.products.find((x) => x.id === pid)!
    if (p.type === 'SERVICE') return Infinity
    const s = tenant.stock.find((x) => x.productId === pid && x.warehouseId === wid)
    return s ? s.onHand - s.reserved : 0
  }
  const bestWh = (pid: string) => {
    const p = tenant.products.find((x) => x.id === pid)!
    if (p.type === 'SERVICE') return whAllowed[0]?.id ?? tenant.warehouses[0].id
    const opts = whAllowed.map((w) => ({ w, a: avail(pid, w.id) })).sort((a, b) => b.a - a.a)
    return (opts[0]?.a ?? 0) > 0 ? opts[0].w.id : p.defaultWarehouseId ?? whAllowed[0]?.id
  }
  const add = (pid: string) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === pid)
      if (ex) return ls.map((l) => (l.productId === pid ? { ...l, qty: l.qty + 1 } : l))
      return [...ls, { productId: pid, qty: 1, warehouseId: bestWh(pid), discountPct: 0 }]
    })
  }
  const total = Math.round(sum(lines, (l) => l.qty * tenant.products.find((p) => p.id === l.productId)!.salePrice * (1 - l.discountPct / 100)))
  const vat = Math.round(total - total / (1 + tenant.company.vatRate / 100))
  const customer = tenant.counterparties.find((c) => c.id === customerId)
  const isRetail = !customer || customer.segment === 'Chakana'
  const stockOk = lines.every((l) => avail(l.productId, l.warehouseId) >= l.qty)
  const paidAmount = method === 'CREDIT' ? 0 : paid === '' ? total : Math.min(total, Number(paid))

  const confirm = () => {
    const s = run(() => createSale({ lines, customerId: customerId || tenant.counterparties.find((c) => c.segment === 'Chakana')?.id || null, paymentMethod: method, paidAmount, channel: isRetail ? 'RETAIL' : 'B2B' }), { title: t('sales.confirmed'), body: t('sales.confirmed.body') })
    if (s) setDone(s)
  }

  if (done) {
    const inv = tenant.invoices.find((i) => i.id === done.invoiceId)
    return (
      <div className="mx-auto max-w-xl">
        <Card className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand/12 text-brand">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="mt-4 text-xl font-semibold">{t('sales.confirmed')}</h2>
          <p className="mt-1 text-sm text-muted">{t('sales.confirmed.body')}</p>
          <p className="mt-3 font-mono text-sm">{done.number}</p>
          <p className="text-2xl font-semibold tnum">{money(done.total)}</p>
          <ul className="mt-5 space-y-1.5 text-left text-sm">
            <Effect ok icon={<Boxes size={14} />} label={t('sales.effect.stock')} detail="yangilandi" />
            <Effect ok={!!inv} icon={<FileText size={14} />} label={t('sales.effect.invoice')} detail={inv?.number ?? '—'} />
            <Effect ok icon={<BookOpen size={14} />} label={t('sales.effect.journal')} detail="avtomatik" />
          </ul>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="secondary" onClick={() => { setDone(null); setLines([]); setStep(0); setPaid(''); setCustomerId('') }}>
              {t('sales.new')}
            </Button>
            <Button onClick={() => nav('/app/sales')}>{t('sales.list')}</Button>
          </div>
        </Card>
      </div>
    )
  }

  const steps = [t('sales.step.product'), t('sales.step.customer'), t('sales.step.payment'), t('sales.step.confirm')]
  return (
    <div className="space-y-5">
      <ReadOnlyBanner />
      <SectionHeader title={t('sales.new')} sub={`${t('sales.step.product')} → ${t('sales.step.qty')} → ${t('sales.step.customer')} → ${t('sales.step.payment')} → ${t('sales.step.confirm')}`} />
      <ol className="flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={cx('flex items-center gap-2 rounded-full border px-3 py-1.5 whitespace-nowrap', i === step ? 'border-brand bg-brand/10 text-brand' : i < step ? 'text-ink' : 'text-faint')}>
              <span className="grid h-4.5 w-4.5 place-items-center rounded-full bg-line/10 text-[10px] tnum">{i < step ? <Check size={10} /> : i + 1}</span>
              {s}
            </span>
            {i < steps.length - 1 && <span className="h-px w-4 bg-line/20" />}
          </li>
        ))}
      </ol>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div>
          {step === 0 && (
            <Card padded={false}>
              <div className="border-b p-3">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t('common.search')} — nom, SKU, shtrix-kod`} left={<Search size={15} />} autoFocus />
              </div>
              <div className="grid max-h-[520px] gap-2 overflow-y-auto p-3 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => {
                  const a = sum(whAllowed, (w) => Math.max(0, avail(p.id, w.id)))
                  const inCart = lines.find((l) => l.productId === p.id)
                  return (
                    <button key={p.id} onClick={() => add(p.id)} disabled={p.type !== 'SERVICE' && a <= 0} className={cx('flex flex-col rounded-2xl border p-3 text-left transition hover:bg-line/5 disabled:opacity-40', inCart && 'border-brand/50 bg-brand/6')}>
                      <div className="flex w-full items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-tight">{p.name}</span>
                        {inCart && <Badge tone="brand" size="xs">{inCart.qty}</Badge>}
                      </div>
                      <span className="mt-1 text-2xs text-faint">{p.sku}</span>
                      <div className="mt-2 flex w-full items-center justify-between">
                        <span className="text-sm font-semibold tnum">{money(p.salePrice, { compact: true })}</span>
                        {p.type === 'SERVICE' ? <Badge tone="violet" size="xs">{t('inv2.type.SERVICE')}</Badge> : <Badge tone={a <= p.reorderLevel ? 'warning' : 'success'} size="xs">{num(a)} {t('sales.stock.available').toLowerCase()}</Badge>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </Card>
          )}
          {step === 1 && (
            <Card>
              <Field label={t('sales.field.customer')}>
                <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">Chakana xaridor (mijozsiz)</option>
                  {tenant.counterparties.filter((c) => c.type !== 'SUPPLIER' && c.segment !== 'Chakana').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.paymentTermDays ? `· ${c.paymentTermDays} kun` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              {customer && !isRetail && (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border p-3">
                    <p className="text-2xs text-faint">{t('crm.terms')}</p>
                    <p className="font-medium">{customer.paymentTermDays} kun</p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="text-2xs text-faint">{t('crm.balance')}</p>
                    <Scoped scope="finance.counterparty.balances.view" compact>
                      <p className={cx('font-medium tnum', customer.balance > customer.creditLimit && customer.creditLimit > 0 && 'text-danger')}>{money(customer.balance)}</p>
                    </Scoped>
                  </div>
                </div>
              )}
              <Can perm="customers.create">
                <QuickCustomer onCreated={(id) => setCustomerId(id)} />
              </Can>
            </Card>
          )}
          {step === 2 && (
            <Card>
              <p className="mb-3 text-sm font-medium">{t('sales.field.method')}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PAYMENT_METHODS.filter((m) => (isRetail ? m !== 'CREDIT' : true)).map((m) => (
                  <button key={m} onClick={() => setMethod(m)} className={cx('rounded-xl border px-3 py-3 text-sm font-medium transition', method === m ? 'border-brand bg-brand/10 text-brand' : 'hover:bg-line/5')}>
                    {t(`pmt.method.${m}` as DictKey)}
                  </button>
                ))}
              </div>
              {['PAYME', 'CLICK', 'UZUM'].includes(method) && <p className="mt-3 rounded-xl border border-dashed p-3 text-xs text-muted">{t('checkout.provider.notConnected.long')} To‘lov qabul qilingan deb qayd etiladi.</p>}
              {method !== 'CREDIT' && (
                <Field label={t('sales.field.paid')} className="mt-4" hint={`${t('common.total')}: ${money(total)}. Bo‘sh qoldirsangiz — to‘liq to‘langan.`}>
                  <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value === '' ? '' : Number(e.target.value))} placeholder={String(total)} />
                </Field>
              )}
              {method === 'CREDIT' && <p className="mt-3 text-xs text-muted">Faktura yaratiladi, to‘lov muddati {customer?.paymentTermDays || 14} kun. Summa debitorlikka o‘tadi.</p>}
            </Card>
          )}
          {step === 3 && (
            <Card>
              <p className="text-sm font-semibold">{t('sales.step.confirm')}</p>
              <ul className="mt-3 space-y-1.5 text-sm">
                <Effect ok icon={<Boxes size={14} />} label={t('sales.effect.stock')} detail={`${lines.filter((l) => tenant.products.find((p) => p.id === l.productId)!.type !== 'SERVICE').length} pozitsiya`} />
                <Effect ok={!isRetail || paidAmount < total} icon={<FileText size={14} />} label={t('sales.effect.invoice')} detail={!isRetail || paidAmount < total ? 'yaratiladi' : 'chakana — kerak emas'} />
                <Effect ok icon={<HandCoins size={14} />} label={t('sales.effect.revenue')} detail={money(total - vat)} />
                <Effect ok={paidAmount < total} icon={<CreditCard size={14} />} label={t('sales.effect.receivable')} detail={paidAmount < total ? money(total - paidAmount) : '—'} />
                <Effect ok icon={<BookOpen size={14} />} label={t('sales.effect.journal')} detail="avtomatik, balanslangan" />
              </ul>
              {!stockOk && <p className="mt-3 text-sm text-danger">{t('sales.stock.insufficient')}</p>}
            </Card>
          )}
          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} icon={<ArrowLeft size={16} />}>
              {t('common.back')}
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={lines.length === 0 || !stockOk} iconRight={<ArrowRight size={16} />}>
                {t('common.continue')}
              </Button>
            ) : (
              <Button onClick={confirm} disabled={readOnly || !stockOk} icon={<Check size={16} />} size="lg">
                {t('sales.confirm')}
              </Button>
            )}
          </div>
        </div>

        {/* Cart */}
        <Card padded={false} className="h-fit lg:sticky lg:top-24">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">
              {t('sales.step.qty')} <span className="text-faint">({lines.length})</span>
            </p>
            {lines.length > 0 && (
              <button onClick={() => setLines([])} className="text-xs text-faint hover:text-danger">
                {t('common.reset')}
              </button>
            )}
          </div>
          {lines.length === 0 ? (
            <EmptyState compact icon={<ShoppingCart size={20} />} title="Savat bo‘sh" body="Chapdan mahsulot tanlang." />
          ) : (
            <ul className="max-h-[360px] divide-y overflow-y-auto">
              {lines.map((l) => {
                const p = tenant.products.find((x) => x.id === l.productId)!
                const a = avail(l.productId, l.warehouseId)
                const bad = a < l.qty
                return (
                  <li key={l.productId} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <p className="text-2xs text-faint tnum">{money(p.salePrice)} × {l.qty}</p>
                      </div>
                      <button onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} className="text-faint hover:text-danger">
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="inline-flex items-center rounded-lg border">
                        <button className="px-2 py-1 text-muted hover:text-ink" onClick={() => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, qty: Math.max(1, x.qty - 1) } : x)))}>
                          <Minus size={12} />
                        </button>
                        <input value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, qty: Math.max(1, Number(e.target.value) || 1) } : x)))} className="w-10 bg-transparent text-center text-sm tnum outline-none" />
                        <button className="px-2 py-1 text-muted hover:text-ink" onClick={() => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, qty: x.qty + 1 } : x)))}>
                          <Plus size={12} />
                        </button>
                      </div>
                      {whAllowed.length > 1 && p.type !== 'SERVICE' && (
                        <select value={l.warehouseId} onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, warehouseId: e.target.value } : x)))} className="h-7 flex-1 rounded-lg border bg-raised/60 px-1.5 text-2xs outline-none">
                          {whAllowed.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code} · {num(avail(l.productId, w.id))}
                            </option>
                          ))}
                        </select>
                      )}
                      {can('sales.edit') && !isRetail && (
                        <input type="number" value={l.discountPct} min={0} max={30} onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, discountPct: Math.min(30, Math.max(0, Number(e.target.value) || 0)) } : x)))} className="h-7 w-14 rounded-lg border bg-raised/60 px-1.5 text-2xs tnum outline-none" title={t('sales.field.discount')} />
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className={cx(bad ? 'text-danger' : 'text-faint')}>{p.type === 'SERVICE' ? t('inv2.type.SERVICE') : `${t('sales.stock.available')}: ${num(a)}`}</span>
                      <span className="tnum font-medium">{money(l.qty * p.salePrice * (1 - l.discountPct / 100), { currency: '' })}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="space-y-1 border-t px-4 py-3 text-sm">
            <Row k={t('sales.field.vat')} v={money(vat)} />
            <Row k={t('sales.total')} v={money(total)} bold />
            {step >= 1 && <Row k={t('sales.field.customer')} v={customer?.name ?? 'Chakana'} />}
            {step >= 2 && <Row k={t('sales.field.method')} v={t(`pmt.method.${method}` as DictKey)} />}
            {step >= 2 && paidAmount < total && <Row k={t('sales.unpaid')} v={money(total - paidAmount)} tone="warning" />}
          </div>
        </Card>
      </div>
    </div>
  )
}

function QuickCustomer({ onCreated }: { onCreated: (id: string) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [terms, setTerms] = useState(14)
  const create = useAppStore((s) => s.createCounterparty)
  const run = useAction()
  return (
    <>
      <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs text-brand hover:underline">
        <Plus size={12} /> {t('crm.newCustomer')}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('crm.newCustomer')} size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!name.trim()} onClick={() => { const c = run(() => create({ type: 'CUSTOMER', name, tin: null, contactName: '', phone, email: '', paymentTermDays: terms, creditLimit: 0, segment: 'O‘rta biznes' }), { title: t('common.saved') }); if (c) { onCreated(c.id); setOpen(false) } }}>{t('common.create')}</Button></>}>
        <div className="space-y-3">
          <Field label={t('inv2.field.name')} required><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label={t('onb.field.phone')}><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+998" /></Field>
          <Field label={t('crm.terms')}><Input type="number" value={terms} onChange={(e) => setTerms(Number(e.target.value))} /></Field>
        </div>
      </Modal>
    </>
  )
}

/* -------------------------------------------------------------- Invoices */

export function RecordPaymentModal({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice: Invoice }) {
  const t = useT()
  const record = useAppStore((s) => s.recordPayment)
  const run = useAction()
  const due = invoice.total - invoice.paidAmount
  const [amount, setAmount] = useState(due)
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  return (
    <Modal open={open} onClose={onClose} title={t('inv.recordPayment')} subtitle={`${invoice.number} · ${t('sales.unpaid')}: ${money(due)}`} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={amount <= 0} onClick={() => { const r = run(() => record({ invoiceId: invoice.id, counterpartyId: invoice.counterpartyId, direction: invoice.direction === 'OUT' ? 'IN' : 'OUT', amount: Math.min(due, amount), method }), { title: t('pmt.posted') }); if (r) onClose() }}>{t('common.confirm')}</Button></>}>
      <div className="space-y-3">
        <Field label={t('common.amount')}><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label={t('sales.field.method')}>
          <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
            {PAYMENT_METHODS.filter((m) => m !== 'CREDIT').map((m) => <option key={m} value={m}>{t(`pmt.method.${m}` as DictKey)}</option>)}
          </Select>
        </Field>
        {invoice.direction === 'IN' && amount > 50_000_000 && <p className="text-xs text-warning">50 mln so‘mdan yuqori chiqim tasdiqlash talab qilishi mumkin.</p>}
      </div>
    </Modal>
  )
}

function InvoicesPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const [tab, setTab] = useState<'OUT' | 'IN'>('OUT')
  const [status, setStatus] = useState<string>('ALL')
  const [payFor, setPayFor] = useState<Invoice | null>(null)
  if (!tenant || !can('invoices.view')) return <AccessDenied perm="invoices.view" />
  const rows = tenant.invoices.filter((i) => i.direction === tab && (status === 'ALL' ? true : i.status === status))
  const cp = (id: string) => tenant.counterparties.find((c) => c.id === id)?.name ?? '—'
  const overdueDays = (i: Invoice) => Math.max(0, Math.floor((Date.now() - new Date(i.dueDate).getTime()) / 86_400_000))
  const cols: Column<Invoice>[] = [
    { key: 'number', header: t('inv.number'), cell: (i) => <span className="font-mono text-xs">{i.number}</span>, sortValue: (i) => i.number },
    { key: 'cp', header: tab === 'OUT' ? t('sales.field.customer') : t('nav.suppliers'), cell: (i) => cp(i.counterpartyId), sortValue: (i) => cp(i.counterpartyId) },
    { key: 'issue', header: t('inv.issueDate'), cell: (i) => <span className="text-muted">{fmtDate(i.issueDate, lang)}</span>, sortValue: (i) => i.issueDate, hideBelow: 'md' },
    { key: 'due', header: t('inv.dueDate'), cell: (i) => <span className={cx(i.status === 'OVERDUE' && 'text-danger')}>{fmtDate(i.dueDate, lang)}{i.status === 'OVERDUE' && <span className="ml-1 text-2xs">({t('inv.overdueDays', { days: overdueDays(i) })})</span>}</span>, sortValue: (i) => i.dueDate, hideBelow: 'sm' },
    { key: 'total', header: t('common.total'), cell: (i) => <span className="tnum font-medium">{money(i.total)}</span>, sortValue: (i) => i.total, align: 'right' },
    { key: 'open', header: t('sales.unpaid'), cell: (i) => <span className={cx('tnum', i.total - i.paidAmount > 0 ? 'text-warning' : 'text-faint')}>{money(i.total - i.paidAmount)}</span>, align: 'right', hideBelow: 'md' },
    { key: 'status', header: t('common.status'), cell: (i) => <StatusBadge status={i.status} label={t(`inv.status.${i.status}` as DictKey)} />, align: 'right' },
    { key: 'act', header: '', cell: (i) => i.total - i.paidAmount > 0 && can('payments.create') ? <Button size="xs" variant="secondary" onClick={(e) => { e.stopPropagation(); setPayFor(i) }}>{t('inv.recordPayment')}</Button> : null, align: 'right' },
  ]
  const totals = { total: sum(rows, (i) => i.total), open: sum(rows, (i) => i.total - i.paidAmount), overdue: sum(rows.filter((i) => i.status === 'OVERDUE'), (i) => i.total - i.paidAmount) }
  return (
    <PlanGate feature="invoices">
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={t('inv.title')} sub={t('inv.sub')} />
        <div className="grid grid-cols-3 gap-4">
          <Mini label={t('common.total')} value={money(totals.total, { compact: true })} sub={`${rows.length} ta`} />
          <Card>
            <p className="text-2xs uppercase tracking-wider text-faint">{t('sales.unpaid')}</p>
            <Scoped scope="finance.counterparty.balances.view" compact><p className="mt-1 text-xl font-semibold tnum text-warning">{money(totals.open, { compact: true })}</p></Scoped>
          </Card>
          <Card>
            <p className="text-2xs uppercase tracking-wider text-faint">{t('dash.overdue')}</p>
            <Scoped scope="finance.counterparty.balances.view" compact><p className="mt-1 text-xl font-semibold tnum text-danger">{money(totals.overdue, { compact: true })}</p></Scoped>
          </Card>
        </div>
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'OUT', label: t('inv.out'), count: tenant.invoices.filter((i) => i.direction === 'OUT').length }, { value: 'IN', label: t('inv.in'), count: tenant.invoices.filter((i) => i.direction === 'IN').length }]} />
        <DataTable
          rows={rows}
          columns={cols}
          rowKey={(i) => i.id}
          searchable={(i) => `${i.number} ${cp(i.counterpartyId)}`}
          initialSort={{ key: 'issue', dir: 'desc' }}
          emptyTitle={t('inv.empty')}
          toolbar={
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-44">
              <option value="ALL">{t('common.all')}</option>
              {['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE'].map((s) => <option key={s} value={s}>{t(`inv.status.${s}` as DictKey)}</option>)}
            </Select>
          }
        />
        {payFor && <RecordPaymentModal open={!!payFor} onClose={() => setPayFor(null)} invoice={payFor} />}
      </div>
    </PlanGate>
  )
}

/* -------------------------------------------------------------- Payments */

function PaymentsPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const approve = useAppStore((s) => s.approvePayment)
  const record = useAppStore((s) => s.recordPayment)
  const run = useAction()
  const [tab, setTab] = useState<'ALL' | 'IN' | 'OUT' | 'PENDING'>('ALL')
  const [newOpen, setNewOpen] = useState(false)
  if (!tenant || !can('payments.view')) return <AccessDenied perm="payments.view" />
  const rows = tenant.payments.filter((p) => (tab === 'ALL' ? true : tab === 'PENDING' ? p.status === 'PENDING' : p.direction === tab))
  const cp = (id: string | null) => tenant.counterparties.find((c) => c.id === id)?.name ?? '—'
  const cols: Column<Payment>[] = [
    { key: 'n', header: '№', cell: (p) => <span className="font-mono text-xs">{p.number}</span>, sortValue: (p) => p.number },
    { key: 'd', header: t('common.date'), cell: (p) => <span className="text-muted">{fmtDate(p.paidAt, lang, true)}</span>, sortValue: (p) => p.paidAt, hideBelow: 'sm' },
    { key: 'dir', header: '', cell: (p) => <Badge tone={p.direction === 'IN' ? 'success' : 'warning'}>{p.direction === 'IN' ? t('pmt.in') : t('pmt.out')}</Badge> },
    { key: 'cp', header: 'Kontragent', cell: (p) => cp(p.counterpartyId), hideBelow: 'md' },
    { key: 'm', header: t('sales.field.method'), cell: (p) => t(`pmt.method.${p.method}` as DictKey), hideBelow: 'lg' },
    { key: 'a', header: t('common.amount'), cell: (p) => <span className={cx('tnum font-medium', p.direction === 'OUT' && 'text-warning')}>{p.direction === 'OUT' ? '−' : '+'}{money(p.amount)}</span>, sortValue: (p) => p.amount, align: 'right' },
    { key: 's', header: t('common.status'), cell: (p) => <StatusBadge status={p.status} />, align: 'right' },
    { key: 'act', header: '', cell: (p) => p.status === 'PENDING' && can('payments.approve') ? <Button size="xs" onClick={() => run(() => approve(p.id), { title: t('pmt.approved') })}>{t('pmt.approve')}</Button> : null, align: 'right' },
  ]
  const pending = tenant.payments.filter((p) => p.status === 'PENDING')
  const cashIn = sum(tenant.payments.filter((p) => p.direction === 'IN' && p.paidAt.slice(0, 7) === new Date().toISOString().slice(0, 7) && p.status !== 'PENDING'), (p) => p.amount)
  const cashOut = sum(tenant.payments.filter((p) => p.direction === 'OUT' && p.paidAt.slice(0, 7) === new Date().toISOString().slice(0, 7) && p.status !== 'PENDING'), (p) => p.amount)
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('pmt.title')} sub={t('pmt.sub')} actions={<Can perm="payments.create"><Button icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>{t('pmt.new')}</Button></Can>} />
      <div className="grid grid-cols-3 gap-4">
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('pmt.in')} · {t('common.thisMonth')}</p><Scoped scope="finance.cash.view" compact><p className="mt-1 text-xl font-semibold tnum text-success">{money(cashIn, { compact: true })}</p></Scoped></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('pmt.out')} · {t('common.thisMonth')}</p><Scoped scope="finance.cash.view" compact><p className="mt-1 text-xl font-semibold tnum text-warning">{money(cashOut, { compact: true })}</p></Scoped></Card>
        <Mini label={t('pmt.needsApproval')} value={`${pending.length} ta`} sub={money(sum(pending, (p) => p.amount), { compact: true })} tone={pending.length ? 'warning' : undefined} />
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'ALL', label: t('common.all') }, { value: 'IN', label: t('pmt.in') }, { value: 'OUT', label: t('pmt.out') }, { value: 'PENDING', label: t('pmt.needsApproval'), count: pending.length }]} />
      <DataTable rows={rows} columns={cols} rowKey={(p) => p.id} searchable={(p) => `${p.number} ${cp(p.counterpartyId)} ${p.reference}`} initialSort={{ key: 'd', dir: 'desc' }} emptyTitle={t('pmt.empty')} />
      <NewPaymentModal open={newOpen} onClose={() => setNewOpen(false)} onSubmit={(v) => { const r = run(() => record(v), { title: t('pmt.posted') }); if (r) setNewOpen(false) }} />
    </div>
  )
}

function NewPaymentModal({ open, onClose, onSubmit }: { open: boolean; onClose: () => void; onSubmit: (v: { invoiceId: string | null; counterpartyId: string | null; direction: 'IN' | 'OUT'; amount: number; method: PaymentMethod; note?: string }) => void }) {
  const t = useT()
  const { tenant } = useSession()
  const [dir, setDir] = useState<'IN' | 'OUT'>('IN')
  const [cp, setCp] = useState('')
  const [inv, setInv] = useState('')
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER')
  if (!tenant) return null
  const openInvs = tenant.invoices.filter((i) => i.direction === (dir === 'IN' ? 'OUT' : 'IN') && i.total - i.paidAmount > 0 && (!cp || i.counterpartyId === cp))
  return (
    <Modal open={open} onClose={onClose} title={t('pmt.new')} size="sm" footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={amount <= 0} onClick={() => onSubmit({ invoiceId: inv || null, counterpartyId: cp || null, direction: dir, amount, method })}>{t('common.confirm')}</Button></>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {(['IN', 'OUT'] as const).map((d) => <button key={d} onClick={() => { setDir(d); setInv('') }} className={cx('rounded-xl border py-2 text-sm font-medium', dir === d ? 'border-brand bg-brand/10 text-brand' : '')}>{d === 'IN' ? t('pmt.in') : t('pmt.out')}</button>)}
        </div>
        <Field label="Kontragent"><Select value={cp} onChange={(e) => { setCp(e.target.value); setInv('') }}><option value="">—</option>{tenant.counterparties.filter((c) => (dir === 'IN' ? c.type !== 'SUPPLIER' : c.type !== 'CUSTOMER')).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label={t('nav.invoices')}><Select value={inv} onChange={(e) => { setInv(e.target.value); const i = openInvs.find((x) => x.id === e.target.value); if (i) { setAmount(i.total - i.paidAmount); setCp(i.counterpartyId) } }}><option value="">—</option>{openInvs.map((i) => <option key={i.id} value={i.id}>{i.number} · {money(i.total - i.paidAmount, { compact: true })}</option>)}</Select></Field>
        <Field label={t('common.amount')}><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label={t('sales.field.method')}><Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{PAYMENT_METHODS.filter((m) => m !== 'CREDIT').map((m) => <option key={m} value={m}>{t(`pmt.method.${m}` as DictKey)}</option>)}</Select></Field>
      </div>
    </Modal>
  )
}

