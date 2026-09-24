import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Menu as MenuIcon, Moon, Sun, X } from 'lucide-react'
import { Wordmark } from '../Brand'
import { Button, Segmented } from '@/ui/primitives'
import { LANG_LABELS, useI18nStore, useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { cx } from '@/core/utils/format'
import { useSession } from '../useSession'

export function LangSwitch({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const { lang, setLang } = useI18nStore()
  return <Segmented size={size} value={lang} onChange={setLang} options={(['uz', 'ru', 'en'] as const).map((l) => ({ value: l, label: LANG_LABELS[l] }))} />
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  return (
    <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className={cx('grid h-9 w-9 place-items-center rounded-xl border text-muted transition hover:bg-line/8 hover:text-ink', className)} aria-label="theme">
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export function PublicLayout() {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { principal, isSuperAdmin } = useSession()
  const loc = useLocation()
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 12)
    h()
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])
  useEffect(() => setOpen(false), [loc.pathname, loc.hash])

  const links = [
    { to: '/#features', label: t('landing.nav.product') },
    { to: '/#factories', label: t('landing.nav.factories') },
    { to: '/#industries', label: t('landing.nav.industries') },
    { to: '/pricing', label: t('landing.nav.pricing') },
    { to: '/#security', label: t('landing.nav.security') },
  ]

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className={cx('fixed inset-x-0 top-0 z-50 transition-all duration-300', scrolled ? 'py-2' : 'py-4')}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className={cx('flex items-center justify-between gap-4 rounded-2xl px-4 py-2.5 transition-all duration-300', scrolled ? 'glass-strong shadow-card' : '')}>
            <Link to="/" aria-label="Balans ERP">
              <Wordmark />
            </Link>
            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((l) => (
                <NavLink key={l.to} to={l.to} className="rounded-xl px-3.5 py-2 text-sm font-medium text-muted transition hover:bg-line/6 hover:text-ink">
                  {l.label}
                </NavLink>
              ))}
            </nav>
            <div className="hidden items-center gap-2 lg:flex">
              <LangSwitch />
              <ThemeToggle />
              {principal ? (
                <Link to={isSuperAdmin ? '/admin' : '/app'}>
                  <Button size="sm">{isSuperAdmin ? t('nav.admin') : t('nav.workspace')}</Button>
                </Link>
              ) : (
                <>
                  <Link to="/login">
                    <Button size="sm" variant="ghost">
                      {t('landing.cta.login')}
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button size="sm">{t('landing.cta.start')}</Button>
                  </Link>
                </>
              )}
            </div>
            <button className="grid h-10 w-10 place-items-center rounded-xl border lg:hidden" onClick={() => setOpen((v) => !v)} aria-label="menu">
              {open ? <X size={18} /> : <MenuIcon size={18} />}
            </button>
          </div>
          {open && (
            <div className="mt-2 glass-strong rounded-2xl p-4 shadow-lift lg:hidden animate-scale-in">
              <nav className="flex flex-col">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} className="rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-line/6 hover:text-ink">
                    {l.label}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
                <LangSwitch />
                <ThemeToggle />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link to="/login">
                  <Button block variant="secondary">
                    {t('landing.cta.login')}
                  </Button>
                </Link>
                <Link to="/register">
                  <Button block>{t('landing.cta.start')}</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}

function Footer() {
  const t = useT()
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-sm text-sm text-muted leading-relaxed">{t('brand.claim')}</p>
            <div className="mt-5 flex items-center gap-2">
              <LangSwitch />
            </div>
          </div>
          <FooterCol title={t('landing.footer.product')} items={[[t('landing.nav.product'), '/#features'], [t('landing.nav.factories'), '/#factories'], [t('landing.nav.pricing'), '/pricing'], [t('landing.nav.security'), '/#security'], ['AI CFO', '/#ai']]} />
          <FooterCol title={t('landing.footer.company')} items={[['Demo', '/login?demo=1'], [t('onb.register'), '/register'], [t('landing.cta.login'), '/login'], [t('nav.admin'), '/login?admin=1']]} />
          <FooterCol title={t('landing.footer.contact')} items={[['info@balans.uz', 'mailto:info@balans.uz'], ['+998 71 200 00 00', 'tel:+998712000000'], ['Toshkent, O‘zbekiston', '#']]} />
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t pt-6 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Balans ERP. {t('landing.footer.rights')}</span>
          <span className="max-w-xl">{t('landing.footer.disclaimer')}</span>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">{title}</h4>
      <ul className="mt-4 space-y-2.5">
        {items.map(([label, to]) => (
          <li key={label}>
            {to.startsWith('/') ? (
              <Link to={to} className="text-sm text-muted hover:text-ink">
                {label}
              </Link>
            ) : (
              <a href={to} className="text-sm text-muted hover:text-ink">
                {label}
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
