import { useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Building2, Check, CreditCard, Eye, EyeOff, KeyRound, Link2, Lock, Plus, RotateCcw, ScrollText, ShieldCheck, Smartphone, Users } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Avatar, Badge, Button, Card, ConfirmModal, Drawer, Field, Input, Modal, Progress, SectionHeader, Select, StatusBadge, Tabs, Toggle, Segmented } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AccessDenied, Can, PlanGate, ReadOnlyBanner } from '@/ui/gates'
import { cx, fmtDate, money, relTime } from '@/core/utils/format'
import type { AuditLog, Member } from '@/core/domain/entities'
import { ACTIONS, DATA_SCOPES, ELEVATED_ROLES, MODULES, ROLE_ORDER, effectivePermissions, type DataScope, type Module, type PermissionKey, type RoleId } from '@/core/rbac/permissions'
import { PLANS, PLAN_FEATURES, annualSaving, priceFor, type FeatureId } from '@/core/billing/plans'
import type { BillingCycle, PlanId } from '@/core/domain/enums'
import { BillingToggle, PricingCards, ComparisonTable } from '@/pages/public/PricingSection'
import { LangSwitch, ThemeToggle } from '@/app/layouts/PublicLayout'
import type { DictKey } from '@/core/i18n/uz'

export default function SettingsPages() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="company" element={<CompanyPage />} />
      <Route path="members" element={<MembersPage />} />
      <Route path="permissions" element={<PermissionsPage />} />
      <Route path="branches" element={<BranchesPage />} />
      <Route path="billing" element={<BillingPage />} />
      <Route path="integrations" element={<IntegrationsPage />} />
      <Route path="security" element={<SecurityPage />} />
      <Route path="audit" element={<AuditPage />} />
      <Route path="*" element={<Navigate to="/app/settings" replace />} />
    </Routes>
  )
}

function SubNav() {
  const t = useT()
  const nav = useNavigate()
  const { can } = useSession()
  const path = window.location.pathname.split('/').pop() as string
  const tabs = [
    { value: 'settings', label: t('nav.overview') },
    can('settings.view') && { value: 'company', label: t('set.company') },
    can('members.view') && { value: 'members', label: t('set.members') },
    can('roles.view') && { value: 'permissions', label: t('set.permissions') },
    can('branches.view') && { value: 'branches', label: t('set.branches') },
    can('billing.view') && { value: 'billing', label: t('billing.title') },
    can('integrations.view') && { value: 'integrations', label: t('set.integrations') },
    { value: 'security', label: t('set.security') },
    can('audit.view') && { value: 'audit', label: t('audit.title') },
  ].filter(Boolean) as { value: string; label: string }[]
  return <Tabs value={path} onChange={(v) => nav(v === 'settings' ? '/app/settings' : `/app/settings/${v}`)} tabs={tabs} />
}

function Overview() {
  const t = useT()
  const { tenant, can, ent } = useSession()
  if (!tenant) return null
  const cards = [
    { to: 'company', icon: Building2, title: t('set.company'), sub: tenant.company.legalName, ok: can('settings.view') },
    { to: 'members', icon: Users, title: t('set.members'), sub: `${tenant.members.length} xodim · ${new Set(tenant.members.map((m) => m.role)).size} rol`, ok: can('members.view') },
    { to: 'permissions', icon: ShieldCheck, title: t('set.permissions'), sub: t('set.permissions.sub'), ok: can('roles.view') },
    { to: 'branches', icon: Building2, title: t('set.branches'), sub: `${tenant.branches.length} filial · ${tenant.warehouses.length} ombor`, ok: can('branches.view') },
    { to: 'billing', icon: CreditCard, title: t('billing.title'), sub: `${PLANS[ent.planId].name} · ${t(`sub.${ent.status}` as DictKey)}`, ok: can('billing.view') },
    { to: 'integrations', icon: Link2, title: t('set.integrations'), sub: t('set.integrations.sub'), ok: can('integrations.view') },
    { to: 'security', icon: KeyRound, title: t('set.security'), sub: t('set.security.sessions'), ok: true },
    { to: 'audit', icon: ScrollText, title: t('audit.title'), sub: `${tenant.audit.length} yozuv`, ok: can('audit.view') },
  ].filter((c) => c.ok)
  return (
    <div className="space-y-6">
      <SectionHeader title={t('set.title')} sub={t('set.sub')} />
      <SubNav />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => <Link key={c.to} to={`/app/settings/${c.to}`} className="card sheen group p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift"><span className="grid h-10 w-10 place-items-center rounded-xl bg-line/6 text-muted transition group-hover:bg-brand/12 group-hover:text-brand"><c.icon size={18} /></span><h3 className="mt-3 font-semibold">{c.title}</h3><p className="mt-1 truncate text-xs text-muted">{c.sub}</p></Link>)}
      </div>
      <Card>
        <p className="text-sm font-semibold">{t('set.appearance')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-6"><div className="flex items-center gap-3 text-sm"><span className="text-muted">{t('set.appearance.theme')}</span><ThemeToggle /></div><div className="flex items-center gap-3 text-sm"><span className="text-muted">{t('set.appearance.language')}</span><LangSwitch size="md" /></div></div>
      </Card>
    </div>
  )
}

/* --------------------------------------------------------------- Company */

