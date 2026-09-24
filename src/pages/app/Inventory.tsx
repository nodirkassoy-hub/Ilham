import { useState } from 'react'
import { Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeftRight, ClipboardCheck, Plus, Truck, Warehouse as WarehouseIcon } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Badge, Button, Card, Drawer, Field, Input, Modal, Progress, SectionHeader, Select, StatusBadge, Tabs } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner, Scoped } from '@/ui/gates'
import { cx, fmtDate, money, num, sum } from '@/core/utils/format'
import type { InventoryMovement, Product, StockTransfer } from '@/core/domain/entities'
import { PRODUCT_TYPES, type ProductType } from '@/core/domain/enums'
import type { DictKey } from '@/core/i18n/uz'

export default function InventoryPages() {
  return (
    <Routes>
      <Route index element={<Navigate to="products" replace />} />
      <Route path="products" element={<ProductsPage />} />
      <Route path="stock" element={<StockPage />} />
      <Route path="warehouses" element={<WarehousesPage />} />
      <Route path="transfers" element={<TransfersPage />} />
      <Route path="counts" element={<CountsPage />} />
    </Routes>
  )
}

function SubNav() {
  const t = useT()
  const nav = useNavigate()
  const { can, has } = useSession()
  const path = window.location.pathname.split('/').pop() as string
  const tabs = [
    can('products.view') && { value: 'products', label: t('inv2.products') },
    can('stock.view') && { value: 'stock', label: t('inv2.stock') },
    can('warehouses.view') && { value: 'warehouses', label: t('inv2.warehouses') },
    can('transfers.view') && { value: 'transfers', label: t('inv2.transfers'), locked: !has('accounting.full') },
    can('stockcounts.view') && { value: 'counts', label: t('inv2.counts'), locked: !has('accounting.full') },
  ].filter(Boolean) as { value: string; label: string; locked?: boolean }[]
  return <Tabs value={path} onChange={(v) => nav(`/app/inventory/${v}`)} tabs={tabs} />
}

/* ------------------------------------------------------------- Products */

