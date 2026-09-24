import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Bell, ChevronDown, ChevronsUpDown, Clock, LogOut, Lock, Menu as MenuIcon, Search, Shield, Sparkles, UserRound, X } from 'lucide-react'
import { Wordmark } from '../Brand'
import { WORKSPACE_NAV } from '../navigation'
import { useSession } from '../useSession'
import { useAppStore } from '@/store/appStore'
import { useT } from '@/core/i18n'
import { LangSwitch, ThemeToggle } from './PublicLayout'
import { Avatar, Badge, Button, Menu } from '@/ui/primitives'
import { cx } from '@/core/utils/format'
import { DEMO_TENANT_ID, DEMO_PEOPLE } from '@/data/seed'
import { AiCfoDock } from '@/pages/app/AiCfoDock'
import type { FeatureId } from '@/core/billing/plans'

export function WorkspaceLayout() {
  const t = useT()
  const { tenant, member, ent, can, canAny, has, banner, user } = useSession()
  const logout = useAppStore((s) => s.logout)
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  const unread = useMemo(() => {
    if (!tenant || !member) return 0
    return tenant.notifications.filter((n) => (n.audienceRoles.includes(member.role) || n.audienceMemberId === member.id) && !n.readByMemberIds.includes(member.id)).length
  }, [tenant, member])

  const sections = useMemo(
    () =>
      WORKSPACE_NAV.map((sec) => ({
        ...sec,
        items: sec.items
          .filter((it) => (Array.isArray(it.perm) ? canAny(...it.perm) : can(it.perm)))
          .map((it) => ({ ...it, locked: it.feature ? !(Array.isArray(it.feature) ? it.feature.some((f) => has(f as FeatureId)) : has(it.feature as FeatureId)) : false })),
      })).filter((s) => s.items.length),
    [can, canAny, has],
  )

  if (!tenant || !member) return null

  const Sidebar = (
    <aside className="flex h-full w-[264px] flex-col border-r bg-surface/70 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-5">
        <Link to="/app">
          <Wordmark size="sm" />
        </Link>
        <button className="lg:hidden text-faint" onClick={() => setOpen(false)}>
          <X size={18} />
        </button>
      </div>
      <CompanySwitcher />
      <nav className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {sections.map((sec, i) => (
          <div key={i} className="mt-4 first:mt-1">
            {sec.labelKey && <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-[0.14em] text-faint">{t(sec.labelKey)}</p>}
            <ul className="space-y-0.5">
              {sec.items.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} end={it.end} className={({ isActive }) => cx('group flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition-all', isActive ? 'bg-brand/12 text-brand' : 'text-muted hover:bg-line/6 hover:text-ink')}>
                    <it.icon size={17} className="shrink-0" />
                    <span className="flex-1 truncate">{t(it.labelKey)}</span>
                    {it.locked && <Lock size={12} className="text-faint" />}
                    {it.to === '/app/notifications' && unread > 0 && <span className="rounded-full bg-danger px-1.5 text-[10px] font-semibold text-white tnum">{unread}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t p-3">
        <PlanChip />
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[264px] animate-slide-left">{Sidebar}</div>
        </div>
      )}
      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-30 border-b bg-canvas/75 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button className="grid h-9 w-9 place-items-center rounded-xl border lg:hidden" onClick={() => setOpen(true)}>
              <MenuIcon size={18} />
            </button>
            <div className="hidden min-w-0 items-center gap-2 md:flex">
              <span className="text-sm text-faint">{tenant.company.name}</span>
              <span className="text-faint">/</span>
              <Badge tone={(['OWNER', 'ADMIN'].includes(member.role) ? 'brand' : 'muted') as never}>{t(`role.${member.role}` as never)}</Badge>
              {tenant.company.isDemo && <Badge tone="gold">{t('common.demoBadge')}</Badge>}
            </div>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              <GlobalSearch />
              <div className="hidden sm:block">
                <LangSwitch />
              </div>
              <ThemeToggle />
              <Link to="/app/notifications" className="relative grid h-9 w-9 place-items-center rounded-xl border text-muted hover:bg-line/8 hover:text-ink">
                <Bell size={16} />
                {unread > 0 && <span className="absolute -right-1 -top-1 grid h-4.5 min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white tnum">{unread}</span>}
              </Link>
              <Menu
                trigger={
                  <button className="flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2 hover:bg-line/6">
                    <Avatar name={member.fullName} tone={member.avatarTone} size="sm" />
                    <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">{member.fullName.split(' ')[0]}</span>
                    <ChevronDown size={14} className="text-faint" />
                  </button>
                }
                items={[
                  { label: <span className="text-xs text-faint">{user?.email}</span>, disabled: true },
                  { divider: true, label: '' },
                  { label: t('nav.settings'), icon: <UserRound size={15} />, onClick: () => (window.location.href = '/app/settings') },
                  ...(tenant.company.tenantId === DEMO_TENANT_ID ? [{ label: t('auth.switchRole'), icon: <Shield size={15} />, onClick: () => document.dispatchEvent(new CustomEvent('open-role-switcher')) }] : []),
                  { divider: true, label: '' },
                  { label: t('auth.logout'), icon: <LogOut size={15} />, danger: true, onClick: logout },
                ]}
              />
            </div>
          </div>
          {banner !== 'NONE' && <TrialBar kind={banner} days={ent.trialDaysLeft ?? 0} />}
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8 pb-28">
          <Outlet />
        </main>
      </div>
      {can('ai.view') && <AiCfoDock />}
      <RoleSwitcher />
    </div>
  )
}

function TrialBar({ kind, days }: { kind: 'NORMAL' | 'D7' | 'D3' | 'D1' | 'EXPIRED'; days: number }) {
  const t = useT()
  const { can } = useSession()
  const text = kind === 'NORMAL' ? t('trial.banner.normal', { days }) : kind === 'D7' ? t('trial.banner.d7', { days }) : kind === 'D3' ? t('trial.banner.d3', { days }) : kind === 'D1' ? t('trial.banner.d1') : t('trial.banner.expired')
  const tone = kind === 'NORMAL' ? 'border-brand/25 bg-brand/8 text-ink' : kind === 'EXPIRED' ? 'border-danger/30 bg-danger/10 text-ink' : 'border-warning/30 bg-warning/10 text-ink'
  return (
    <div className={cx('flex flex-col gap-2 border-t px-4 py-2 text-[13px] sm:flex-row sm:items-center sm:justify-between sm:px-6', tone)}>
      <span className="inline-flex items-center gap-2">
        <Clock size={14} className={kind === 'NORMAL' ? 'text-brand' : kind === 'EXPIRED' ? 'text-danger' : 'text-warning'} />
        {kind === 'NORMAL' && <Badge tone="brand" size="xs">{t('trial.badge')}</Badge>}
        <span className="font-medium">{text}</span>
      </span>
      {can('billing.view') && (
        <span className="flex gap-2">
          <Link to="/app/settings/billing?upgrade=1">
            <Button size="xs" variant={kind === 'EXPIRED' ? 'danger' : 'primary'}>
              {t('trial.cta.choose')}
            </Button>
          </Link>
          {kind === 'EXPIRED' && (
            <Link to="/pricing">
              <Button size="xs" variant="ghost">
                {t('trial.cta.seePlans')}
              </Button>
            </Link>
          )}
        </span>
      )}
    </div>
  )
}

function PlanChip() {
  const t = useT()
  const { ent, tenant, can } = useSession()
  const usedSeats = tenant?.members.filter((m) => m.status !== 'SUSPENDED').length ?? 0
  return (
    <Link to="/app/settings/billing" className={cx('block rounded-2xl border p-3 transition hover:bg-line/6', !can('billing.view') && 'pointer-events-none')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink">{ent.planId === 'FREE' ? 'Tekin' : ent.planId === 'PREMIUM' ? 'Premium' : 'Premium Plus'}</span>
        <Badge tone={ent.status === 'ACTIVE' ? 'success' : ent.status === 'TRIAL' ? 'sky' : 'danger'} size="xs">
          {t(`sub.${ent.status}` as never)}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-2xs text-faint">
        <span>{t('plan.limits.users')}</span>
        <span className="tnum">
          {usedSeats}/{ent.limits.users ?? '∞'}
        </span>
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-line/10">
        <div className="h-full rounded-full bg-brand" style={{ width: `${ent.limits.users ? Math.min(100, (usedSeats / ent.limits.users) * 100) : 12}%` }} />
      </div>
    </Link>
  )
}

function CompanySwitcher() {
  const { tenant, user } = useSession()
  const tenants = useAppStore((s) => s.tenants)
  const selectTenant = useAppStore((s) => s.selectTenant)
  const t = useT()
  const mine = useMemo(() => Object.values(tenants).filter((x) => x.members.some((m) => m.userId === user?.id)), [tenants, user])
  if (!tenant) return null
  return (
    <div className="px-3 pb-2">
      <Menu
        align="left"
        trigger={
          <button className="flex w-full items-center gap-2.5 rounded-2xl border bg-raised/50 px-3 py-2.5 text-left hover:bg-line/6">
            <Avatar name={tenant.company.name} tone={tenant.company.logoTone} size="sm" className="rounded-xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-ink">{tenant.company.name}</span>
              <span className="block truncate text-2xs text-faint">{t(`biz.${tenant.company.businessType}` as never)} · STIR {tenant.company.tin}</span>
            </span>
            {mine.length > 1 && <ChevronsUpDown size={14} className="text-faint" />}
          </button>
        }
        items={
          mine.length > 1
            ? mine.map((x) => ({ label: <span className={cx(x.company.tenantId === tenant.company.tenantId && 'text-brand')}>{x.company.name}</span>, onClick: () => selectTenant(x.company.tenantId) }))
            : [{ label: <span className="text-xs text-faint">Faqat bitta kompaniya</span>, disabled: true }]
        }
      />
    </div>
  )
}

function GlobalSearch() {
  const navigate = useNavigate()
  const { tenant, can } = useSession()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const results = useMemo(() => {
    if (!tenant || q.trim().length < 2) return []
    const s = q.toLowerCase()
    const out: { label: string; sub: string; to: string }[] = []
    if (can('products.view')) for (const p of tenant.products.filter((p) => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s)).slice(0, 4)) out.push({ label: p.name, sub: p.sku, to: '/app/inventory/products?q=' + encodeURIComponent(p.name) })
    if (can('customers.view')) for (const c of tenant.counterparties.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 3)) out.push({ label: c.name, sub: c.type === 'SUPPLIER' ? 'Ta‘minotchi' : 'Mijoz', to: c.type === 'SUPPLIER' ? '/app/suppliers' : '/app/customers' })
    if (can('sales.view')) for (const x of tenant.sales.filter((x) => x.number.toLowerCase().includes(s)).slice(0, 3)) out.push({ label: x.number, sub: 'Savdo', to: '/app/sales' })
    if (can('invoices.view')) for (const x of tenant.invoices.filter((x) => x.number.toLowerCase().includes(s)).slice(0, 3)) out.push({ label: x.number, sub: 'Faktura', to: '/app/invoices' })
    return out
  }, [q, tenant, can])
  return (
    <div className="relative hidden md:block">
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <input value={q} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} onChange={(e) => setQ(e.target.value)} placeholder="Qidirish…" className="h-9 w-48 rounded-xl border bg-raised/60 pl-9 pr-3 text-sm outline-none transition-all focus:w-72 focus:border-brand/50 focus:ring-4 focus:ring-brand/10" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute right-0 top-full z-40 mt-1.5 w-80 glass-strong rounded-2xl p-1.5 shadow-lift animate-scale-in">
          {results.map((r, i) => (
            <button key={i} onMouseDown={() => navigate(r.to)} className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left hover:bg-line/8">
              <span className="truncate text-sm text-ink">{r.label}</span>
              <span className="ml-3 shrink-0 text-2xs text-faint">{r.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Demo helper: hop between BALANS GROUP roles to see the permission system work. */
function RoleSwitcher() {
  const [open, setOpen] = useState(false)
  const loginAs = useAppStore((s) => s.loginAs)
  const { member } = useSession()
  const t = useT()
  useEffect(() => {
    const h = () => setOpen(true)
    document.addEventListener('open-role-switcher', h)
    return () => document.removeEventListener('open-role-switcher', h)
  }, [])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-2xl glass-strong rounded-3xl p-6 shadow-lift animate-scale-in">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{t('auth.switchRole')}</h3>
            <p className="text-sm text-muted">{t('auth.login.demoNote')}</p>
          </div>
          <button onClick={() => setOpen(false)} className="text-faint hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <div className="grid max-h-[60vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {DEMO_PEOPLE.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                loginAs(p.id, DEMO_TENANT_ID)
                setOpen(false)
              }}
              className={cx('flex items-center gap-3 rounded-2xl border p-3 text-left transition hover:bg-line/6', member?.userId === p.id && 'border-brand/50 bg-brand/8')}
            >
              <Avatar name={p.name} size="sm" tone={['brand', 'sky', 'violet', 'gold', 'danger', 'success', 'warning'][DEMO_PEOPLE.indexOf(p) % 7]} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{p.name}</span>
                <span className="block text-2xs text-faint">{t(`role.${p.role}` as never)}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-faint">
          <Sparkles size={12} /> Sotuvchi va omborchi rollariga o‘ting — moliyaviy kartalar va AI javoblari qanday yopilishini ko‘rasiz.
        </p>
      </div>
    </div>
  )
}
