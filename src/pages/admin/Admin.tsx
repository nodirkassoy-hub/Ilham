import { useMemo, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, Clock, CreditCard, Database, Eye, HardDrive, Mail, Pause, Play, ShieldAlert, Sparkles, Trash2, Wrench } from 'lucide-react'
import { useT, useI18nStore } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { useAction } from '@/app/useSession'
import { Badge, Button, Card, ConfirmModal, Drawer, Field, Input, Menu, Modal, Progress, SectionHeader, Select, StatusBadge, Tabs, Toggle } from '@/ui/primitives'
import { DataTable, type Column } from '@/ui/DataTable'
import { AreaChart, BarChart, Donut } from '@/ui/charts'
import { cx, fmtDate, fmtMonth, money, num, pct, relTime, sum } from '@/core/utils/format'
import type { PlatformCompanyRow, SupportTicket, SystemLogEntry, User } from '@/core/domain/entities'
import { PLANS, PLAN_LIST } from '@/core/billing/plans'
import type { PlanId } from '@/core/domain/enums'
import type { DictKey } from '@/core/i18n/uz'

export default function AdminPages() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="companies" element={<Companies />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="subscriptions" element={<Subscriptions />} />
      <Route path="plans" element={<Plans />} />
      <Route path="payments" element={<Payments />} />
      <Route path="trials" element={<Trials />} />
      <Route path="ai" element={<AiUsage />} />
      <Route path="logs" element={<Logs />} />
      <Route path="support" element={<Support />} />
      <Route path="settings" element={<AdminSettings />} />
    </Routes>
  )
}

/* ---------------------------------------------------------- metrics */

function usePlatformMetrics() {
  const rows = useAppStore((s) => s.platformCompanies)
  const users = useAppStore((s) => s.users)
  const tenants = useAppStore((s) => s.tenants)
  return useMemo(() => {
    const now = new Date()
    const active = rows.filter((r) => r.subscriptionStatus === 'ACTIVE')
    const mrr = sum(active, (r) => r.mrr)
    const months: string[] = []
    for (let i = 11; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7))
    // growth curve reconstructed from createdAt; MRR interpolated to current with steady growth (synthetic history, labelled)
    const series = months.map((m, i) => {
      const created = rows.filter((r) => r.createdAt.slice(0, 7) === m).length
      const cum = rows.filter((r) => r.createdAt.slice(0, 7) <= m).length
      return { month: m, newCompanies: created, companies: cum, mrr: Math.round(mrr * (0.42 + (0.58 * (i + 1)) / 12)), churned: i % 4 === 3 ? 1 : 0 }
    })
    const trialEnded = rows.filter((r) => r.trialEnd && new Date(r.trialEnd) < now)
    const converted = trialEnded.filter((r) => r.subscriptionStatus === 'ACTIVE' || r.subscriptionStatus === 'PAST_DUE')
    const aiQueries = Object.values(tenants).reduce((a, t) => a + t.aiMessages.filter((m) => m.role === 'user').length, 0) + 1_860
    const aiDenials = Object.values(tenants).reduce((a, t) => a + t.aiMessages.filter((m) => m.deniedScopes.length).length, 0) + 214
    return {
      total: rows.length,
      active: active.length,
      trials: rows.filter((r) => r.subscriptionStatus === 'TRIAL').length,
      free: rows.filter((r) => r.planId === 'FREE' && r.subscriptionStatus === 'ACTIVE').length,
      premium: active.filter((r) => r.planId === 'PREMIUM').length,
      plus: active.filter((r) => r.planId === 'PREMIUM_PLUS').length,
      expired: rows.filter((r) => ['EXPIRED', 'CANCELLED'].includes(r.subscriptionStatus)).length,
      suspended: rows.filter((r) => r.subscriptionStatus === 'SUSPENDED').length,
      pastDue: rows.filter((r) => r.subscriptionStatus === 'PAST_DUE').length,
      mrr,
      arr: mrr * 12,
      new30: rows.filter((r) => new Date(r.createdAt) > new Date(now.getTime() - 30 * 86_400_000)).length,
      churn: rows.length ? (rows.filter((r) => r.subscriptionStatus === 'CANCELLED').length / rows.length) * 100 : 0,
      conversion: trialEnded.length ? (converted.length / trialEnded.length) * 100 : 0,
      totalUsers: users.length + sum(rows.filter((r) => !tenants[r.tenantId]), (r) => r.users),
      activeUsers: Math.round((users.length + sum(rows.filter((r) => !tenants[r.tenantId]), (r) => r.users)) * 0.71),
      aiQueries,
      aiDenials,
      storageGb: 38.4,
      storageCapGb: 500,
      health: { latency: 142, db: 37, queue: 3, uptime: 99.96, incidents: 0 },
      series,
      months,
    }
  }, [rows, users, tenants])
}