function ProductsPage() {
  const t = useT()
  const { tenant, can, ent } = useSession()
  const [sp] = useSearchParams()
  const [sel, setSel] = useState<Product | null>(null)
  const [create, setCreate] = useState(false)
  const [type, setType] = useState<string>('ALL')
  if (!tenant || !can('products.view')) return <AccessDenied perm="products.view" />
  const stockFor = (pid: string) => tenant.stock.filter((s) => s.productId === pid)
  const rows = tenant.products.filter((p) => type === 'ALL' || p.type === type)
  const cols: Column<Product>[] = [
    { key: 'name', header: t('inv2.field.name'), cell: (p) => (
      <div className="flex items-center gap-3">
        <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-bold', p.type === 'RAW_MATERIAL' ? 'bg-line/8 text-muted' : p.type === 'SERVICE' ? 'bg-violet/12 text-violet' : p.type === 'FINISHED_GOOD' ? 'bg-brand/12 text-brand' : 'bg-sky/12 text-sky')}>{p.sku.slice(0, 2)}</span>
        <span className="min-w-0">
          <span className="block truncate font-medium">{p.name}</span>
          <span className="block text-2xs text-faint">{p.sku}{p.barcode ? ` · ${p.barcode}` : ''}</span>
        </span>
      </div>
    ), sortValue: (p) => p.name },
    { key: 'type', header: t('inv2.field.type'), cell: (p) => <Badge tone="muted">{t(`inv2.type.${p.type}` as DictKey)}</Badge>, hideBelow: 'md' },
    { key: 'cat', header: t('inv2.field.category'), cell: (p) => tenant.categories.find((c) => c.id === p.categoryId)?.name ?? '—', hideBelow: 'lg' },
    { key: 'price', header: t('inv2.field.salePrice'), cell: (p) => <span className="tnum">{p.salePrice ? money(p.salePrice) : '—'}</span>, sortValue: (p) => p.salePrice, align: 'right' },
    { key: 'cost', header: t('inv2.field.cost'), cell: (p) => <Scoped scope="finance.cost.view" compact><span className="tnum text-muted">{(() => { const s = stockFor(p.id); const q = sum(s, (x) => x.onHand); return q ? money(sum(s, (x) => x.onHand * x.avgCost) / q) : p.purchasePrice ? money(p.purchasePrice) : '—' })()}</span></Scoped>, align: 'right', hideBelow: 'md' },
    { key: 'stock', header: t('inv2.field.onHand'), cell: (p) => { if (p.type === 'SERVICE') return <span className="text-faint">—</span>; const s = stockFor(p.id); const on = sum(s, (x) => x.onHand); const av = on - sum(s, (x) => x.reserved); return <span className={cx('tnum', av <= p.reorderLevel ? 'text-warning font-medium' : '')}>{num(av)}{av <= p.reorderLevel && p.reorderLevel > 0 ? <Badge tone={av <= 0 ? 'danger' : 'warning'} size="xs" className="ml-1.5">{av <= 0 ? t('inv2.outOfStock') : t('inv2.lowStock')}</Badge> : null}</span> }, sortValue: (p) => sum(stockFor(p.id), (x) => x.onHand), align: 'right' },
  ]
  const lim = ent.limits.products
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('inv2.title')} sub={t('inv2.sub')} actions={<Can perm="products.create"><Button icon={<Plus size={16} />} onClick={() => setCreate(true)}>{t('inv2.newProduct')}</Button></Can>} />
      <SubNav />
      {lim !== null && (
        <Card className="flex items-center gap-4 py-3">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs"><span className="text-muted">{t('billing.limit.products')}</span><span className="tnum">{tenant.products.length}/{lim}</span></div>
            <Progress value={(tenant.products.length / lim) * 100} className="mt-1.5" tone={tenant.products.length >= lim ? 'danger' : 'brand'} />
          </div>
        </Card>
      )}
      <DataTable rows={rows} columns={cols} rowKey={(p) => p.id} searchable={(p) => `${p.name} ${p.sku} ${p.barcode ?? ''}`} onRowClick={setSel} initialSort={{ key: 'name', dir: 'asc' }} emptyTitle={t('inv2.empty')}
        toolbar={<Select value={type} onChange={(e) => setType(e.target.value)} className="h-9 w-44"><option value="ALL">{t('common.all')}</option>{PRODUCT_TYPES.map((x) => <option key={x} value={x}>{t(`inv2.type.${x}` as DictKey)}</option>)}</Select>} />
      <ProductDrawer product={sel} onClose={() => setSel(null)} />
      <ProductModal open={create || sp.get('new') === '1'} onClose={() => setCreate(false)} />
    </div>
  )
}