function CompanyPage() {
  const t = useT()
  const { tenant, can } = useSession()
  const update = useAppStore((s) => s.updateCompany)
  const run = useAction()
  const [f, setF] = useState(() => ({ ...tenant!.company }))
  if (!tenant || !can('settings.view')) return <AccessDenied perm="settings.view" />
  const ro = !can('settings.edit')
  const F = (k: keyof typeof f, label: string, props: Record<string, unknown> = {}) => <Field label={label}><Input value={(f[k] as string) ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} disabled={ro} {...props} /></Field>
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('set.company')} sub={t('set.company.sub')} actions={!ro && <Button icon={<Check size={16} />} onClick={() => run(() => update({ name: f.name, legalName: f.legalName, tin: f.tin, vatCertificate: f.vatCertificate, directorName: f.directorName, chiefAccountantName: f.chiefAccountantName, phone: f.phone, email: f.email, address: f.address, bankName: f.bankName, bankAccount: f.bankAccount, bankMfo: f.bankMfo, vatRate: Number(f.vatRate), turnoverTaxRate: Number(f.turnoverTaxRate) }), { title: t('set.company.saved') })}>{t('common.save')}</Button>} />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><p className="mb-4 text-sm font-semibold">Rekvizitlar</p><div className="grid gap-3 sm:grid-cols-2">{F('name', t('set.company.name'))}{F('legalName', t('set.company.legal'))}{F('tin', t('set.company.tin'))}{F('vatCertificate', t('set.company.vat'))}{F('directorName', t('set.company.director'))}{F('chiefAccountantName', t('set.company.chief'))}{F('phone', t('onb.field.phone'))}{F('email', t('onb.field.email'))}<Field label="Yuridik manzil" className="sm:col-span-2"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} disabled={ro} /></Field></div></Card>
        <div className="space-y-4">
          <Card><p className="mb-4 text-sm font-semibold">Bank</p><div className="grid gap-3">{F('bankName', t('set.company.bank'))}{F('bankAccount', t('set.company.account'))}{F('bankMfo', t('set.company.mfo'))}</div></Card>
          <Card><p className="mb-4 text-sm font-semibold">Soliq va valyuta</p><div className="grid grid-cols-3 gap-3"><Field label={t('set.company.currency')}><Input value={f.baseCurrency} disabled /></Field><Field label={t('set.company.vatRate')}><Input type="number" value={f.vatRate} onChange={(e) => setF({ ...f, vatRate: Number(e.target.value) })} disabled={ro} /></Field><Field label={t('set.company.turnoverRate')}><Input type="number" value={f.turnoverTaxRate} onChange={(e) => setF({ ...f, turnoverTaxRate: Number(e.target.value) })} disabled={ro} /></Field></div></Card>
          <Card className="text-xs text-muted"><p className="font-medium text-ink">{t('nav.company')} ID</p><p className="mt-1 font-mono">{tenant.company.tenantId}</p><p className="mt-2">{t('landing.security.tenant.d')}</p></Card>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Members */

function MembersPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can, ent, member: me } = useSession()
  const invite = useAppStore((s) => s.inviteMember)
  const update = useAppStore((s) => s.updateMember)
  const run = useAction()
  const [open, setOpen] = useState(false)
  const [sel, setSel] = useState<Member | null>(null)
  const [f, setF] = useState({ fullName: '', email: '', phone: '+998 ', role: 'SALES_EMPLOYEE' as RoleId, dataScope: 'SELF' as Member['dataScope'] })
  if (!tenant || !can('members.view')) return <AccessDenied perm="members.view" />
  const active = tenant.members.filter((m) => m.status !== 'SUSPENDED').length
  const lim = ent.limits.users
  // Non-owners cannot even see the elevated roles list details (spec §11).
  const rows = ['OWNER', 'ADMIN'].includes(me!.role) ? tenant.members : tenant.members.filter((m) => !ELEVATED_ROLES.includes(m.role) || m.id === me!.id)
  const cols: Column<Member>[] = [
    { key: 'n', header: t('inv2.field.name'), cell: (m) => <div className="flex items-center gap-3"><Avatar name={m.fullName} size="sm" tone={m.avatarTone} /><span className="min-w-0"><span className="block truncate font-medium">{m.fullName}{m.id === me!.id && <span className="ml-1.5 text-2xs text-faint">(siz)</span>}</span><span className="text-2xs text-faint">{m.email}</span></span></div>, sortValue: (m) => m.fullName },
    { key: 'r', header: t('set.members.role'), cell: (m) => <Badge tone={m.role === 'OWNER' || m.role === 'ADMIN' ? 'brand' : 'muted'}>{t(`role.${m.role}` as DictKey)}</Badge>, sortValue: (m) => ROLE_ORDER.indexOf(m.role) },
    { key: 'sc', header: t('set.members.scope'), cell: (m) => <span className="text-xs text-muted">{t(`set.scope.${m.dataScope}` as DictKey)}</span>, hideBelow: 'md' },
    { key: 'ov', header: t('set.permissions.override'), cell: (m) => { const n = Object.keys(m.permissionOverrides).length; return n ? <Badge tone="warning" size="xs">{n}</Badge> : <span className="text-2xs text-faint">—</span> }, hideBelow: 'lg', align: 'center' },
    { key: 'la', header: t('set.members.lastActive'), cell: (m) => <span className="text-xs text-muted">{relTime(m.lastActiveAt, lang)}</span>, sortValue: (m) => m.lastActiveAt ?? '', hideBelow: 'md' },
    { key: 's', header: t('common.status'), cell: (m) => <StatusBadge status={m.status} label={t(`set.members.status.${m.status}` as DictKey)} />, align: 'right' },
  ]
  return (
    <div className="space-y-6">
      <ReadOnlyBanner />
      <SectionHeader title={t('set.members')} sub={t('set.members.sub')} actions={<Can perm="members.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)} disabled={lim !== null && active >= lim}>{t('set.members.invite')}</Button></Can>} />
      <SubNav />
      <Card className="flex flex-wrap items-center gap-4 py-3">
        <div className="flex-1"><div className="flex items-center justify-between text-xs"><span className="text-muted">{t('billing.limit.users')}</span><span className="tnum">{active}/{lim ?? '∞'}</span></div><Progress value={lim ? (active / lim) * 100 : 8} className="mt-1.5" tone={lim && active >= lim ? 'danger' : 'brand'} /></div>
        {lim !== null && active >= lim && can('billing.edit') && <Link to="/app/settings/billing?upgrade=1"><Button size="sm" variant="gold" icon={<ArrowUpRight size={14} />}>{t('access.plan.upgrade')}</Button></Link>}
      </Card>
      <DataTable rows={rows} columns={cols} rowKey={(m) => m.id} searchable={(m) => `${m.fullName} ${m.email} ${m.role}`} onRowClick={(m) => can('members.edit') && setSel(m)} initialSort={{ key: 'r', dir: 'asc' }} />
      <MemberDrawer m={sel} onClose={() => setSel(null)} />
      <Modal open={open} onClose={() => setOpen(false)} title={t('set.members.invite')} footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!f.fullName || !f.email} onClick={() => { const r = run(() => invite(f), { title: t('common.saved'), body: `${f.fullName} — ${t(`role.${f.role}` as DictKey)}` }); if (r) { setOpen(false); update(r.id, { status: 'ACTIVE' }) } }}>{t('set.members.invite')}</Button></>}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('onb.field.fullName')} required className="sm:col-span-2"><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoFocus /></Field>
          <Field label={t('onb.field.email')} required><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label={t('onb.field.phone')}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label={t('set.members.role')}><Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as RoleId })}>{ROLE_ORDER.filter((r) => r !== 'OWNER' && (me!.role === 'OWNER' || r !== 'ADMIN')).map((r) => <option key={r} value={r}>{t(`role.${r}` as DictKey)}</option>)}</Select></Field>
          <Field label={t('set.members.scope')}><Select value={f.dataScope} onChange={(e) => setF({ ...f, dataScope: e.target.value as Member['dataScope'] })}>{(['ALL', 'BRANCH', 'WAREHOUSE', 'SELF'] as const).map((s) => <option key={s} value={s}>{t(`set.scope.${s}` as DictKey)}</option>)}</Select></Field>
          <div className="sm:col-span-2 rounded-xl border bg-raised/40 p-3 text-xs text-muted"><ShieldCheck size={12} className="mr-1 inline text-brand" />{t(`role.${ROLE_KEY[f.role]}.summary` as DictKey)}</div>
        </div>
      </Modal>
    </div>
  )
}