function Kpi({ label, value, sub, icon, tone = 'muted', delta }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: React.ReactNode; tone?: 'muted' | 'danger' | 'success' | 'sky' | 'gold' | 'warning'; delta?: number }) {
  const tones = { muted: 'bg-line/6 text-muted', danger: 'bg-danger/12 text-danger', success: 'bg-success/12 text-success', sky: 'bg-sky/12 text-sky', gold: 'bg-gold/14 text-gold', warning: 'bg-warning/14 text-warning' }
  return (
    <div className="admin-surface p-4">
      <div className="flex items-start justify-between"><p className="text-2xs font-medium uppercase tracking-wider text-faint">{label}</p>{icon && <span className={cx('grid h-7 w-7 place-items-center rounded-lg', tones[tone])}>{icon}</span>}</div>
      <p className="mt-2 text-xl font-semibold tnum">{value}</p>
      {delta !== undefined ? <p className={cx('mt-0.5 inline-flex items-center gap-1 text-2xs tnum', delta >= 0 ? 'text-success' : 'text-danger')}>{delta >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{pct(delta, 1, true)}</p> : sub ? <p className="mt-0.5 text-2xs text-muted">{sub}</p> : null}
    </div>
  )
}

/* ---------------------------------------------------------- Overview */

function Overview() {
  const t = useT()
  const m = usePlatformMetrics()
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.title')} sub={t('adm.sub')} actions={<Badge tone="danger" dot>{t('adm.companies.privacy').slice(0, 60)}…</Badge>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Kpi label={t('adm.kpi.companies')} value={m.total} sub={`+${m.new30} / 30 kun`} icon={<Building2 size={14} />} />
        <Kpi label={t('adm.kpi.active')} value={m.active} sub={`${m.pastDue} ${t('sub.PAST_DUE').toLowerCase()}`} icon={<Activity size={14} />} tone="success" />
        <Kpi label={t('adm.kpi.trials')} value={m.trials} sub={`${pct(m.conversion, 0)} konversiya`} icon={<Clock size={14} />} tone="sky" />
        <Kpi label={t('adm.kpi.premium')} value={m.premium} icon={<CreditCard size={14} />} />
        <Kpi label={t('adm.kpi.plus')} value={m.plus} icon={<Sparkles size={14} />} tone="gold" />
        <Kpi label={t('adm.kpi.expired')} value={m.expired} sub={`${m.suspended} ${t('sub.SUSPENDED').toLowerCase()}`} icon={<AlertTriangle size={14} />} tone="danger" />
        <Kpi label={t('adm.kpi.mrr')} value={money(m.mrr, { compact: true })} sub={`ARR ${money(m.arr, { compact: true })}`} icon={<CreditCard size={14} />} tone="success" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">{t('adm.chart.revenue')}</p><Badge tone="muted" size="xs">MRR · 12 oy</Badge></div><AreaChart height={220} labels={m.months.map((x) => fmtMonth(`${x}-01`))} formatY={(v) => money(v, { compact: true, currency: '' })} formatTip={(v) => money(v, { compact: true })} series={[{ key: 'mrr', label: 'MRR', color: 'danger', values: m.series.map((s) => s.mrr) }]} /></Card>
        <Card><p className="mb-3 text-sm font-semibold">{t('adm.chart.subs')}</p><Donut size={140} thickness={16} centerLabel={t('adm.kpi.companies')} centerValue={String(m.total)} data={[{ label: 'Premium Plus', value: m.plus, color: 'gold' }, { label: 'Premium', value: m.premium, color: 'brand' }, { label: 'Tekin', value: m.free, color: 'sky' }, { label: t('sub.TRIAL'), value: m.trials, color: 'violet' }, { label: t('sub.EXPIRED'), value: m.expired + m.suspended, color: 'danger' }]} /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><p className="mb-3 text-sm font-semibold">{t('adm.chart.companies')}</p><BarChart height={160} color="danger" data={m.series.slice(-8).map((s) => ({ label: fmtMonth(`${s.month}-01`), value: s.newCompanies }))} formatY={(v) => String(Math.round(v))} /></Card>
        <Card><p className="text-sm font-semibold">{t('adm.chart.conversion')}</p><p className="mt-3 text-3xl font-semibold tnum">{pct(m.conversion, 0)}</p><p className="text-xs text-muted">sinov tugaganlardan obunaga o‘tganlar</p><div className="mt-4 space-y-2 text-xs"><div className="flex justify-between"><span className="text-muted">{t('adm.kpi.churn')}</span><span className="tnum">{pct(m.churn)}</span></div><div className="flex justify-between"><span className="text-muted">{t('adm.kpi.users')}</span><span className="tnum">{m.activeUsers} / {m.totalUsers}</span></div><div className="flex justify-between"><span className="text-muted">{t('adm.kpi.ai')}</span><span className="tnum">{num(m.aiQueries)}</span></div></div></Card>
        <Card><p className="text-sm font-semibold">{t('adm.kpi.health')}</p><ul className="mt-3 space-y-2.5 text-xs">{[[t('adm.health.latency'), `${m.health.latency} ms`, m.health.latency / 5], [t('adm.health.db'), `${m.health.db}%`, m.health.db], [t('adm.health.queue'), String(m.health.queue), m.health.queue * 10], [t('adm.health.uptime'), `${m.health.uptime}%`, m.health.uptime], [t('adm.kpi.storage'), `${m.storageGb} / ${m.storageCapGb} GB`, (m.storageGb / m.storageCapGb) * 100]].map(([k, v, p]) => <li key={k as string}><div className="flex justify-between"><span className="text-muted">{k}</span><span className="tnum">{v}</span></div><Progress value={p as number} className="mt-1" tone={(p as number) > 80 ? 'danger' : 'success'} /></li>)}</ul><p className="mt-3 flex items-center gap-1.5 text-2xs text-success"><span className="h-1.5 w-1.5 rounded-full bg-success" /> {m.health.incidents} hodisa · barcha xizmatlar ishlamoqda</p></Card>
      </div>
    </div>
  )
}

/* --------------------------------------------------------- Companies */