function ProductDrawer({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const adjust = useAppStore((s) => s.adjustStock)
  const update = useAppStore((s) => s.updateProduct)
  const run = useAction()
  const [adj, setAdj] = useState<{ wh: string; delta: number; note: string } | null>(null)
  const [price, setPrice] = useState<number | null>(null)
  if (!product || !tenant) return null
  const stocks = tenant.stock.filter((s) => s.productId === product.id)
  const moves = tenant.movements.filter((m) => m.productId === product.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 12)
  return (
    <Drawer open={!!product} onClose={onClose} title={product.name}>
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2"><Badge tone="muted">{product.sku}</Badge><Badge tone="muted">{t(`inv2.type.${product.type}` as DictKey)}</Badge>{product.barcode && <Badge tone="muted">{product.barcode}</Badge>}</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border p-3">
            <p className="text-2xs text-faint">{t('inv2.field.salePrice')}</p>
            {can('products.edit') && price !== null ? (
              <div className="mt-1 flex gap-1"><Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} className="h-8" /><Button size="xs" onClick={() => { run(() => update(product.id, { salePrice: price }), { title: t('common.saved') }); setPrice(null) }}>OK</Button></div>
            ) : (
              <p className="font-medium tnum">{money(product.salePrice)} {can('products.edit') && <button onClick={() => setPrice(product.salePrice)} className="ml-2 text-2xs text-brand">{t('common.edit')}</button>}</p>
            )}
          </div>
          <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('inv2.field.cost')}</p><Scoped scope="finance.cost.view" compact><p className="font-medium tnum">{money(stocks.length ? sum(stocks, (s) => s.onHand * s.avgCost) / Math.max(1, sum(stocks, (s) => s.onHand)) : product.purchasePrice)}</p></Scoped></div>
          <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('inv2.field.reorder')}</p><p className="font-medium tnum">{product.reorderLevel}</p></div>
          <div className="rounded-xl border p-3"><p className="text-2xs text-faint">{t('sales.field.vat')}</p><p className="font-medium tnum">{product.vatRate}%</p></div>
        </div>
        {product.type !== 'SERVICE' && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('inv2.stock')}</p>
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-raised/40 text-2xs uppercase text-faint"><tr><th className="px-3 py-2 text-left font-medium">{t('inv2.field.warehouse')}</th><th className="px-3 py-2 text-right font-medium">{t('inv2.field.onHand')}</th><th className="px-3 py-2 text-right font-medium">{t('inv2.field.reserved')}</th><th className="px-3 py-2 text-right font-medium">{t('inv2.field.available')}</th><th></th></tr></thead>
                <tbody>
                  {tenant.warehouses.map((w) => { const s = stocks.find((x) => x.warehouseId === w.id); return (
                    <tr key={w.id} className="border-t"><td className="px-3 py-2">{w.name}</td><td className="px-3 py-2 text-right tnum">{num(s?.onHand ?? 0)}{s?.inTransit ? <span className="ml-1 text-2xs text-sky">+{num(s.inTransit)} yo‘lda</span> : null}</td><td className="px-3 py-2 text-right tnum text-muted">{num(s?.reserved ?? 0)}</td><td className="px-3 py-2 text-right tnum font-medium">{num((s?.onHand ?? 0) - (s?.reserved ?? 0))}</td><td className="px-2 py-2 text-right">{can('stock.edit') && <button onClick={() => setAdj({ wh: w.id, delta: 0, note: '' })} className="text-2xs text-brand">{t('inv2.adjust')}</button>}</td></tr>
                  ) })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">{t('inv2.movements')}</p>
          <ul className="divide-y rounded-xl border">
            {moves.map((m) => <MovementRow key={m.id} m={m} lang={lang} />)}
            {!moves.length && <li className="px-3 py-3 text-sm text-faint">{t('common.empty')}</li>}
          </ul>
        </div>
      </div>
      <Modal open={!!adj} onClose={() => setAdj(null)} title={t('inv2.adjust')} size="sm" footer={<><Button variant="ghost" onClick={() => setAdj(null)}>{t('common.cancel')}</Button><Button disabled={!adj || adj.delta === 0} onClick={() => { if (!adj) return; const r = run(() => adjust(product.id, adj.wh, adj.delta, adj.note), { title: t('common.saved') }); if (r !== undefined || true) setAdj(null) }}>{t('common.confirm')}</Button></>}>
        {adj && <div className="space-y-3"><Field label={`${t('common.qty')} (+/−)`}><Input type="number" value={adj.delta} onChange={(e) => setAdj({ ...adj, delta: Number(e.target.value) })} autoFocus /></Field><Field label={t('acc.entry.memo')} required><Input value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} placeholder="Sabab: inventarizatsiya, brak, xato…" /></Field></div>}
      </Modal>
    </Drawer>
  )
}