const ROLE_KEY: Record<RoleId, string> = { OWNER: 'owner', ADMIN: 'admin', DIRECTOR: 'director', CHIEF_ACCOUNTANT: 'chiefAccountant', ACCOUNTANT: 'accountant', SALES_MANAGER: 'salesManager', SALES_EMPLOYEE: 'salesEmployee', WAREHOUSE_MANAGER: 'warehouseManager', WAREHOUSE_EMPLOYEE: 'warehouseEmployee', PURCHASING_MANAGER: 'purchasingManager', HR_MANAGER: 'hrManager', PRODUCTION_MANAGER: 'productionManager', FACTORY_WORKER: 'factoryWorker', CASHIER: 'cashier', AUDITOR: 'auditor', CUSTOM: 'custom' }

function MemberDrawer({ m, onClose }: { m: Member | null; onClose: () => void }) {
  const t = useT()
  const { tenant, member: me, can } = useSession()
  const update = useAppStore((s) => s.updateMember)
  const setOverride = useAppStore((s) => s.setPermissionOverride)
  const run = useAction()
  if (!m || !tenant) return null
  const live = tenant.members.find((x) => x.id === m.id) ?? m
  const eff = effectivePermissions(live.role, live.permissionOverrides)
  const base = effectivePermissions(live.role)
  const isOwner = live.role === 'OWNER'
  return (
    <Drawer open={!!m} onClose={onClose} title={live.fullName} width="max-w-2xl">
      <div className="space-y-5 text-sm">
        <div className="flex items-center gap-3"><Avatar name={live.fullName} size="lg" tone={live.avatarTone} /><div><p className="font-semibold">{live.fullName}</p><p className="text-xs text-muted">{live.email} · {live.phone}</p></div><StatusBadge status={live.status} label={t(`set.members.status.${live.status}` as DictKey)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('set.members.role')}><Select value={live.role} disabled={isOwner || !can('members.edit')} onChange={(e) => run(() => update(live.id, { role: e.target.value as RoleId }), { title: t('set.permissions.saved') })}>{ROLE_ORDER.filter((r) => r !== 'OWNER' && (me!.role === 'OWNER' || r !== 'ADMIN')).map((r) => <option key={r} value={r}>{t(`role.${r}` as DictKey)}</option>)}{isOwner && <option value="OWNER">{t('role.OWNER')}</option>}</Select></Field>
          <Field label={t('set.members.scope')}><Select value={live.dataScope} disabled={isOwner || !can('members.edit')} onChange={(e) => run(() => update(live.id, { dataScope: e.target.value as Member['dataScope'] }), { title: t('common.saved') })}>{(['ALL', 'BRANCH', 'WAREHOUSE', 'SELF'] as const).map((s) => <option key={s} value={s}>{t(`set.scope.${s}` as DictKey)}</option>)}</Select></Field>
        </div>
        <p className="rounded-xl border bg-raised/40 p-3 text-xs text-muted">{t(`role.${ROLE_KEY[live.role]}.summary` as DictKey)}</p>
        {!isOwner && can('roles.edit') && (
          <div>
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-faint">{t('set.permissions.sensitive')}</p>{Object.keys(live.permissionOverrides).length > 0 && <button onClick={() => { for (const k of Object.keys(live.permissionOverrides)) setOverride(live.id, k as PermissionKey, null) }} className="inline-flex items-center gap-1 text-2xs text-muted hover:text-ink"><RotateCcw size={10} /> {t('set.permissions.reset')}</button>}</div>
            <p className="mb-3 text-xs text-muted">{t('set.permissions.sensitiveNote')}</p>
            <ul className="divide-y rounded-xl border">
              {DATA_SCOPES.map((s) => { const on = eff.has(s); const inherited = base.has(s) === on && !(s in live.permissionOverrides); return (
                <li key={s} className="flex items-center justify-between gap-3 px-3 py-2"><span className="min-w-0"><span className="block">{SCOPE_LABEL[s]}</span><span className="text-2xs text-faint">{inherited ? t('set.permissions.inherited') : t('set.permissions.override')} · <code>{s}</code></span></span><Toggle size="sm" checked={on} onChange={(v) => run(() => setOverride(live.id, s, v === base.has(s) ? null : v), v && !base.has(s) ? { title: t('set.permissions.saved'), body: t('set.permissions.warn') } : { title: t('set.permissions.saved') })} /></li>
              ) })}
            </ul>
          </div>
        )}
        {can('members.edit') && !isOwner && live.id !== me?.id && <div className="flex gap-2">{live.status === 'SUSPENDED' ? <Button size="sm" onClick={() => run(() => update(live.id, { status: 'ACTIVE' }), { title: t('common.saved') })}>{t('set.members.activate')}</Button> : <Button size="sm" variant="danger" onClick={() => run(() => update(live.id, { status: 'SUSPENDED' }), { title: t('common.saved') })}>{t('set.members.suspend')}</Button>}</div>}
      </div>
    </Drawer>
  )
}