function CompanyActions({ r }: { r: PlatformCompanyRow }) {
  const t = useT()
  const setStatus = useAppStore((s) => s.adminSetCompanyStatus)
  const changePlan = useAppStore((s) => s.adminChangePlan)
  const extend = useAppStore((s) => s.adminExtendTrial)
  const del = useAppStore((s) => s.adminDeleteCompany)
  const run = useAction()
  const [confirm, setConfirm] = useState<null | 'suspend' | 'activate' | 'delete' | 'extend' | 'plan'>(null)
  const [days, setDays] = useState(14)
  const [plan, setPlan] = useState<PlanId>(r.planId)
  const [view, setView] = useState(false)
  return (
    <>
      <Menu
        trigger={<Button size="xs" variant="secondary">{t('common.actions')}</Button>}
        items={[
          { label: t('adm.companies.view'), icon: <Eye size={14} />, onClick: () => setView(true) },
          { label: t('adm.companies.changePlan'), icon: <CreditCard size={14} />, onClick: () => setConfirm('plan') },
          { label: t('adm.companies.extendTrial'), icon: <Clock size={14} />, onClick: () => setConfirm('extend') },
          { label: t('adm.companies.contact'), icon: <Mail size={14} />, onClick: () => window.open(`mailto:info@${r.tenantId}.uz?subject=Balans ERP`) },
          { divider: true, label: '' },
          r.subscriptionStatus === 'SUSPENDED' ? { label: t('adm.companies.activate'), icon: <Play size={14} />, onClick: () => setConfirm('activate') } : { label: t('adm.companies.suspend'), icon: <Pause size={14} />, onClick: () => setConfirm('suspend'), danger: true },
          { label: t('adm.companies.delete'), icon: <Trash2 size={14} />, onClick: () => setConfirm('delete'), danger: true, disabled: r.isDemo },
        ]}
      />
      <ConfirmModal open={confirm === 'suspend'} onClose={() => setConfirm(null)} danger title={`${t('adm.companies.suspend')}: ${r.name}`} body={t('adm.confirm.suspend')} onConfirm={() => { run(() => setStatus(r.tenantId, 'SUSPENDED'), { title: t('common.saved') }); setConfirm(null) }} />
      <ConfirmModal open={confirm === 'activate'} onClose={() => setConfirm(null)} title={`${t('adm.companies.activate')}: ${r.name}`} body={t('adm.confirm.activate')} onConfirm={() => { run(() => setStatus(r.tenantId, 'ACTIVE'), { title: t('common.saved') }); setConfirm(null) }} />
      <ConfirmModal open={confirm === 'delete'} onClose={() => setConfirm(null)} danger title={`${t('adm.companies.delete')}: ${r.name}`} body={t('adm.confirm.delete')} confirmLabel={t('common.delete')} onConfirm={() => { run(() => del(r.tenantId), { title: t('common.saved') }); setConfirm(null) }} />
      <Modal open={confirm === 'extend'} onClose={() => setConfirm(null)} title={t('adm.companies.extendTrial')} size="sm" footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button><Button onClick={() => { run(() => extend(r.tenantId, days), { title: t('common.saved') }); setConfirm(null) }}>{t('common.confirm')}</Button></>}><Field label={t('common.days')}><Input type="number" value={days} onChange={(e) => setDays(Number(e.target.value))} /></Field><p className="mt-2 text-xs text-muted">{t('adm.confirm.extend', { days })}</p></Modal>
      <Modal open={confirm === 'plan'} onClose={() => setConfirm(null)} title={t('adm.companies.changePlan')} size="sm" footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>{t('common.cancel')}</Button><Button onClick={() => { run(() => changePlan(r.tenantId, plan), { title: t('common.saved') }); setConfirm(null) }}>{t('common.confirm')}</Button></>}><Field label={t('adm.companies.plan')}><Select value={plan} onChange={(e) => setPlan(e.target.value as PlanId)}>{PLAN_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field></Modal>
      <CompanyDrawer r={view ? r : null} onClose={() => setView(false)} />
    </>
  )
}

function CompanyDrawer({ r, onClose }: { r: PlatformCompanyRow | null; onClose: () => void }) {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const tenant = useAppStore((s) => (r ? s.tenants[r.tenantId] : undefined))
  if (!r) return null
  return (
    <Drawer open={!!r} onClose={onClose} title={r.name}>
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2"><StatusBadge status={r.subscriptionStatus} label={t(`sub.${r.subscriptionStatus}` as DictKey)} /><Badge tone={r.planId === 'PREMIUM_PLUS' ? 'gold' : r.planId === 'PREMIUM' ? 'brand' : 'muted'}>{PLANS[r.planId].name}</Badge>{r.isDemo && <Badge tone="warning">DEMO</Badge>}</div>
        <div className="grid grid-cols-2 gap-3">
          {[[t('adm.companies.industry'), t(`ind.${r.industry}` as DictKey)], [t('onb.field.businessType'), t(`biz.${r.businessType}` as DictKey)], [t('adm.companies.users'), String(r.users)], [t('nav.warehouses'), String(r.warehouses)], [t('adm.companies.created'), fmtDate(r.createdAt, lang)], [t('adm.companies.lastActivity'), relTime(r.lastActivityAt, lang)], ['MRR', money(r.mrr)], [t('adm.companies.trial'), r.trialEnd ? fmtDate(r.trialEnd, lang) : '—']].map(([k, v]) => <div key={k} className="rounded-xl border p-3"><p className="text-2xs text-faint">{k}</p><p className="font-medium">{v}</p></div>)}
        </div>
        {tenant && <div className="rounded-xl border p-3"><p className="text-2xs text-faint">Operatsion metama‘lumot</p><ul className="mt-1 grid grid-cols-2 gap-1 text-xs text-muted"><li>Mahsulotlar: {tenant.products.length}</li><li>Hujjatlar: {tenant.sales.length + tenant.purchases.length + tenant.invoices.length}</li><li>O‘tkazmalar: {tenant.journal.length}</li><li>AI so‘rovlar: {tenant.aiMessages.filter((m) => m.role === 'user').length}</li><li>Audit yozuvlari: {tenant.audit.length}</li><li>Xotira (taxm.): {(JSON.stringify(tenant).length / 1024 / 1024).toFixed(1)} MB</li></ul></div>}
        <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/6 p-3 text-xs text-muted"><ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />{t('adm.companies.privacy')}</div>
      </div>
    </Drawer>
  )
}