function MovementRow({ m, lang }: { m: InventoryMovement; lang: 'uz' | 'ru' | 'en' }) {
  const t = useT()
  const { tenant } = useSession()
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <span className={cx('h-2 w-2 shrink-0 rounded-full', m.qty > 0 ? 'bg-success' : m.qty < 0 ? 'bg-warning' : 'bg-faint')} />
      <span className="min-w-0 flex-1"><span className="block truncate">{t(`inv2.movement.${m.type}` as DictKey)} <span className="text-faint">· {tenant?.warehouses.find((w) => w.id === m.warehouseId)?.code}</span></span><span className="block text-2xs text-faint">{fmtDate(m.occurredAt, lang, true)} · {m.note}</span></span>
      <span className={cx('tnum font-medium', m.qty > 0 ? 'text-success' : m.qty < 0 ? 'text-warning' : '')}>{m.qty > 0 ? '+' : ''}{num(m.qty, 2)}</span>
    </li>
  )
}

function ProductModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const { tenant } = useSession()
  const create = useAppStore((s) => s.createProduct)
  const run = useAction()
  const [f, setF] = useState({ name: '', sku: '', barcode: '', type: 'GOODS' as ProductType, salePrice: 0, purchasePrice: 0, reorderLevel: 10, categoryId: '', openingQty: 0, warehouseId: '' })
  if (!tenant) return null
  return (
    <Modal open={open} onClose={onClose} title={t('inv2.newProduct')} footer={<><Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button><Button disabled={!f.name || !f.sku} onClick={() => { const r = run(() => create({ ...f, barcode: f.barcode || null, categoryId: f.categoryId || (tenant.categories[0]?.id ?? null), unitId: tenant.units[0]?.id ?? '', warehouseId: f.warehouseId || tenant.warehouses[0]?.id }), { title: t('common.saved') }); if (r) { onClose(); setF({ ...f, name: '', sku: '', barcode: '', openingQty: 0 }) } }}>{t('common.create')}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t('inv2.field.name')} required className="sm:col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
        <Field label={t('inv2.field.sku')} required><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value.toUpperCase() })} placeholder="TG-301" /></Field>
        <Field label={t('inv2.field.barcode')}><Input value={f.barcode} onChange={(e) => setF({ ...f, barcode: e.target.value })} /></Field>
        <Field label={t('inv2.field.type')}><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as ProductType })}>{PRODUCT_TYPES.filter((x) => x !== 'WIP').map((x) => <option key={x} value={x}>{t(`inv2.type.${x}` as DictKey)}</option>)}</Select></Field>
        <Field label={t('inv2.field.category')}><Select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}><option value="">—</option>{tenant.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <Field label={t('inv2.field.salePrice')}><Input type="number" value={f.salePrice} onChange={(e) => setF({ ...f, salePrice: Number(e.target.value) })} /></Field>
        <Field label={t('inv2.field.purchasePrice')}><Input type="number" value={f.purchasePrice} onChange={(e) => setF({ ...f, purchasePrice: Number(e.target.value) })} /></Field>
        <Field label={t('inv2.field.reorder')}><Input type="number" value={f.reorderLevel} onChange={(e) => setF({ ...f, reorderLevel: Number(e.target.value) })} /></Field>
        {f.type !== 'SERVICE' && <>
          <Field label={t('inv2.field.warehouse')}><Select value={f.warehouseId} onChange={(e) => setF({ ...f, warehouseId: e.target.value })}>{tenant.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
          <Field label={t('inv2.movement.OPENING')} className="sm:col-span-2"><Input type="number" value={f.openingQty} onChange={(e) => setF({ ...f, openingQty: Number(e.target.value) })} /></Field>
        </>}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------- Stock */

function StockPage() {
  const t = useT()
  const { tenant, can, principal } = useSession()
  const [wh, setWh] = useState('ALL')
  const [onlyLow, setOnlyLow] = useState(false)
  if (!tenant || !can('stock.view')) return <AccessDenied perm="stock.view" />
  const allowed = principal?.dataScope === 'WAREHOUSE' ? tenant.warehouses.filter((w) => principal.warehouseIds.includes(w.id)) : tenant.warehouses
  const rows = tenant.stock.filter((s) => allowed.some((w) => w.id === s.warehouseId) && (wh === 'ALL' || s.warehouseId === wh)).map((s) => ({ s, p: tenant.products.find((x) => x.id === s.productId)!, w: tenant.warehouses.find((x) => x.id === s.warehouseId)! })).filter((r) => r.p && (!onlyLow || (r.p.reorderLevel > 0 && r.s.onHand - r.s.reserved <= r.p.reorderLevel)))
  type R = (typeof rows)[number]
  const cols: Column<R>[] = [
    { key: 'p', header: t('inv2.field.name'), cell: (r) => <span><span className="block font-medium">{r.p.name}</span><span className="text-2xs text-faint">{r.p.sku}</span></span>, sortValue: (r) => r.p.name },
    { key: 'w', header: t('inv2.field.warehouse'), cell: (r) => <Badge tone="muted">{r.w.code}</Badge>, sortValue: (r) => r.w.code, hideBelow: 'sm' },
    { key: 'on', header: t('inv2.field.onHand'), cell: (r) => <span className="tnum">{num(r.s.onHand, 2)}</span>, sortValue: (r) => r.s.onHand, align: 'right' },
    { key: 'res', header: t('inv2.field.reserved'), cell: (r) => <span className="tnum text-muted">{num(r.s.reserved)}</span>, align: 'right', hideBelow: 'md' },
    { key: 'tr', header: 'Yo‘lda', cell: (r) => <span className="tnum text-sky">{r.s.inTransit ? `+${num(r.s.inTransit)}` : '—'}</span>, align: 'right', hideBelow: 'lg' },
    { key: 'av', header: t('inv2.field.available'), cell: (r) => { const av = r.s.onHand - r.s.reserved; const low = r.p.reorderLevel > 0 && av <= r.p.reorderLevel; return <span className={cx('tnum font-medium', low && 'text-warning')}>{num(av, 2)} {low && <Badge tone={av <= 0 ? 'danger' : 'warning'} size="xs" className="ml-1">min {r.p.reorderLevel}</Badge>}</span> }, sortValue: (r) => r.s.onHand - r.s.reserved, align: 'right' },
    { key: 'val', header: t('inv2.value'), cell: (r) => <Scoped scope="finance.cost.view" compact><span className="tnum text-muted">{money((r.s.onHand + r.s.inTransit) * r.s.avgCost, { compact: true })}</span></Scoped>, sortValue: (r) => r.s.onHand * r.s.avgCost, align: 'right', hideBelow: 'md' },
  ]
  const total = sum(rows, (r) => (r.s.onHand + r.s.inTransit) * r.s.avgCost)
  const low = rows.filter((r) => r.p.reorderLevel > 0 && r.s.onHand - r.s.reserved <= r.p.reorderLevel).length
  return (
    <div className="space-y-6">
      <SectionHeader title={t('inv2.stock')} sub={`${rows.length} pozitsiya · ${allowed.length} ombor`} />
      <SubNav />
      <div className="grid grid-cols-3 gap-4">
        <Card><p className="text-2xs uppercase tracking-wider text-faint">SKU</p><p className="mt-1 text-xl font-semibold tnum">{rows.length}</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('inv2.lowStock')}</p><p className={cx('mt-1 text-xl font-semibold tnum', low && 'text-warning')}>{low}</p></Card>
        <Card><p className="text-2xs uppercase tracking-wider text-faint">{t('inv2.value')}</p><Scoped scope="finance.cost.view" compact><p className="mt-1 text-xl font-semibold tnum">{money(total, { compact: true })}</p></Scoped></Card>
      </div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.s.id} searchable={(r) => `${r.p.name} ${r.p.sku} ${r.w.name}`} initialSort={{ key: 'p', dir: 'asc' }} pageSize={25}
        toolbar={<><Select value={wh} onChange={(e) => setWh(e.target.value)} className="h-9 w-48"><option value="ALL">{t('common.all')}</option>{allowed.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select><Button size="sm" variant={onlyLow ? 'primary' : 'secondary'} onClick={() => setOnlyLow((v) => !v)}>{t('inv2.lowStock')}</Button></>} />
    </div>
  )
}

/* ------------------------------------------------------------ Warehouses */

function WarehousesPage() {
  const t = useT()
  const { tenant, can, ent } = useSession()
  const create = useAppStore((s) => s.createWarehouse)
  const run = useAction()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', code: '', branchId: '', type: 'MAIN' as const, address: '' })
  if (!tenant || !can('warehouses.view')) return <AccessDenied perm="warehouses.view" />
  const lim = ent.limits.warehouses
  return (
    <div className="space-y-6">
      <SectionHeader title={t('inv2.warehouses')} sub={lim ? t('inv2.warehouse.limit', { limit: lim, current: tenant.warehouses.length }) : t('common.unlimited')} actions={<Can perm="warehouses.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)} disabled={lim !== null && tenant.warehouses.length >= lim}>{t('common.add')}</Button></Can>} />
      <SubNav />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tenant.warehouses.map((w) => {
          const rows = tenant.stock.filter((s) => s.warehouseId === w.id)
          const br = tenant.branches.find((b) => b.id === w.branchId)
          const mgr = tenant.members.find((m) => m.id === w.managerMemberId)
          return (
            <Card key={w.id}>
              <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/12 text-brand"><WarehouseIcon size={18} /></span><Badge tone="muted">{w.code}</Badge></div>
              <h3 className="mt-3 font-semibold">{w.name}</h3>
              <p className="text-xs text-muted">{br?.name} · {w.type}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-sm">
                <div className="rounded-xl bg-line/5 p-2"><p className="font-semibold tnum">{rows.length}</p><p className="text-2xs text-faint">SKU</p></div>
                <div className="rounded-xl bg-line/5 p-2"><Scoped scope="finance.cost.view" compact><p className="font-semibold tnum">{money(sum(rows, (s) => s.onHand * s.avgCost), { compact: true, currency: '' })}</p></Scoped><p className="text-2xs text-faint">{t('inv2.value')}</p></div>
              </div>
              <p className="mt-3 text-2xs text-faint">{t('set.members.role')}: {mgr?.fullName ?? '—'}</p>
            </Card>
          )
        })}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={t('inv2.warehouses')} size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!f.name || !f.code} onClick={() => { const r = run(() => create({ ...f, branchId: f.branchId || tenant.branches[0].id }), { title: t('common.saved') }); if (r) setOpen(false) }}>{t('common.create')}</Button></>}>
        <div className="space-y-3">
          <Field label={t('inv2.field.name')} required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Kod" required><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="WH-05" /></Field>
          <Field label={t('nav.branches')}><Select value={f.branchId} onChange={(e) => setF({ ...f, branchId: e.target.value })}>{tenant.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <Field label="Manzil"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------- Transfers */

function TransfersPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const create = useAppStore((s) => s.createTransfer)
  const receive = useAppStore((s) => s.receiveTransfer)
  const run = useAction()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [lines, setLines] = useState<{ productId: string; qty: number }[]>([{ productId: '', qty: 1 }])
  if (!tenant || !can('transfers.view')) return <AccessDenied perm="transfers.view" />
  const avail = (pid: string, wid: string) => { const s = tenant.stock.find((x) => x.productId === pid && x.warehouseId === wid); return s ? s.onHand - s.reserved : 0 }
  const cols: Column<StockTransfer>[] = [
    { key: 'n', header: '№', cell: (x) => <span className="font-mono text-xs">{x.number}</span> },
    { key: 'route', header: `${t('inv2.transfer.from')} → ${t('inv2.transfer.to')}`, cell: (x) => <span className="inline-flex items-center gap-2"><Badge tone="muted">{tenant.warehouses.find((w) => w.id === x.fromWarehouseId)?.code}</Badge><ArrowLeftRight size={12} className="text-faint" /><Badge tone="muted">{tenant.warehouses.find((w) => w.id === x.toWarehouseId)?.code}</Badge></span> },
    { key: 'items', header: t('common.qty'), cell: (x) => <span className="text-muted">{x.lines.map((l) => `${tenant.products.find((p) => p.id === l.productId)?.name} × ${l.qty}`).join(', ')}</span>, hideBelow: 'md' },
    { key: 'd', header: t('common.date'), cell: (x) => <span className="text-muted">{fmtDate(x.shippedAt, lang)}</span>, hideBelow: 'sm' },
    { key: 's', header: t('common.status'), cell: (x) => <StatusBadge status={x.status} />, align: 'right' },
    { key: 'a', header: '', cell: (x) => x.status === 'IN_TRANSIT' && can('transfers.edit') ? <Button size="xs" onClick={() => run(() => receive(x.id), { title: t('inv2.receive') })}>{t('inv2.receive')}</Button> : null, align: 'right' },
  ]
  return (
    <PlanGate feature="accounting.full">
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={t('inv2.transfers')} sub="Omborlararo ko‘chirmalar: jo‘natish → yo‘lda → qabul." actions={<Can perm="transfers.create"><Button icon={<Truck size={16} />} onClick={() => setOpen(true)}>{t('inv2.transfer.new')}</Button></Can>} />
        <SubNav />
        <DataTable rows={tenant.transfers} columns={cols} rowKey={(x) => x.id} emptyTitle={t('common.empty')} />
        <Modal open={open} onClose={() => setOpen(false)} title={t('inv2.transfer.new')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!from || !to || from === to || lines.some((l) => !l.productId || l.qty <= 0 || avail(l.productId, from) < l.qty)} onClick={() => { run(() => create(from, to, lines), { title: t('inv2.transfer.created') }); setOpen(false); setLines([{ productId: '', qty: 1 }]) }}>{t('common.create')}</Button></>}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label={t('inv2.transfer.from')}><Select value={from} onChange={(e) => setFrom(e.target.value)}><option value="">—</option>{tenant.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
              <Field label={t('inv2.transfer.to')}><Select value={to} onChange={(e) => setTo(e.target.value)}><option value="">—</option>{tenant.warehouses.filter((w) => w.id !== from).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select></Field>
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_90px_auto] items-end gap-2">
                <Field label={i === 0 ? t('sales.field.product') : undefined}><Select value={l.productId} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, productId: e.target.value } : x)))}><option value="">—</option>{tenant.products.filter((p) => p.type !== 'SERVICE' && (!from || avail(p.id, from) > 0)).map((p) => <option key={p.id} value={p.id}>{p.name} ({from ? num(avail(p.id, from)) : '—'})</option>)}</Select></Field>
                <Field label={i === 0 ? t('common.qty') : undefined}><Input type="number" value={l.qty} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, qty: Number(e.target.value) } : x)))} invalid={!!l.productId && !!from && avail(l.productId, from) < l.qty} /></Field>
                <Button variant="ghost" size="sm" onClick={() => setLines(lines.length > 1 ? lines.filter((_, k) => k !== i) : lines)}>×</Button>
              </div>
            ))}
            <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setLines([...lines, { productId: '', qty: 1 }])}>{t('common.add')}</Button>
          </div>
        </Modal>
      </div>
    </PlanGate>
  )
}

