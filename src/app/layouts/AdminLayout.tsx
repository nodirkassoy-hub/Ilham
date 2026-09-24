import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { LogOut, Menu as MenuIcon, ShieldAlert, X } from 'lucide-react'
import { Wordmark } from '../Brand'
import { ADMIN_NAV } from '../navigation'
import { useAppStore } from '@/store/appStore'
import { useT } from '@/core/i18n'
import { LangSwitch, ThemeToggle } from './PublicLayout'
import { Avatar, Badge, Button } from '@/ui/primitives'
import { cx } from '@/core/utils/format'

/**
 * Deliberately different from the customer workspace: denser, cooler palette,
 * red accent, no company context, no AI dock, no finance widgets.
 */
export function AdminLayout() {
  const t = useT()
  const user = useAppStore((s) => s.users.find((u) => u.id === s.session?.userId))
  const logout = useAppStore((s) => s.logout)
  const maintenance = useAppStore((s) => s.maintenanceMode)
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])

  const Sidebar = (
    <aside className="flex h-full w-[240px] flex-col border-r border-danger/10 bg-[rgb(var(--c-surface)/0.9)]">
      <div className="flex h-16 items-center justify-between px-5 border-b border-danger/10">
        <Link to="/admin">
          <Wordmark size="sm" admin />
        </Link>
        <button className="lg:hidden text-faint" onClick={() => setOpen(false)}>
          <X size={18} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3">
        <ul className="space-y-0.5">
          {ADMIN_NAV.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end={it.end} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all', isActive ? 'bg-danger/12 text-danger' : 'text-muted hover:bg-line/6 hover:text-ink')}>
                <it.icon size={16} />
                {t(it.labelKey)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="border-t border-danger/10 p-3">
        <div className="rounded-xl border border-danger/20 bg-danger/6 p-3 text-2xs text-muted">
          <ShieldAlert size={14} className="mb-1.5 text-danger" />
          {t('adm.companies.privacy')}
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-canvas">
      <div className="fixed inset-y-0 left-0 z-40 hidden lg:block">{Sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-[240px] animate-slide-left">{Sidebar}</div>
        </div>
      )}
      <div className="lg:pl-[240px]">
        <header className="sticky top-0 z-30 border-b border-danger/10 bg-canvas/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button className="grid h-9 w-9 place-items-center rounded-xl border lg:hidden" onClick={() => setOpen(true)}>
              <MenuIcon size={18} />
            </button>
            <div className="flex items-center gap-2">
              <Badge tone="danger" dot>
                SUPER ADMIN
              </Badge>
              {maintenance && <Badge tone="warning">{t('adm.settings.maintenance')}</Badge>}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden sm:block">
                <LangSwitch />
              </div>
              <ThemeToggle />
              <div className="flex items-center gap-2 rounded-xl border py-1 pl-1 pr-2">
                <Avatar name={user?.fullName ?? 'A'} tone="danger" size="sm" />
                <span className="hidden text-sm font-medium sm:block">{user?.fullName}</span>
              </div>
              <Button size="sm" variant="ghost" icon={<LogOut size={15} />} onClick={logout}>
                <span className="hidden sm:inline">{t('auth.logout')}</span>
              </Button>
            </div>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