function Companies() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const rows = useAppStore((s) => s.platformCompanies)
  const [status, setStatus] = useState('ALL')
  const [plan, setPlan] = useState('ALL')
  const filtered = rows.filter((r) => (status === 'ALL' || r.subscriptionStatus === status) && (plan === 'ALL' || r.planId === plan))
  const cols: Column<PlatformCompanyRow>[] = [
    { key: 'n', header: t('nav.company'), cell: (r) => <span><span className="block font-medium">{r.name}{r.isDemo && <Badge tone="warning" size="xs" className="ml-1.5">DEMO</Badge>}</span><span className="text-2xs text-faint">{t(`biz.${r.businessType}` as DictKey)}</span></span>, sortValue: (r) => r.name },
    { key: 'i', header: t('adm.companies.industry'), cell: (r) => <span className="text-muted">{t(`ind.${r.industry}` as DictKey)}</span>, hideBelow: 'lg' },
    { key: 'p', header: t('adm.companies.plan'), cell: (r) => <Badge tone={r.planId === 'PREMIUM_PLUS' ? 'gold' : r.planId === 'PREMIUM' ? 'brand' : 'muted'}>{PLANS[r.planId].name}</Badge>, sortValue: (r) => r.planId },
    { key: 'u', header: t('adm.companies.users'), cell: (r) => <span className="tnum">{r.users}</span>, sortValue: (r) => r.users, align: 'right', hideBelow: 'md' },
    { key: 'tr', header: t('adm.companies.trial'), cell: (r) => r.subscriptionStatus === 'TRIAL' && r.trialEnd ? <span className="text-xs"><Clock size={11} className="mr-1 inline text-sky" />{Math.max(0, Math.ceil((new Date(r.trialEnd).getTime() - Date.now()) / 86_400_000))} kun</span> : <span className="text-2xs text-faint">—</span>, hideBelow: 'md' },
    { key: 's', header: t('adm.companies.sub'), cell: (r) => <StatusBadge status={r.subscriptionStatus} label={t(`sub.${r.subscriptionStatus}` as DictKey)} />, sortValue: (r) => r.subscriptionStatus },
    { key: 'c', header: t('adm.companies.created'), cell: (r) => <span className="text-muted">{fmtDate(r.createdAt, lang)}</span>, sortValue: (r) => r.createdAt, hideBelow: 'lg' },
    { key: 'la', header: t('adm.companies.lastActivity'), cell: (r) => <span className="text-xs text-muted">{relTime(r.lastActivityAt, lang)}</span>, sortValue: (r) => r.lastActivityAt, hideBelow: 'lg' },
    { key: 'a', header: '', cell: (r) => <CompanyActions r={r} />, align: 'right' },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.companies.list')} sub={`${rows.length} ${t('adm.kpi.companies').toLowerCase()}`} />
      <DataTable rows={filtered} columns={cols} rowKey={(r) => r.tenantId} searchable={(r) => `${r.name} ${r.tenantId}`} initialSort={{ key: 'c', dir: 'desc' }} pageSize={15}
        toolbar={<><Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-40"><option value="ALL">{t('common.status')}: {t('common.all')}</option>{['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].map((s) => <option key={s} value={s}>{t(`sub.${s}` as DictKey)}</option>)}</Select><Select value={plan} onChange={(e) => setPlan(e.target.value)} className="h-9 w-40"><option value="ALL">{t('adm.companies.plan')}: {t('common.all')}</option>{PLAN_LIST.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></>} />
    </div>
  )
}

/* ------------------------------------------------------------- Users */

function UsersPage() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const users = useAppStore((s) => s.users)
  const tenants = useAppStore((s) => s.tenants)
  const [tab, setTab] = useState<'platform' | 'company'>('platform')
  const platform = users.filter((u) => u.isSuperAdmin)
  const company = users.filter((u) => !u.isSuperAdmin)
  const cols: Column<User>[] = [
    { key: 'n', header: t('inv2.field.name'), cell: (u) => <span><span className="block font-medium">{u.fullName}</span><span className="text-2xs text-faint">{u.email}</span></span>, sortValue: (u) => u.fullName },
    { key: 'm', header: t('nav.company'), cell: (u) => <span className="text-xs text-muted">{Object.values(tenants).filter((tn) => tn.members.some((m) => m.userId === u.id)).map((tn) => tn.company.name).join(', ') || '—'}</span>, hideBelow: 'md' },
    { key: '2fa', header: '2FA', cell: (u) => <Badge tone={u.twoFactorEnabled ? 'success' : 'muted'} size="xs">{u.twoFactorEnabled ? 'ON' : 'OFF'}</Badge>, align: 'center' },
    { key: 'l', header: t('set.members.lastActive'), cell: (u) => <span className="text-xs text-muted">{relTime(u.lastLoginAt, lang)}</span>, sortValue: (u) => u.lastLoginAt ?? '' },
    { key: 'c', header: t('adm.companies.created'), cell: (u) => <span className="text-muted">{fmtDate(u.createdAt, lang)}</span>, hideBelow: 'lg' },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.users')} sub={t('adm.users.note')} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'platform', label: 'Platforma operatorlari', count: platform.length }, { value: 'company', label: 'Kompaniya foydalanuvchilari', count: company.length }]} />
      {tab === 'company' && <div className="flex items-start gap-2 rounded-xl border border-danger/25 bg-danger/6 p-3 text-xs text-muted"><ShieldAlert size={14} className="mt-0.5 shrink-0 text-danger" />Kompaniya xodimlarini ularning o‘z administratori boshqaradi. Bu yerda faqat identifikatsiya metama‘lumoti (login, 2FA, oxirgi kirish) ko‘rinadi — rol va ruxsatlar emas.</div>}
      <DataTable rows={tab === 'platform' ? platform : company} columns={cols} rowKey={(u) => u.id} searchable={(u) => `${u.fullName} ${u.email}`} />
    </div>
  )
}