/* ------------------------------------------------------------ Counts */

function CountsPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const post = useAppStore((s) => s.postStockCount)
  const run = useAction()
  const [wh, setWh] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  if (!tenant || !can('stockcounts.view')) return <AccessDenied perm="stockcounts.view" />
  const rows = wh ? tenant.stock.filter((s) => s.warehouseId === wh).map((s) => ({ s, p: tenant.products.find((x) => x.id === s.productId)! })).filter((r) => r.p) : []
  const diffs = rows.filter((r) => counts[r.s.productId] !== undefined && counts[r.s.productId] !== r.s.onHand)
  return (
    <PlanGate feature="accounting.full">
      <div className="space-y-6">
        <ReadOnlyBanner />
        <SectionHeader title={t('inv2.counts')} sub="Tizim qoldig‘ini haqiqiy sanoq bilan solishtiring — farq avtomatik tuzatiladi." />
        <SubNav />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <Card padded={false}>
            <div className="flex items-center gap-3 border-b p-3">
              <Select value={wh} onChange={(e) => { setWh(e.target.value); setCounts({}) }} className="h-9 w-64"><option value="">{t('inv2.field.warehouse')}…</option>{tenant.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
              {wh && <span className="text-xs text-muted">{rows.length} pozitsiya</span>}
            </div>
            {wh ? (
              <div className="max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-surface text-2xs uppercase text-faint"><tr className="border-b"><th className="px-4 py-2 text-left font-medium">{t('sales.field.product')}</th><th className="px-4 py-2 text-right font-medium">{t('inv2.count.system')}</th><th className="px-4 py-2 text-right font-medium">{t('inv2.count.counted')}</th><th className="px-4 py-2 text-right font-medium">{t('inv2.count.diff')}</th></tr></thead>
                  <tbody>{rows.map((r) => { const c = counts[r.s.productId]; const d = c === undefined ? 0 : c - r.s.onHand; return (
                    <tr key={r.s.id} className="border-b last:border-0"><td className="px-4 py-2">{r.p.name}<span className="ml-2 text-2xs text-faint">{r.p.sku}</span></td><td className="px-4 py-2 text-right tnum text-muted">{num(r.s.onHand, 2)}</td><td className="px-4 py-2 text-right"><input type="number" value={c ?? ''} placeholder={String(r.s.onHand)} onChange={(e) => setCounts({ ...counts, [r.s.productId]: Number(e.target.value) })} className="h-8 w-24 rounded-lg border bg-raised/60 px-2 text-right text-sm tnum outline-none focus:border-brand/50" /></td><td className={cx('px-4 py-2 text-right tnum font-medium', d > 0 ? 'text-success' : d < 0 ? 'text-danger' : 'text-faint')}>{d ? (d > 0 ? '+' : '') + num(d, 2) : '—'}</td></tr>
                  ) })}</tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center text-sm text-muted">{t('inv2.field.warehouse')} tanlang.</div>
            )}
          </Card>
          <div className="space-y-4">
            <Card>
              <p className="text-sm font-semibold">{t('inv2.count.diff')}</p>
              <p className="mt-1 text-3xl font-semibold tnum">{diffs.length}</p>
              <p className="text-xs text-muted">pozitsiyada farq</p>
              <Can perm="stockcounts.create"><Button block className="mt-4" icon={<ClipboardCheck size={16} />} disabled={!wh || !diffs.length} onClick={() => { run(() => post(wh, diffs.map((r) => ({ productId: r.s.productId, countedQty: counts[r.s.productId] }))), { title: t('inv2.count.post') }); setCounts({}) }}>{t('inv2.count.post')}</Button></Can>
            </Card>
            <Card padded={false}>
              <p className="px-4 py-3 text-sm font-semibold">Tarix</p>
              <ul className="divide-y">{tenant.stockCounts.slice(0, 6).map((c) => <li key={c.id} className="flex items-center justify-between px-4 py-2 text-sm"><span>{c.number} · {tenant.warehouses.find((w) => w.id === c.warehouseId)?.code}</span><span className="text-xs text-faint">{fmtDate(c.postedAt, lang)}</span></li>)}{!tenant.stockCounts.length && <li className="px-4 py-3 text-sm text-faint">{t('common.empty')}</li>}</ul>
            </Card>
          </div>
        </div>
      </div>
    </PlanGate>
  )
}

