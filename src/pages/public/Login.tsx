import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, KeyRound, ShieldAlert, Sparkles } from 'lucide-react'
import { Wordmark } from '@/app/Brand'
import { useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { Avatar, Badge, Button, Card, Field, Input } from '@/ui/primitives'
import { LangSwitch, ThemeToggle } from '@/app/layouts/PublicLayout'
import { DEMO_PASSWORD, DEMO_PEOPLE, DEMO_TENANT_ID, SUPER_ADMIN_EMAIL } from '@/data/seed'
import { cx } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'

export default function Login() {
  const t = useT()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const login = useAppStore((s) => s.login)
  const loginAs = useAppStore((s) => s.loginAs)
  const session = useAppStore((s) => s.session)
  const users = useAppStore((s) => s.users)
  const adminMode = sp.get('admin') === '1'
  const [email, setEmail] = useState(adminMode ? SUPER_ADMIN_EMAIL : '')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [twoFa, setTwoFa] = useState<{ userId: string } | null>(null)
  const [code, setCode] = useState('')

  useEffect(() => {
    const as = sp.get('as')
    if (as && DEMO_PEOPLE.some((p) => p.id === as)) {
      loginAs(as, DEMO_TENANT_ID)
      nav('/app', { replace: true })
    }
  }, [sp, loginAs, nav])

  useEffect(() => {
    if (session) {
      const u = users.find((x) => x.id === session.userId)
      nav(u?.isSuperAdmin && !session.tenantId ? '/admin' : '/app', { replace: true })
    }
  }, [session, nav, users])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
    if (user?.twoFactorEnabled && !twoFa) {
      // password is validated first, then a second factor is requested
      const r = login(email, pw)
      if (!r.ok) return setErr(r.error === 'auth.noTenant' ? 'Bu foydalanuvchi hech qanday kompaniyaga biriktirilmagan.' : 'Email yoki parol noto‘g‘ri.')
      useAppStore.getState().logout()
      setTwoFa({ userId: user.id })
      return
    }
    const r = login(email, pw)
    if (!r.ok) setErr(r.error === 'auth.noTenant' ? 'Bu foydalanuvchi hech qanday kompaniyaga biriktirilmagan.' : 'Email yoki parol noto‘g‘ri.')
  }

  const confirm2fa = (e: React.FormEvent) => {
    e.preventDefault()
    if (code.replace(/\D/g, '').length !== 6) return setErr('6 xonali kod kiriting.')
    const r = login(email, pw)
    if (!r.ok) setErr('Xatolik.')
  }

  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="aurora" />
      <div className="grid-bg absolute inset-x-0 top-0 h-[600px]" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_440px] lg:items-center">
        <div className="hidden lg:block">
          <Link to="/">
            <Wordmark size="lg" />
          </Link>
          <h1 className="mt-10 max-w-lg font-display text-4xl font-bold leading-tight">{adminMode ? t('adm.title') : t('brand.claim')}</h1>
          <p className="mt-4 max-w-md text-muted">{adminMode ? t('adm.sub') : t('landing.hero.sub')}</p>
          {!adminMode && (
            <div className="mt-10 grid max-w-md gap-3">
              {[
                ['15 ta rol', 'Har kim faqat o‘z ishini ko‘radi'],
                ['Bitta yadro', 'Savdo → ombor → buxgalteriya avtomatik'],
                ['AI CFO', 'Ruxsatlaringiz doirasida tahlil'],
              ].map(([a, b]) => (
                <div key={a} className="flex items-center gap-3 rounded-2xl border bg-surface/60 p-3">
                  <Badge tone="brand">{a}</Badge>
                  <span className="text-sm text-muted">{b}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <Link to="/">
              <Wordmark />
            </Link>
            <div className="flex items-center gap-2">
              <LangSwitch />
              <ThemeToggle />
            </div>
          </div>
          <Card className={cx(adminMode && 'border-danger/30')}>
            {twoFa ? (
              <form onSubmit={confirm2fa} className="space-y-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/12 text-brand">
                  <KeyRound size={22} />
                </div>
                <h2 className="text-xl font-semibold">{t('auth.2fa.title')}</h2>
                <p className="text-sm text-muted">{t('auth.2fa.sub')}</p>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="••••••" inputMode="numeric" className="text-center font-mono text-lg tracking-[0.5em]" autoFocus />
                <p className="rounded-xl border border-dashed p-3 text-xs text-faint">{t('auth.2fa.note')} Demo kod: istalgan 6 raqam.</p>
                {err && <p className="text-sm text-danger">{err}</p>}
                <Button block type="submit">
                  {t('common.confirm')}
                </Button>
              </form>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {adminMode && (
                  <div className="flex items-center gap-2 rounded-xl border border-danger/25 bg-danger/8 px-3 py-2 text-xs text-danger">
                    <ShieldAlert size={14} /> {t('auth.superAdminOnly')}
                  </div>
                )}
                <div>
                  <h2 className="text-xl font-semibold">{adminMode ? t('nav.admin') : t('auth.login.title')}</h2>
                  <p className="mt-1 text-sm text-muted">{adminMode ? t('adm.sub') : t('auth.login.sub')}</p>
                </div>
                <Field label={t('onb.field.email')}>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="siz@kompaniya.uz" autoComplete="email" required />
                </Field>
                <Field label={t('onb.field.password')}>
                  <Input type={show ? 'text' : 'password'} value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" autoComplete="current-password" required right={<button type="button" onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={15} /> : <Eye size={15} />}</button>} />
                </Field>
                {err && <p className="text-sm text-danger">{err}</p>}
                <Button block type="submit" variant={adminMode ? 'danger' : 'primary'} iconRight={<ArrowRight size={16} />}>
                  {t('auth.login.button')}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <button type="button" className="text-muted hover:text-ink" onClick={() => setErr('Parolni tiklash uchun email provayderi ulanmagan (demo).')}>
                    {t('auth.login.forgot')}
                  </button>
                  {!adminMode ? (
                    <Link to="/register" className="text-brand hover:underline">
                      {t('onb.register')}
                    </Link>
                  ) : (
                    <Link to="/login" className="text-muted hover:text-ink">
                      {t('landing.cta.login')}
                    </Link>
                  )}
                </div>
              </form>
            )}
          </Card>

          <Card className="mt-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles size={15} className="text-brand" /> {t('auth.login.demo')}
              </p>
              <Badge tone="gold">{t('common.demoBadge')}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted">{t('auth.login.demoNote')} Parol: <code className="font-mono text-ink">{DEMO_PASSWORD}</code></p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_PEOPLE.filter((p) => ['OWNER', 'CHIEF_ACCOUNTANT', 'SALES_EMPLOYEE', 'WAREHOUSE_EMPLOYEE', 'PRODUCTION_MANAGER', 'HR_MANAGER'].includes(p.role)).map((p, i) => (
                <button key={p.id} onClick={() => loginAs(p.id, DEMO_TENANT_ID)} className="flex items-center gap-2 rounded-xl border p-2 text-left transition hover:bg-line/6">
                  <Avatar name={p.name} size="xs" tone={['brand', 'sky', 'violet', 'gold', 'danger', 'success'][i % 6]} />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">{p.name.split(' ')[0]}</span>
                    <span className="block truncate text-[10px] text-faint">{t(`role.${p.role}` as DictKey)}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t pt-3">
              <button onClick={() => loginAs('u_nodira', 't_nur')} className="text-xs text-muted hover:text-ink">
                Muddati tugagan kompaniya (Nur Savdo) →
              </button>
              <button onClick={() => loginAs('u_super')} className="inline-flex items-center gap-1 text-xs text-danger hover:underline">
                <ShieldAlert size={12} /> Super admin
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