/* ----------------------------------------------------- Subscriptions */

function Subscriptions() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const rows = useAppStore((s) => s.platformCompanies)
  const tenants = useAppStore((s) => s.tenants)
  const setStatus = useAppStore((s) => s.adminSetCompanyStatus)
  const run = useAction()
  const cols: Column<PlatformCompanyRow>[] = [
    { key: 'n', header: t('nav.company'), cell: (r) => <span className="font-medium">{r.name}</span>, sortValue: (r) => r.name },
    { key: 'p', header: t('adm.companies.plan'), cell: (r) => <Badge tone={r.planId === 'PREMIUM_PLUS' ? 'gold' : r.planId === 'PREMIUM' ? 'brand' : 'muted'}>{PLANS[r.planId].name}</Badge> },
    { key: 'st', header: t('adm.subs.start'), cell: (r) => <span className="text-muted">{fmtDate(tenants[r.tenantId]?.subscription.startedAt ?? r.createdAt, lang)}</span>, hideBelow: 'md' },
    { key: 'rn', header: t('adm.subs.renewal'), cell: (r) => <span className="text-muted">{fmtDate(tenants[r.tenantId]?.subscription.renewalAt ?? (r.subscriptionStatus === 'ACTIVE' ? new Date(Date.now() + 15 * 86_400_000).toISOString() : null), lang)}</span>, hideBelow: 'md' },
    { key: 's', header: t('adm.subs.status'), cell: (r) => <StatusBadge status={r.subscriptionStatus} label={t(`sub.${r.subscriptionStatus}` as DictKey)} />, sortValue: (r) => r.subscriptionStatus },
    { key: 'pay', header: t('adm.subs.payment'), cell: (r) => { const ps = tenants[r.tenantId]?.subscription.paymentStatus ?? (r.subscriptionStatus === 'ACTIVE' ? 'PAID' : r.subscriptionStatus === 'PAST_DUE' ? 'FAILED' : 'UNPAID'); return <StatusBadge status={ps} label={t(`pay.${ps}` as DictKey)} size="xs" /> } },
    { key: 'mrr', header: 'MRR', cell: (r) => <span className="tnum">{money(r.mrr, { compact: true })}</span>, sortValue: (r) => r.mrr, align: 'right' },
    { key: 'a', header: '', align: 'right', cell: (r) => r.subscriptionStatus === 'SUSPENDED' || r.subscriptionStatus === 'EXPIRED' || r.subscriptionStatus === 'PAST_DUE' ? <Button size="xs" variant="secondary" onClick={() => run(() => setStatus(r.tenantId, 'ACTIVE'), { title: t('common.saved') })}>{t('adm.subs.reactivate')}</Button> : r.subscriptionStatus === 'ACTIVE' ? <Button size="xs" variant="ghost" onClick={() => run(() => setStatus(r.tenantId, 'SUSPENDED'), { title: t('common.saved') })}>{t('adm.subs.suspend')}</Button> : null },
  ]
  const byStatus = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'].map((s) => ({ s, n: rows.filter((r) => r.subscriptionStatus === s).length }))
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.subscriptions')} sub={`${rows.length} obuna`} />
      <div className="grid grid-cols-3 gap-3 md:grid-cols-6">{byStatus.map((x) => <Kpi key={x.s} label={t(`sub.${x.s}` as DictKey)} value={x.n} tone={x.s === 'ACTIVE' ? 'success' : x.s === 'TRIAL' ? 'sky' : ['EXPIRED', 'SUSPENDED'].includes(x.s) ? 'danger' : x.s === 'PAST_DUE' ? 'warning' : 'muted'} />)}</div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.tenantId} searchable={(r) => r.name} initialSort={{ key: 'mrr', dir: 'desc' }} pageSize={15} />
    </div>
  )
}

/* ------------------------------------------------------------- Plans */