export const SCOPE_LABEL: Record<DataScope, string> = {
  'finance.revenue.view': 'Umumiy daromadni ko‘rish',
  'finance.expense.view': 'Umumiy xarajatlarni ko‘rish',
  'finance.profit.view': 'Foyda va marjani ko‘rish',
  'finance.cash.view': 'Kassa qoldig‘ini ko‘rish',
  'finance.bank.view': 'Bank hisoblarini ko‘rish',
  'finance.payroll.view': 'Ish haqi fondini ko‘rish',
  'finance.salary.others.view': 'Boshqalarning maoshini ko‘rish',
  'finance.salary.self.view': 'O‘z maoshini ko‘rish',
  'finance.tax.view': 'Soliq majburiyatlarini ko‘rish',
  'finance.cost.view': 'Tannarx va marjani ko‘rish',
  'finance.executive.view': 'Boshqaruv hisobotlari',
  'finance.counterparty.balances.view': 'Kontragent balanslari',
}

/* ---------------------------------------------------------- Permissions */

const MODULE_LABEL: Partial<Record<Module, string>> = { dashboard: 'Boshqaruv paneli', sales: 'Savdo', pos: 'Tezkor savdo', invoices: 'Fakturalar', payments: 'To‘lovlar', products: 'Mahsulotlar', stock: 'Qoldiqlar', warehouses: 'Omborlar', transfers: 'Ko‘chirmalar', stockcounts: 'Inventarizatsiya', purchasing: 'Xarid', suppliers: 'Ta‘minotchilar', customers: 'Mijozlar', crm: 'CRM', accounting: 'Buxgalteriya', ledger: 'Bosh daftar', journal: 'O‘tkazmalar', chartofaccounts: 'Hisoblar rejasi', reconciliation: 'Bank sverkasi', taxes: 'Soliqlar', periodclose: 'Davr yopish', reports: 'Hisobotlar', manufacturing: 'Ishlab chiqarish', bom: 'Retsept', production: 'Buyurtmalar (IC)', machines: 'Uskunalar', quality: 'Sifat', hr: 'HR', employees: 'Xodimlar', attendance: 'Davomat', leave: 'Ta‘til', payroll: 'Ish haqi', departments: 'Bo‘limlar', projects: 'Loyihalar', fixedassets: 'Asosiy vositalar', budgeting: 'Byudjet', ai: 'AI CFO', notifications: 'Bildirishnomalar', settings: 'Sozlamalar', members: 'Xodimlar (tizim)', roles: 'Rollar', branches: 'Filiallar', billing: 'Obuna', audit: 'Audit', integrations: 'Integratsiyalar', documents: 'Hujjatlar' }
const ACTION_LABEL: Record<string, string> = { view: 'Ko‘rish', create: 'Yaratish', edit: 'Tahrirlash', delete: 'O‘chirish', approve: 'Tasdiqlash', export: 'Eksport' }