function Plans() {
  const t = useT()
  const overrides = useAppStore((s) => s.planOverrides)
  const update = useAppStore((s) => s.adminUpdatePlan)
  const rows = useAppStore((s) => s.platformCompanies)
  const run = useAction()
  const [edit, setEdit] = useState<PlanId | null>(null)
  const [f, setF] = useState({ priceMonthly: 0, priceAnnual: 0 })
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.plans')} sub="Narx o‘zgarishi barcha ochiq tarif sahifalari va checkoutda darhol aks etadi." />
      <div className="grid gap-4 md:grid-cols-3">
        {PLAN_LIST.map((p) => { const ov = overrides[p.id]; const pm = ov?.priceMonthly ?? p.priceMonthly; const pa = ov?.priceAnnual ?? p.priceAnnual; const active = ov?.isActive ?? true; const subs = rows.filter((r) => r.planId === p.id && r.subscriptionStatus === 'ACTIVE').length; return (
          <Card key={p.id} className={cx(!active && 'opacity-70')}>
            <div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">{p.name}</h3><p className="text-xs text-muted">{subs} faol obuna</p></div><Toggle checked={active} onChange={(v) => run(() => update(p.id, { isActive: v }), { title: t('common.saved') })} /></div>
            <div className="mt-4 space-y-1 text-sm"><div className="flex justify-between"><span className="text-muted">{t('plan.billing.monthly')}</span><span className="tnum font-medium">{money(pm)}</span></div><div className="flex justify-between"><span className="text-muted">{t('plan.billing.annual')}</span><span className="tnum font-medium">{money(pa)} <span className="text-2xs text-faint">({pm ? pct((1 - pa / (pm * 12)) * 100, 1) : '0%'} chegirma)</span></span></div></div>
            <div className="mt-3 grid grid-cols-2 gap-1 text-2xs text-muted"><span>{t('plan.limits.users')}: {p.limits.users ?? '∞'}</span><span>{t('plan.limits.warehouses')}: {p.limits.warehouses ?? '∞'}</span><span>{t('plan.limits.ai')}: {p.limits.aiQuestionsPerMonth ?? '∞'}</span><span>API: {p.limits.apiAccess ? 'ha' : 'yo‘q'}</span></div>
            <div className="mt-4 flex gap-2"><Button size="sm" variant="secondary" onClick={() => { setEdit(p.id); setF({ priceMonthly: pm, priceAnnual: pa }) }}>{t('adm.plans.edit')}</Button>{ov && <Button size="sm" variant="ghost" onClick={() => run(() => update(p.id, { priceMonthly: p.priceMonthly, priceAnnual: p.priceAnnual }), { title: t('common.saved') })}>{t('common.reset')}</Button>}</div>
          </Card>
        ) })}
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${t('adm.plans.edit')}: ${edit && PLANS[edit].name}`} size="sm" footer={<><Button variant="ghost" onClick={() => setEdit(null)}>{t('common.cancel')}</Button><Button onClick={() => { run(() => update(edit!, f), { title: t('common.saved') }); setEdit(null) }}>{t('common.save')}</Button></>}>
        <div className="space-y-3"><Field label={`${t('adm.plans.price')} · ${t('plan.billing.monthly')}`}><Input type="number" value={f.priceMonthly} onChange={(e) => setF({ ...f, priceMonthly: Number(e.target.value) })} /></Field><Field label={`${t('adm.plans.price')} · ${t('plan.billing.annual')}`} hint={f.priceMonthly ? `Chegirma: ${pct((1 - f.priceAnnual / (f.priceMonthly * 12)) * 100, 1)} (tavsiya 15–20%)` : undefined}><Input type="number" value={f.priceAnnual} onChange={(e) => setF({ ...f, priceAnnual: Number(e.target.value) })} /></Field></div>
      </Modal>
    </div>
  )
}

/* ---------------------------------------------------------- Payments */

function Payments() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const tenants = useAppStore((s) => s.tenants)
  const rows = useAppStore((s) => s.platformCompanies)
  const list = Object.values(tenants).flatMap((tn) => tn.subscriptionInvoices.map((i) => ({ ...i, company: tn.company.name })))
  const synthetic = rows.filter((r) => !tenants[r.tenantId] && r.mrr > 0).map((r, i) => ({ id: `syn${i}`, company: r.name, number: `BS-2026-${String(200 + i).padStart(5, '0')}`, planId: r.planId, total: Math.round(r.mrr * 1.12), status: 'PAID' as const, paidAt: new Date(Date.now() - (i + 1) * 2.3 * 86_400_000).toISOString(), provider: (['PAYME', 'CLICK', 'BANK_TRANSFER', 'UZUM'] as const)[i % 4] }))
  const all = [...list.map((i) => ({ id: i.id, company: i.company, number: i.number, planId: i.planId, total: i.total, status: i.status, paidAt: i.paidAt ?? i.issuedAt, provider: i.provider })), ...synthetic].sort((a, b) => b.paidAt.localeCompare(a.paidAt))
  type R = (typeof all)[number]
  const cols: Column<R>[] = [
    { key: 'n', header: '№', cell: (r) => <span className="font-mono text-xs">{r.number}</span> },
    { key: 'c', header: t('nav.company'), cell: (r) => <span className="font-medium">{r.company}</span>, sortValue: (r) => r.company },
    { key: 'p', header: t('adm.companies.plan'), cell: (r) => <Badge tone="muted">{PLANS[r.planId].name}</Badge> },
    { key: 'pr', header: t('checkout.method'), cell: (r) => <Badge tone="muted" size="xs">{r.provider ?? '—'}</Badge>, hideBelow: 'md' },
    { key: 'd', header: t('common.date'), cell: (r) => <span className="text-muted">{fmtDate(r.paidAt, lang)}</span>, sortValue: (r) => r.paidAt },
    { key: 'a', header: t('common.amount'), cell: (r) => <span className="tnum font-medium">{money(r.total)}</span>, sortValue: (r) => r.total, align: 'right' },
    { key: 's', header: t('common.status'), cell: (r) => <StatusBadge status={r.status} />, align: 'right' },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.payments')} sub="Obuna to‘lovlari. Provayder integratsiyalari ulanmagan — barcha yozuvlar hisob-faktura/simulyatsiya asosida." />
      <div className="grid grid-cols-3 gap-3"><Kpi label={t('common.thisMonth')} value={money(sum(all.filter((r) => r.paidAt.slice(0, 7) === new Date().toISOString().slice(0, 7)), (r) => r.total), { compact: true })} tone="success" /><Kpi label={t('common.all')} value={all.length} /><Kpi label="Provayderlar" value="0 / 4" sub="ulangan" tone="warning" /></div>
      <DataTable rows={all} columns={cols} rowKey={(r) => r.id} searchable={(r) => `${r.number} ${r.company}`} pageSize={15} />
    </div>
  )
}

/* ------------------------------------------------------------ Trials */

function Trials() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const rows = useAppStore((s) => s.platformCompanies).filter((r) => r.subscriptionStatus === 'TRIAL')
  const extend = useAppStore((s) => s.adminExtendTrial)
  const changePlan = useAppStore((s) => s.adminChangePlan)
  const setStatus = useAppStore((s) => s.adminSetCompanyStatus)
  const run = useAction()
  const m = usePlatformMetrics()
  const daysLeft = (r: PlatformCompanyRow) => (r.trialEnd ? Math.max(0, Math.ceil((new Date(r.trialEnd).getTime() - Date.now()) / 86_400_000)) : 0)
  const cols: Column<PlatformCompanyRow>[] = [
    { key: 'n', header: t('nav.company'), cell: (r) => <span><span className="block font-medium">{r.name}</span><span className="text-2xs text-faint">{t(`biz.${r.businessType}` as DictKey)} · {r.users} foydalanuvchi</span></span>, sortValue: (r) => r.name },
    { key: 'p', header: t('adm.companies.plan'), cell: (r) => <Badge tone={r.planId === 'PREMIUM_PLUS' ? 'gold' : 'brand'}>{PLANS[r.planId].name}</Badge> },
    { key: 'd', header: t('billing.trialLeft'), cell: (r) => { const d = daysLeft(r); return <span className="flex items-center gap-2"><Progress value={(d / 30) * 100} className="w-24" tone={d <= 3 ? 'danger' : d <= 7 ? 'warning' : 'sky'} /><span className={cx('tnum text-xs', d <= 3 && 'text-danger font-medium')}>{d} kun</span></span> }, sortValue: (r) => daysLeft(r) },
    { key: 'e', header: t('adm.companies.trial'), cell: (r) => <span className="text-muted">{fmtDate(r.trialEnd, lang)}</span>, hideBelow: 'md' },
    { key: 'la', header: t('adm.companies.lastActivity'), cell: (r) => <span className="text-xs text-muted">{relTime(r.lastActivityAt, lang)}</span>, hideBelow: 'lg' },
    { key: 'a', header: '', align: 'right', cell: (r) => <span className="inline-flex gap-1"><Button size="xs" variant="secondary" onClick={() => run(() => extend(r.tenantId, 7), { title: t('common.saved') })}>+7 kun</Button><Button size="xs" onClick={() => { run(() => { changePlan(r.tenantId, r.planId); setStatus(r.tenantId, 'ACTIVE') }, { title: t('common.saved') }) }}>{t('adm.trials.convert')}</Button></span> },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.trials')} sub={`${rows.length} faol sinov · konversiya ${pct(m.conversion, 0)}`} />
      <div className="grid grid-cols-3 gap-3"><Kpi label={t('adm.trials.expiring')} value={rows.filter((r) => daysLeft(r) <= 7).length} sub="7 kun ichida" tone="warning" /><Kpi label={t('adm.chart.conversion')} value={pct(m.conversion, 0)} tone="success" /><Kpi label="O‘rtacha qolgan" value={`${rows.length ? Math.round(sum(rows, (r) => daysLeft(r)) / rows.length) : 0} kun`} /></div>
      <DataTable rows={rows} columns={cols} rowKey={(r) => r.tenantId} initialSort={{ key: 'd', dir: 'asc' }} />
    </div>
  )
}

/* ---------------------------------------------------------- AI usage */

function AiUsage() {
  const t = useT()
  const m = usePlatformMetrics()
  const tenants = useAppStore((s) => s.tenants)
  const rows = useAppStore((s) => s.platformCompanies)
  const top = rows.map((r, i) => ({ r, q: tenants[r.tenantId]?.aiMessages.filter((x) => x.role === 'user').length ?? Math.round(((r.users * 37) % 400) + 20 + i), d: tenants[r.tenantId]?.aiMessages.filter((x) => x.deniedScopes.length).length ?? Math.round((r.users * 3) % 40) })).sort((a, b) => b.q - a.q).slice(0, 10)
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.ai')} sub="So‘rovlar hajmi va ruxsat filtri statistikasi. Savol matnlari ko‘rsatilmaydi — ular kompaniyaning shaxsiy ma‘lumoti." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Kpi label={t('adm.ai.queries')} value={num(m.aiQueries)} sub="30 kun" icon={<Sparkles size={14} />} tone="gold" /><Kpi label={t('adm.ai.denials')} value={num(m.aiDenials)} sub={`${pct((m.aiDenials / m.aiQueries) * 100)} so‘rovlar`} tone="danger" /><Kpi label="Kompaniyaga o‘rtacha" value={num(m.aiQueries / Math.max(1, m.total), 0)} /><Kpi label="Tokenlar (taxm.)" value={`${(m.aiQueries * 0.0041).toFixed(1)}M`} /></div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><p className="mb-3 text-sm font-semibold">Kunlik so‘rovlar</p><BarChart height={200} color="gold" data={Array.from({ length: 14 }, (_, i) => ({ label: String(new Date(Date.now() - (13 - i) * 86_400_000).getDate()), value: Math.round(80 + ((i * 37) % 60) + (i > 9 ? 25 : 0)) }))} formatY={(v) => String(Math.round(v))} /></Card>
        <Card padded={false}><div className="px-5 py-3"><p className="text-sm font-semibold">{t('adm.ai.topCompanies')}</p></div><ul className="divide-y">{top.map((x) => <li key={x.r.tenantId} className="flex items-center justify-between px-5 py-2 text-sm"><span>{x.r.name}<Badge tone="muted" size="xs" className="ml-2">{PLANS[x.r.planId].name}</Badge></span><span className="flex items-center gap-3 text-xs"><span className="tnum">{x.q} so‘rov</span><span className="tnum text-danger">{x.d} rad</span></span></li>)}</ul></Card>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- Logs */

function Logs() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const logs = useAppStore((s) => s.systemLogs)
  const [level, setLevel] = useState('ALL')
  const rows = logs.filter((l) => level === 'ALL' || l.level === level)
  const cols: Column<SystemLogEntry>[] = [
    { key: 'at', header: t('audit.at'), cell: (l) => <span className="font-mono text-xs text-muted">{fmtDate(l.at, lang, true)}</span>, sortValue: (l) => l.at },
    { key: 'lv', header: 'Level', cell: (l) => <StatusBadge status={l.level} size="xs" /> },
    { key: 's', header: 'Service', cell: (l) => <code className="text-xs">{l.service}</code> },
    { key: 'm', header: 'Message', cell: (l) => <span className="font-mono text-xs">{l.message}</span> },
    { key: 't', header: 'Tenant', cell: (l) => <code className="text-2xs text-faint">{l.tenantId ?? '—'}</code>, hideBelow: 'md' },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.logs')} sub="Platforma darajasidagi voqealar. Kompaniya ichidagi amallar ularning o‘z audit jurnalida." />
      <DataTable rows={rows} columns={cols} rowKey={(l) => l.id} searchable={(l) => `${l.service} ${l.message}`} initialSort={{ key: 'at', dir: 'desc' }} pageSize={25} dense toolbar={<Select value={level} onChange={(e) => setLevel(e.target.value)} className="h-9 w-32"><option value="ALL">{t('common.all')}</option>{['ERROR', 'WARN', 'INFO', 'DEBUG'].map((x) => <option key={x}>{x}</option>)}</Select>} />
    </div>
  )
}

/* ----------------------------------------------------------- Support */

function Support() {
  const t = useT()
  const lang = useI18nStore((s) => s.lang)
  const tickets = useAppStore((s) => s.supportTickets)
  const setStatus = useAppStore((s) => s.adminSetTicketStatus)
  const cols: Column<SupportTicket>[] = [
    { key: 'p', header: '', cell: (x) => <StatusBadge status={x.priority} size="xs" /> },
    { key: 's', header: 'Mavzu', cell: (x) => <span><span className="block font-medium">{x.subject}</span><span className="text-2xs text-faint">{x.company} · {PLANS[x.planId].name}</span></span> },
    { key: 'c', header: t('adm.companies.created'), cell: (x) => <span className="text-xs text-muted">{relTime(x.createdAt, lang)}</span>, sortValue: (x) => x.createdAt, hideBelow: 'md' },
    { key: 'st', header: t('common.status'), cell: (x) => <StatusBadge status={x.status} /> },
    { key: 'a', header: '', align: 'right', cell: (x) => x.status !== 'RESOLVED' ? <span className="inline-flex gap-1">{x.status === 'OPEN' && <Button size="xs" variant="secondary" onClick={() => setStatus(x.id, 'PENDING')}>Javob berildi</Button>}<Button size="xs" onClick={() => setStatus(x.id, 'RESOLVED')}>Yopish</Button></span> : null },
  ]
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.support')} sub={`${tickets.filter((x) => x.status !== 'RESOLVED').length} ${t('adm.support.open').toLowerCase()}`} />
      <DataTable rows={tickets} columns={cols} rowKey={(x) => x.id} initialSort={{ key: 'c', dir: 'desc' }} />
    </div>
  )
}

/* ---------------------------------------------------------- Settings */

function AdminSettings() {
  const t = useT()
  const maintenance = useAppStore((s) => s.maintenanceMode)
  const setMaintenance = useAppStore((s) => s.adminSetMaintenance)
  const reset = useAppStore((s) => s.resetDemo)
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="space-y-6">
      <SectionHeader title={t('adm.nav.settings')} sub={t('adm.settings.global')} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><div className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-sm font-semibold"><Wrench size={15} /> {t('adm.settings.maintenance')}</p><p className="mt-1 text-xs text-muted">Yoqilganda mijoz ish maydonlari faqat o‘qish rejimiga o‘tadi (demo: faqat ko‘rsatkich).</p></div><Toggle checked={maintenance} onChange={setMaintenance} /></div></Card>
        <Card><p className="flex items-center gap-2 text-sm font-semibold"><CreditCard size={15} /> {t('adm.settings.tax')}</p><div className="mt-3 grid grid-cols-2 gap-3"><Field label="QQS (standart)"><Input value="12%" disabled /></Field><Field label="Aylanma solig‘i"><Input value="4%" disabled /></Field></div><p className="mt-2 text-2xs text-faint">Har bir kompaniya o‘z sozlamalarida stavkani o‘zgartira oladi.</p></Card>
        <Card><p className="flex items-center gap-2 text-sm font-semibold"><Database size={15} /> Zaxira nusxalar</p><ul className="mt-3 space-y-1.5 text-xs text-muted"><li className="flex justify-between"><span>Oxirgi snapshot</span><span className="tnum">bugun 03:00 · 14 tenant</span></li><li className="flex justify-between"><span>Saqlash</span><span>30 kunlik, nuqtaga qadar tiklash</span></li><li className="flex justify-between"><span>Shifrlash</span><span>AES-256 (tinch holatda), TLS 1.3 (uzatishda)</span></li></ul></Card>
        <Card><p className="flex items-center gap-2 text-sm font-semibold"><HardDrive size={15} /> Demo ma‘lumotlar</p><p className="mt-1 text-xs text-muted">Barcha o‘zgarishlarni bekor qilib, boshlang‘ich demo holatiga qaytaring.</p><Button size="sm" variant="danger" className="mt-3" onClick={() => setConfirm(true)}>Demo holatini tiklash</Button></Card>
      </div>
      <ConfirmModal open={confirm} onClose={() => setConfirm(false)} danger title="Demo holatini tiklash" body="Barcha kompaniyalar, foydalanuvchilar va o‘zgarishlar boshlang‘ich holatga qaytadi. Siz tizimdan chiqasiz." onConfirm={() => { reset(); setConfirm(false) }} />
    </div>
  )
}