function PermissionsPage() {
  const t = useT()
  const { tenant, can, member: me } = useSession()
  const [mode, setMode] = useState<'roles' | 'member'>('roles')
  const [memberId, setMemberId] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleId[]>(['OWNER', 'DIRECTOR', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'SALES_MANAGER', 'SALES_EMPLOYEE', 'WAREHOUSE_EMPLOYEE', 'FACTORY_WORKER'])
  const setOverride = useAppStore((s) => s.setPermissionOverride)
  const run = useAction()
  if (!tenant || !can('roles.view')) return <AccessDenied perm="roles.view" />
  const sets = useMemo(() => Object.fromEntries(ROLE_ORDER.map((r) => [r, effectivePermissions(r)])) as Record<RoleId, Set<PermissionKey>>, [])
  const target = tenant.members.find((m) => m.id === memberId)
  const eff = target ? effectivePermissions(target.role, target.permissionOverrides) : null
  const base = target ? effectivePermissions(target.role) : null
  const editable = mode === 'member' && !!target && target.role !== 'OWNER' && can('roles.edit')
  const visibleModules = MODULES.filter((m) => !['documents', 'projects', 'fixedassets', 'budgeting', 'departments', 'crm'].includes(m))
  return (
    <PlanGate feature="permissions.roles">
      <div className="space-y-6">
        <SectionHeader title={t('set.permissions')} sub={t('set.permissions.sub')} actions={<Segmented value={mode} onChange={setMode} options={[{ value: 'roles', label: t('set.permissions.role') }, { value: 'member', label: t('set.permissions.member') }]} />} />
        <SubNav />
        {mode === 'member' && (
          <Card className="flex flex-wrap items-center gap-3 py-3">
            <Select value={memberId} onChange={(e) => setMemberId(e.target.value)} className="h-9 w-72"><option value="">{t('set.permissions.member')}…</option>{tenant.members.filter((m) => ['OWNER', 'ADMIN'].includes(me!.role) || !ELEVATED_ROLES.includes(m.role)).map((m) => <option key={m.id} value={m.id}>{m.fullName} · {t(`role.${m.role}` as DictKey)}</option>)}</Select>
            {target && <span className="text-xs text-muted">{Object.keys(target.permissionOverrides).length} {t('set.permissions.override').toLowerCase()} · {editable ? 'Kalitni bosib o‘zgartiring' : t('set.permissions.inherited')}</span>}
          </Card>
        )}
        {mode === 'roles' && (
          <div className="flex flex-wrap gap-1.5">{ROLE_ORDER.filter((r) => r !== 'CUSTOM').map((r) => <button key={r} onClick={() => setRoleFilter((f) => (f.includes(r) ? f.filter((x) => x !== r) : [...f, r]))} className={cx('rounded-full border px-3 py-1 text-xs transition', roleFilter.includes(r) ? 'border-brand bg-brand/10 text-brand' : 'text-muted hover:bg-line/6')}>{t(`role.${r}` as DictKey)}</button>)}</div>
        )}
        {/* Sensitive data scopes first — the most important rows */}
        <Card padded={false}>
          <div className="border-b px-5 py-3"><p className="flex items-center gap-2 text-sm font-semibold"><Lock size={14} className="text-danger" /> {t('set.permissions.sensitive')}</p><p className="text-xs text-muted">{t('set.permissions.sensitiveNote')}</p></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-raised/40 text-2xs uppercase text-faint"><th className="px-5 py-2 text-left font-medium">Ma‘lumot</th>{mode === 'roles' ? roleFilter.map((r) => <th key={r} className="px-2 py-2 text-center font-medium">{t(`role.${r}` as DictKey)}</th>) : <th className="px-2 py-2 text-center font-medium">{target?.fullName ?? '—'}</th>}</tr></thead><tbody>{DATA_SCOPES.map((s) => <tr key={s} className="border-b last:border-0"><td className="px-5 py-2">{SCOPE_LABEL[s]}<code className="ml-2 text-2xs text-faint">{s}</code></td>{mode === 'roles' ? roleFilter.map((r) => <td key={r} className="px-2 py-2 text-center">{sets[r].has(s) ? <Eye size={15} className="mx-auto text-brand" /> : <EyeOff size={15} className="mx-auto text-faint" />}</td>) : <td className="px-2 py-2 text-center">{eff ? <button disabled={!editable} onClick={() => run(() => setOverride(memberId, s, eff.has(s) ? (base!.has(s) ? false : null) : base!.has(s) ? null : true), { title: t('set.permissions.saved') })} className={cx('rounded-lg p-1', editable && 'hover:bg-line/8')}>{eff.has(s) ? <Eye size={16} className={cx('mx-auto', base!.has(s) ? 'text-brand' : 'text-warning')} /> : <EyeOff size={16} className={cx('mx-auto', base!.has(s) ? 'text-danger' : 'text-faint')} />}</button> : '—'}</td>}</tr>)}</tbody></table></div>
        </Card>
        <Card padded={false}>
          <div className="border-b px-5 py-3"><p className="text-sm font-semibold">{t('set.permissions.actions')}</p><p className="text-xs text-muted">{ACTIONS.map((a) => ACTION_LABEL[a]).join(' · ')}</p></div>
          <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b bg-raised/40 text-2xs uppercase text-faint"><th className="px-5 py-2 text-left font-medium">Modul</th>{mode === 'roles' ? roleFilter.map((r) => <th key={r} className="px-2 py-2 text-center font-medium">{t(`role.${r}` as DictKey)}</th>) : ACTIONS.map((a) => <th key={a} className="px-2 py-2 text-center font-medium">{ACTION_LABEL[a]}</th>)}</tr></thead><tbody>{visibleModules.map((m) => <tr key={m} className="border-b last:border-0"><td className="px-5 py-2 font-medium">{MODULE_LABEL[m] ?? m}</td>{mode === 'roles' ? roleFilter.map((r) => { const acts = ACTIONS.filter((a) => sets[r].has(`${m}.${a}` as PermissionKey)); return <td key={r} className="px-2 py-2 text-center">{acts.length === 0 ? <span className="text-faint">—</span> : acts.length === ACTIONS.length ? <Badge tone="brand" size="xs">Hammasi</Badge> : <span className="inline-flex flex-wrap justify-center gap-0.5">{acts.map((a) => <span key={a} title={ACTION_LABEL[a]} className="rounded bg-line/8 px-1 text-[10px] uppercase text-muted">{a[0]}</span>)}</span>}</td> }) : ACTIONS.map((a) => { const k = `${m}.${a}` as PermissionKey; const on = eff?.has(k) ?? false; const b = base?.has(k) ?? false; return <td key={a} className="px-2 py-1.5 text-center">{eff ? <button disabled={!editable} onClick={() => run(() => setOverride(memberId, k, on ? (b ? false : null) : b ? null : true), { title: t('set.permissions.saved') })} className={cx('grid h-6 w-6 place-items-center rounded-md transition', on ? (b ? 'bg-brand/15 text-brand' : 'bg-warning/15 text-warning') : b ? 'bg-danger/10 text-danger' : 'text-faint', editable && 'hover:ring-1 hover:ring-brand/40')}>{on ? <Check size={12} /> : <span className="text-[10px]">—</span>}</button> : '—'}</td> })}</tr>)}</tbody></table></div>
          {mode === 'member' && <div className="flex flex-wrap gap-4 border-t px-5 py-2 text-2xs text-faint"><span><span className="inline-block h-2 w-2 rounded-sm bg-brand/60" /> {t('set.permissions.inherited')}</span><span><span className="inline-block h-2 w-2 rounded-sm bg-warning/60" /> Qo‘shilgan</span><span><span className="inline-block h-2 w-2 rounded-sm bg-danger/60" /> Olib tashlangan</span></div>}
        </Card>
      </div>
    </PlanGate>
  )
}

/* --------------------------------------------------------------- Branches */

function BranchesPage() {
  const t = useT()
  const { tenant, can, ent } = useSession()
  const create = useAppStore((s) => s.createBranch)
  const run = useAction()
  const [open, setOpen] = useState(false)
  const [f, setF] = useState({ name: '', code: '', city: '', address: '', phone: '+998 ' })
  if (!tenant || !can('branches.view')) return <AccessDenied perm="branches.view" />
  return (
    <PlanGate feature="branches.multi" inline>
      <div className="space-y-6">
        <SectionHeader title={t('set.branches')} sub={`${tenant.branches.length} / ${ent.limits.branches ?? '∞'}`} actions={<Can perm="branches.create"><Button icon={<Plus size={16} />} onClick={() => setOpen(true)} disabled={ent.limits.branches !== null && tenant.branches.length >= ent.limits.branches}>{t('set.branches.new')}</Button></Can>} />
        <SubNav />
        <div className="grid gap-4 md:grid-cols-2">{tenant.branches.map((b) => <Card key={b.id}><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-sky/12 text-sky"><Building2 size={18} /></span><Badge tone="muted">{b.code}</Badge></div><h3 className="mt-3 font-semibold">{b.name}</h3><p className="text-xs text-muted">{b.city} · {b.address} · {b.phone}</p><div className="mt-3 flex gap-2 text-xs text-muted"><Badge tone="muted">{tenant.warehouses.filter((w) => w.branchId === b.id).length} ombor</Badge><Badge tone="muted">{tenant.members.filter((m) => m.branchIds.includes(b.id)).length} xodim</Badge></div></Card>)}</div>
        <Modal open={open} onClose={() => setOpen(false)} title={t('set.branches.new')} size="sm" footer={<><Button variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button disabled={!f.name || !f.code} onClick={() => { run(() => create(f), { title: t('common.saved') }); setOpen(false) }}>{t('common.create')}</Button></>}><div className="space-y-3"><Field label={t('inv2.field.name')} required><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Kod" required><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} /></Field><Field label={t('onb.field.city')}><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field></div><Field label="Manzil"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field><Field label={t('onb.field.phone')}><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field></div></Modal>
      </div>
    </PlanGate>
  )
}

/* ---------------------------------------------------------------- Billing */

const FEATURE_LABEL: Partial<Record<FeatureId, string>> = { 'accounting.full': 'To‘liq buxgalteriya', invoices: 'Hisob-fakturalar', receivables: 'Debitorlik', payables: 'Kreditorlik', pnl: 'Foyda-zarar', 'balance.sheet': 'Balans', cashflow: 'Pul oqimi', 'branches.multi': 'Filiallar', 'export.excel': 'Excel eksport', 'export.pdf': 'PDF', 'audit.history': 'Audit', 'permissions.roles': 'Rol ruxsatlari', manufacturing: 'Ishlab chiqarish', bom: 'Retsept', 'production.costing': 'Tannarx', machines: 'Uskunalar', hr: 'HR', payroll: 'Ish haqi', 'bank.reconciliation': 'Bank sverkasi', 'ai.full': 'To‘liq AI CFO', 'forecast.cashflow': 'Prognoz', 'companies.multi': 'Ko‘p kompaniya', 'api.access': 'API', 'reports.advanced': 'Kengaytirilgan hisobotlar', 'fixed.assets': 'Asosiy vositalar', 'approval.workflows': 'Tasdiqlash jarayonlari', 'warehouses.unlimited': 'Cheksiz omborlar', 'users.unlimited': 'Cheksiz foydalanuvchi', 'purchasing.basic': 'Xarid' }

function BillingPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { tenant, can, ent } = useSession()
  const changePlan = useAppStore((s) => s.changePlan)
  const cancel = useAppStore((s) => s.cancelSubscription)
  const run = useAction()
  const [cycle, setCycle] = useState<BillingCycle>(tenant?.subscription.billingCycle ?? 'MONTHLY')
  const [upgrade, setUpgrade] = useState(sp.get('upgrade') === '1')
  const [downgrade, setDowngrade] = useState<PlanId | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  if (!tenant || !can('billing.view')) return <AccessDenied perm="billing.view" />
  const sub = tenant.subscription
  const plan = PLANS[sub.planId]
  const used = { users: tenant.members.filter((m) => m.status !== 'SUSPENDED').length, warehouses: tenant.warehouses.length, branches: tenant.branches.length, products: tenant.products.length, ai: tenant.aiQueriesThisMonth }
  const choose = (p: PlanId) => {
    const order: PlanId[] = ['FREE', 'PREMIUM', 'PREMIUM_PLUS']
    if (order.indexOf(p) < order.indexOf(sub.planId) && sub.status === 'ACTIVE') return setDowngrade(p)
    if (p === 'FREE') return run(() => changePlan('FREE', 'MONTHLY'), { title: t('common.saved') })
    nav(`/app/checkout?plan=${p}&cycle=${cycle}`)
  }
  const lost = downgrade ? PLAN_FEATURES[sub.planId].filter((f) => !PLAN_FEATURES[downgrade].includes(f)) : []
  const over = downgrade ? ([['users', used.users, PLANS[downgrade].limits.users], ['warehouses', used.warehouses, PLANS[downgrade].limits.warehouses], ['branches', used.branches, PLANS[downgrade].limits.branches], ['products', used.products, PLANS[downgrade].limits.products]] as const).filter(([, u, l]) => l !== null && u > l) : []
  return (
    <div className="space-y-6">
      <SectionHeader title={t('billing.title')} sub={t('billing.sub')} />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="relative overflow-hidden">
          <div className="aurora opacity-40" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-2xs uppercase tracking-wider text-faint">{t('billing.current')}</p><h3 className="mt-1 text-2xl font-bold">{plan.name}</h3><p className="text-sm text-muted">{money(priceFor(sub.planId, sub.billingCycle))} {sub.billingCycle === 'ANNUAL' ? t('common.perYear') : t('common.perMonth')}</p></div><StatusBadge status={sub.status} label={t(`sub.${sub.status}` as DictKey)} size="md" /></div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div><p className="text-2xs text-faint">{t('billing.cycle')}</p><p className="font-medium">{sub.billingCycle === 'ANNUAL' ? t('plan.billing.annual') : t('plan.billing.monthly')}</p></div>
              <div><p className="text-2xs text-faint">{sub.status === 'TRIAL' ? t('billing.trialLeft') : t('billing.nextPayment')}</p><p className="font-medium">{sub.status === 'TRIAL' ? `${ent.trialDaysLeft} ${t('common.days')}` : fmtDate(sub.renewalAt, lang)}</p></div>
              <div><p className="text-2xs text-faint">{t('billing.status')}</p><p className="font-medium">{t(`pay.${sub.paymentStatus}` as DictKey)}</p></div>
              <div><p className="text-2xs text-faint">{t('billing.seats')}</p><p className="font-medium tnum">{used.users}/{plan.limits.users ?? '∞'}</p></div>
            </div>
            {can('billing.edit') && <div className="mt-5 flex flex-wrap gap-2"><Button icon={<ArrowUpRight size={16} />} onClick={() => setUpgrade((v) => !v)}>{sub.status === 'TRIAL' || sub.status === 'EXPIRED' ? t('trial.cta.choose') : t('billing.upgrade')}</Button>{sub.status === 'ACTIVE' && sub.billingCycle === 'MONTHLY' && sub.planId !== 'FREE' && <Button variant="secondary" onClick={() => nav(`/app/checkout?plan=${sub.planId}&cycle=ANNUAL`)}>{t('billing.changeCycle')} · {money(annualSaving(sub.planId), { compact: true })} tejang</Button>}{sub.status === 'ACTIVE' && can('billing.delete') && <Button variant="ghost" onClick={() => setCancelOpen(true)}>{t('billing.cancel')}</Button>}</div>}
          </div>
        </Card>
        <Card>
          <p className="text-sm font-semibold">{t('billing.usage')}</p>
          <ul className="mt-3 space-y-3">{([['plan.limits.users', used.users, plan.limits.users], ['plan.limits.warehouses', used.warehouses, plan.limits.warehouses], ['plan.limits.branches', used.branches, plan.limits.branches], ['plan.limits.products', used.products, plan.limits.products], ['plan.limits.ai', used.ai, plan.limits.aiQuestionsPerMonth]] as const).map(([k, u, l]) => <li key={k}><div className="flex justify-between text-xs"><span className="text-muted">{t(k as DictKey)}</span><span className="tnum">{u} / {l ?? '∞'}</span></div><Progress value={l ? (u / l) * 100 : 6} className="mt-1" tone={l && u >= l ? 'danger' : l && u / l > 0.8 ? 'warning' : 'brand'} /></li>)}</ul>
        </Card>
      </div>
      {upgrade && can('billing.edit') && (
        <Card className="space-y-6">
          <div className="text-center"><h3 className="text-lg font-semibold">{t('trial.cta.choose')}</h3><p className="text-sm text-muted">{t('plan.trial.note')}</p><div className="mt-4 flex justify-center"><BillingToggle cycle={cycle} onChange={setCycle} size="md" /></div></div>
          <PricingCards cycle={cycle} onChoose={choose} currentPlan={sub.status === 'ACTIVE' ? sub.planId : undefined} compact />
          <details className="group"><summary className="cursor-pointer text-sm text-muted hover:text-ink">{t('plan.compare.title')}</summary><div className="mt-4"><ComparisonTable /></div></details>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false}><div className="px-5 py-4"><p className="text-sm font-semibold">{t('billing.invoices')}</p></div>{tenant.subscriptionInvoices.length === 0 ? <p className="px-5 pb-5 text-sm text-faint">{t('billing.noPayments')}</p> : <ul className="divide-y">{tenant.subscriptionInvoices.map((i) => <li key={i.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span><span className="font-mono text-xs">{i.number}</span><span className="ml-2 text-xs text-muted">{PLANS[i.planId].name} · {fmtDate(i.issuedAt, lang)}</span></span><span className="flex items-center gap-2"><span className="tnum font-medium">{money(i.total)}</span><StatusBadge status={i.status} size="xs" /></span></li>)}</ul>}<p className="border-t px-5 py-2 text-2xs text-faint">{t('checkout.invoice.note')}</p></Card>
        <Card padded={false}><div className="px-5 py-4"><p className="text-sm font-semibold">{t('billing.history')}</p></div>{tenant.paymentAttempts.length === 0 ? <p className="px-5 pb-5 text-sm text-faint">{t('billing.noPayments')}</p> : <ul className="divide-y">{tenant.paymentAttempts.map((p) => <li key={p.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span><Badge tone="muted">{p.provider}</Badge><span className="ml-2 text-xs text-muted">{fmtDate(p.createdAt, lang, true)}</span></span><span className="flex items-center gap-2"><span className="tnum">{money(p.amount)}</span><Badge tone={p.status === 'SIMULATED' ? 'warning' : 'success'} size="xs">{p.status}</Badge></span></li>)}</ul>}</Card>
      </div>
      <Modal open={!!downgrade} onClose={() => setDowngrade(null)} title={t('checkout.downgrade.title')} danger footer={<><Button variant="ghost" onClick={() => setDowngrade(null)}>{t('common.cancel')}</Button><Button variant="danger" onClick={() => { run(() => changePlan(downgrade!, cycle), { title: t('common.saved') }); setDowngrade(null) }}>{t('checkout.downgrade.confirm')}</Button></>}>
        <div className="space-y-4 text-sm"><div className="flex items-start gap-3 rounded-xl border border-danger/30 bg-danger/8 p-3"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" /><p>{plan.name} → {downgrade && PLANS[downgrade].name}. {t('checkout.downgrade.warn')}</p></div><div className="flex flex-wrap gap-1.5">{lost.map((f) => <Badge key={f} tone="danger" size="xs"><Lock size={9} /> {FEATURE_LABEL[f] ?? f}</Badge>)}</div>{over.length > 0 && <div><p className="font-medium">{t('checkout.downgrade.over')}</p><ul className="mt-1 list-inside list-disc text-muted">{over.map(([k, u, l]) => <li key={k}>{t(`plan.limits.${k}` as DictKey)}: {u} → {l}</li>)}</ul></div>}</div>
      </Modal>
      <ConfirmModal open={cancelOpen} onClose={() => setCancelOpen(false)} title={t('checkout.cancel.title')} body={t('checkout.cancel.body')} danger confirmLabel={t('checkout.cancel.confirm')} onConfirm={() => { run(() => cancel(), { title: t('common.saved') }); setCancelOpen(false) }} />
    </div>
  )
}

/* ----------------------------------------------------------- Integrations */

function IntegrationsPage() {
  const t = useT()
  const { tenant, can } = useSession()
  if (!tenant || !can('integrations.view')) return <AccessDenied perm="integrations.view" />
  const items = [
    { k: 'payme', name: t('set.integrations.payme'), desc: 'Obuna to‘lovlari va mijoz to‘lovlarini qabul qilish (Merchant API).' },
    { k: 'click', name: t('set.integrations.click'), desc: 'Click Merchant API orqali to‘lov qabul qilish.' },
    { k: 'uzum', name: t('set.integrations.uzum'), desc: 'Uzum Bank / Uzum Pay orqali to‘lov.' },
    { k: 'efaktura', name: t('set.integrations.efaktura'), desc: 'Didox / Faktura.uz orqali rasmiy elektron hisob-faktura.' },
    { k: 'bank', name: t('set.integrations.bank'), desc: 'Bank ko‘chirmalarini avtomatik olish (Open Banking).' },
    { k: 'telegram', name: t('set.integrations.telegram'), desc: 'Bildirishnomalar va AI CFO savollari Telegram orqali.' },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('set.integrations')} sub={t('set.integrations.sub')} />
      <SubNav />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{items.map((i) => <Card key={i.k}><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-line/6 text-muted"><Link2 size={18} /></span><Badge tone="muted">{t('set.integrations.status.ready')}</Badge></div><h3 className="mt-3 font-semibold">{i.name}</h3><p className="mt-1 text-xs text-muted">{i.desc}</p><div className="mt-4 flex items-center justify-between"><span className="inline-flex items-center gap-1.5 text-xs text-faint"><span className="h-2 w-2 rounded-full bg-faint" /> {t('set.integrations.status.none')}</span><Button size="xs" variant="secondary" disabled>API kalit kiritish</Button></div></Card>)}</div>
      <Card className="border-dashed text-xs text-muted"><ShieldCheck size={13} className="mr-1.5 inline text-brand" />{t('set.integrations.note')}</Card>
    </div>
  )
}

/* --------------------------------------------------------------- Security */

function SecurityPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { user } = useSession()
  const session = useAppStore((s) => s.session)
  const toggle2FA = useAppStore((s) => s.toggle2FA)
  const logout = useAppStore((s) => s.logout)
  const [pw, setPw] = useState({ a: '', b: '' })
  return (
    <div className="space-y-6">
      <SectionHeader title={t('set.security')} sub={t('landing.security.session.d')} />
      <SubNav />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><div className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold"><Smartphone size={15} /> {t('set.security.2fa')}</p><p className="mt-1 text-xs text-muted">{t('set.security.2fa.note')}</p></div><Toggle checked={!!user?.twoFactorEnabled} onChange={() => toggle2FA()} /></div></Card>
        <Card><p className="flex items-center gap-2 text-sm font-semibold"><KeyRound size={15} /> {t('set.security.password')}</p><div className="mt-3 grid grid-cols-2 gap-3"><Input type="password" placeholder="Yangi parol" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /><Input type="password" placeholder="Tasdiqlang" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></div><Button size="sm" className="mt-3" disabled={pw.a.length < 8 || pw.a !== pw.b} onClick={() => setPw({ a: '', b: '' })}>{t('common.save')}</Button></Card>
        <Card padded={false} className="lg:col-span-2"><div className="px-5 py-4"><p className="text-sm font-semibold">{t('set.security.sessions')}</p></div><ul className="divide-y"><li className="flex items-center justify-between px-5 py-3 text-sm"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/12 text-brand"><Smartphone size={16} /></span><span><span className="block font-medium">{navigator.userAgent.includes('Mobile') ? 'Mobil brauzer' : 'Kompyuter brauzeri'} <Badge tone="brand" size="xs" className="ml-1">joriy</Badge></span><span className="text-2xs text-faint">{session ? fmtDate(session.startedAt, lang, true) : ''}</span></span></span><Button size="xs" variant="danger" onClick={logout}>{t('set.security.revoke')}</Button></li></ul></Card>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Audit */

function AuditPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const { tenant, can } = useSession()
  const [only, setOnly] = useState<'ALL' | 'DENIED' | 'PERM'>('ALL')
  if (!tenant || !can('audit.view')) return <AccessDenied perm="audit.view" />
  const rows = tenant.audit.filter((a) => (only === 'ALL' ? true : only === 'DENIED' ? a.action === 'DENIED_ACCESS' : a.action === 'PERMISSION_CHANGE' || a.action === 'PLAN_CHANGE'))
  const cols: Column<AuditLog>[] = [
    { key: 'at', header: t('audit.at'), cell: (a) => <span className="text-muted">{fmtDate(a.createdAt, lang, true)}</span>, sortValue: (a) => a.createdAt },
    { key: 'actor', header: t('audit.actor'), cell: (a) => <span className="font-medium">{a.actorLabel}</span> },
    { key: 'action', header: t('audit.action'), cell: (a) => <Badge tone={a.action === 'DENIED_ACCESS' ? 'danger' : a.action === 'PERMISSION_CHANGE' || a.action === 'PLAN_CHANGE' ? 'warning' : a.action === 'AI_QUERY' ? 'brand' : 'muted'}>{t(`audit.${a.action}` as DictKey)}</Badge> },
    { key: 'e', header: t('audit.entity'), cell: (a) => <span className="text-muted">{a.entityType}</span>, hideBelow: 'md' },
    { key: 's', header: t('audit.summary'), cell: (a) => a.summary },
    { key: 'p', header: t('audit.permission'), cell: (a) => a.permissionRequired ? <code className="text-2xs text-faint">{a.permissionRequired}</code> : '—', hideBelow: 'lg' },
  ]
  return (
    <PlanGate feature="audit.history">
      <div className="space-y-6">
        <SectionHeader title={t('audit.title')} sub={t('audit.sub')} />
        <SubNav />
        <DataTable rows={rows} columns={cols} rowKey={(a) => a.id} searchable={(a) => `${a.actorLabel} ${a.summary} ${a.entityType} ${a.permissionRequired ?? ''}`} pageSize={20}
          toolbar={<Segmented size="sm" value={only} onChange={setOnly} options={[{ value: 'ALL', label: t('common.all') }, { value: 'DENIED', label: t('audit.denied') }, { value: 'PERM', label: t('audit.PERMISSION_CHANGE') }]} />} />
      </div>
    </PlanGate>
  )
}

