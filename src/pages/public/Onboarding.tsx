import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Factory, Gauge, Layers, Rocket, Sparkles, UserRound } from 'lucide-react'
import { Wordmark } from '@/app/Brand'
import { useT } from '@/core/i18n'
import { useAppStore, ServiceError, type RegisterPayload } from '@/store/appStore'
import { BUSINESS_TYPES, INDUSTRIES, type BusinessType, type Industry, type PlanId, type BillingCycle } from '@/core/domain/enums'
import { Badge, Button, Card, Field, Input, Select } from '@/ui/primitives'
import { LangSwitch, ThemeToggle } from '@/app/layouts/PublicLayout'
import { BillingToggle, PricingCards } from './PricingSection'
import { cx } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'

const STEPS = ['account', 'business', 'size', 'owner', 'industry', 'plan'] as const
type Step = (typeof STEPS)[number]

export default function Onboarding() {
  const t = useT()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const register = useAppStore((s) => s.register)
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [f, setF] = useState<RegisterPayload & { password2: string }>({
    fullName: '',
    phone: '+998 ',
    email: '',
    password: '',
    password2: '',
    companyName: '',
    tin: '',
    industry: 'OTHER',
    businessType: (BUSINESS_TYPES.includes(sp.get('type') as BusinessType) ? (sp.get('type') as BusinessType) : 'TRADING'),
    employees: 5,
    branches: 1,
    warehouses: 1,
    transactions: 200,
    planId: (['FREE', 'PREMIUM', 'PREMIUM_PLUS'].includes(sp.get('plan') ?? '') ? (sp.get('plan') as PlanId) : 'PREMIUM'),
    city: 'Toshkent',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))

  const recommended: PlanId = useMemo(() => {
    if (['FACTORY', 'MANUFACTURING'].includes(f.businessType) || f.employees > 10 || f.warehouses > 3 || f.branches > 5) return 'PREMIUM_PLUS'
    if (f.employees <= 2 && f.transactions <= 200 && f.warehouses <= 1) return 'FREE'
    return 'PREMIUM'
  }, [f])

  const validate = (s: Step): boolean => {
    const e: Record<string, string> = {}
    if (s === 'account') {
      if (!f.fullName.trim()) e.fullName = t('onb.error.required')
      if (!/^\S+@\S+\.\S+$/.test(f.email)) e.email = t('onb.error.email')
      if (f.phone.replace(/\D/g, '').length < 12) e.phone = t('onb.error.phone')
      if (f.password.length < 8) e.password = t('onb.error.password')
      if (f.password !== f.password2) e.password2 = t('onb.error.match')
    }
    if (s === 'business') {
      if (!f.companyName.trim()) e.companyName = t('onb.error.required')
      if (f.tin.replace(/\D/g, '').length < 9) e.tin = t('onb.error.tin')
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => {
    if (!validate(STEPS[step])) return
    setStep((s) => Math.min(STEPS.length - 1, s + 1))
  }

  const finish = (planId: PlanId) => {
    try {
      const { password2, ...payload } = { ...f, planId }
      void password2
      register(payload)
      setDone(true)
    } catch (err) {
      if (err instanceof ServiceError) setErrors({ email: t(err.code as DictKey) }), setStep(0)
    }
  }

  const stepIcon = [UserRound, Building2, Gauge, UserRound, Layers, Rocket]

  if (done) {
    return (
      <Shell>
        <Card className="mx-auto max-w-xl text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand/12 text-brand">
            <CheckCircle2 size={32} />
          </div>
          <h1 className="mt-5 text-2xl font-bold">{t('onb.done.title')}</h1>
          <p className="mt-2 text-muted">{t('onb.done.sub')}</p>
          <Badge tone="sky" className="mt-3">
            {t('trial.badge')} · 30 kun
          </Badge>
          <ul className="mt-6 space-y-2 text-left">
            {[t('onb.done.next1'), t('onb.done.next2'), t('onb.done.next3')].map((x, i) => (
              <li key={x} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand/12 text-xs font-bold text-brand tnum">{i + 1}</span>
                {x}
              </li>
            ))}
          </ul>
          <Button block size="lg" className="mt-6" iconRight={<ArrowRight size={16} />} onClick={() => nav('/app')}>
            {t('onb.done.enter')}
          </Button>
        </Card>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">{t('onb.title')}</h1>
          <p className="mt-1 text-muted">{t('onb.sub')}</p>
        </div>
        {/* stepper */}
        <ol className="mb-8 grid grid-cols-6 gap-2">
          {STEPS.map((s, i) => {
            const Icon = stepIcon[i]
            const state = i < step ? 'done' : i === step ? 'active' : 'todo'
            return (
              <li key={s} className="flex flex-col items-center gap-2">
                <span className={cx('grid h-9 w-9 place-items-center rounded-xl border transition', state === 'done' ? 'bg-brand text-brand-ink border-brand' : state === 'active' ? 'border-brand text-brand bg-brand/10' : 'text-faint')}>{state === 'done' ? <Check size={16} /> : <Icon size={16} />}</span>
                <span className={cx('hidden text-center text-2xs sm:block', state === 'active' ? 'text-ink font-medium' : 'text-faint')}>{t(`onb.step.${s}` as DictKey)}</span>
              </li>
            )
          })}
        </ol>

        <Card className={cx(STEPS[step] === 'plan' && 'bg-transparent border-0 shadow-none p-0 sm:p-0')}>
          {STEPS[step] === 'account' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('onb.field.fullName')} required error={errors.fullName} className="sm:col-span-2">
                <Input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="Jasur Karimov" autoFocus />
              </Field>
              <Field label={t('onb.field.phone')} required error={errors.phone}>
                <Input value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+998 90 123 45 67" inputMode="tel" />
              </Field>
              <Field label={t('onb.field.email')} required error={errors.email}>
                <Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="siz@kompaniya.uz" />
              </Field>
              <Field label={t('onb.field.password')} required error={errors.password} hint="Kamida 8 belgi">
                <Input type="password" value={f.password} onChange={(e) => set('password', e.target.value)} />
              </Field>
              <Field label={t('onb.field.password2')} required error={errors.password2}>
                <Input type="password" value={f.password2} onChange={(e) => set('password2', e.target.value)} />
              </Field>
            </div>
          )}

          {STEPS[step] === 'business' && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('onb.field.companyName')} required error={errors.companyName}>
                  <Input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="«Sizning kompaniya» MChJ" autoFocus />
                </Field>
                <Field label={t('onb.field.tin')} required error={errors.tin} hint={t('onb.hint.tin')}>
                  <Input value={f.tin} onChange={(e) => set('tin', e.target.value)} placeholder="305 218 746" inputMode="numeric" />
                </Field>
                <Field label={t('onb.field.city')}>
                  <Input value={f.city} onChange={(e) => set('city', e.target.value)} />
                </Field>
                <Field label={t('onb.field.industry')}>
                  <Select value={f.industry} onChange={(e) => set('industry', e.target.value as Industry)}>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {t(`ind.${i}` as DictKey)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-muted">{t('onb.field.businessType')}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {BUSINESS_TYPES.map((b) => (
                    <button key={b} type="button" onClick={() => set('businessType', b)} className={cx('rounded-2xl border p-3 text-left transition', f.businessType === b ? 'border-brand bg-brand/8' : 'hover:bg-line/5')}>
                      <p className="text-sm font-medium">{t(`biz.${b}` as DictKey)}</p>
                      <p className="mt-0.5 text-2xs text-faint line-clamp-2">{t(`biz.desc.${b}` as DictKey)}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {STEPS[step] === 'size' && (
            <div className="space-y-5">
              <p className="text-sm text-muted">{t('onb.hint.size')}</p>
              <div className="grid gap-5 sm:grid-cols-2">
                <Range label={t('onb.field.employees')} value={f.employees} min={1} max={300} onChange={(v) => set('employees', v)} />
                <Range label={t('onb.field.branches')} value={f.branches} min={1} max={30} onChange={(v) => set('branches', v)} />
                <Range label={t('onb.field.warehouses')} value={f.warehouses} min={1} max={30} onChange={(v) => set('warehouses', v)} />
                <Range label={t('onb.field.transactions')} value={f.transactions} min={50} max={20000} step={50} onChange={(v) => set('transactions', v)} />
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand/6 p-4">
                <Sparkles className="text-brand" size={18} />
                <p className="text-sm">
                  {t('onb.recommend')} <b>{recommended === 'FREE' ? 'Tekin' : recommended === 'PREMIUM' ? 'Premium' : 'Premium Plus'}</b>
                </p>
              </div>
            </div>
          )}

          {STEPS[step] === 'owner' && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 rounded-2xl border p-4">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand/12 text-brand font-bold">{f.fullName.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'A'}</span>
                <div>
                  <p className="font-semibold">{f.fullName || '—'}</p>
                  <p className="text-sm text-muted">{f.email}</p>
                </div>
                <Badge tone="brand" className="ml-auto">
                  {t('role.OWNER')}
                </Badge>
              </div>
              <p className="text-sm text-muted">{t('role.owner.summary')} Boshqa xodimlarni keyinroq «{t('nav.members')}» bo‘limidan taklif qilasiz — har biriga alohida rol beriladi.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(['CHIEF_ACCOUNTANT', 'SALES_EMPLOYEE', 'WAREHOUSE_EMPLOYEE'] as const).map((r) => (
                  <div key={r} className="rounded-xl border p-3">
                    <p className="text-sm font-medium">{t(`role.${r}` as DictKey)}</p>
                    <p className="mt-0.5 text-2xs text-faint">{t(`role.${r === 'CHIEF_ACCOUNTANT' ? 'chiefAccountant' : r === 'SALES_EMPLOYEE' ? 'salesEmployee' : 'warehouseEmployee'}.summary` as DictKey)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {STEPS[step] === 'industry' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">Tarmoq platformaning hisoblar rejasi va standart hisobotlarini moslashtiradi.</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {INDUSTRIES.map((i) => (
                  <button key={i} type="button" onClick={() => set('industry', i)} className={cx('rounded-xl border px-3 py-2.5 text-left text-sm transition', f.industry === i ? 'border-brand bg-brand/8' : 'hover:bg-line/5')}>
                    {t(`ind.${i}` as DictKey)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border p-4">
                <Factory size={18} className="text-muted" />
                <p className="text-sm text-muted">
                  {t(`biz.${f.businessType}` as DictKey)} · {t(`ind.${f.industry}` as DictKey)} · {f.employees} xodim · {f.warehouses} ombor
                </p>
              </div>
            </div>
          )}

          {STEPS[step] === 'plan' && (
            <div className="space-y-6">
              <Card className="border-brand/40 bg-brand/6">
                <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
                  <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand text-brand-ink">
                    <Rocket size={26} />
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold">{t('onb.plan.trial')}</h3>
                    <p className="text-sm text-muted">{t('onb.plan.trialNote')}</p>
                  </div>
                  <Button size="lg" onClick={() => finish(recommended === 'FREE' ? 'PREMIUM' : recommended)}>
                    {t('onb.plan.trial')} · {recommended === 'FREE' ? 'Premium' : recommended === 'PREMIUM' ? 'Premium' : 'Premium Plus'}
                  </Button>
                </div>
              </Card>
              <div className="text-center">
                <p className="mb-3 text-sm text-muted">{t('onb.plan.choose')}</p>
                <BillingToggle cycle={cycle} onChange={setCycle} size="md" />
              </div>
              <PricingCards cycle={cycle} onChoose={(p) => finish(p)} compact />
            </div>
          )}

          {STEPS[step] !== 'plan' && (
            <div className="mt-6 flex items-center justify-between border-t pt-5">
              <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} icon={<ArrowLeft size={16} />}>
                {t('common.back')}
              </Button>
              <Button onClick={next} iconRight={<ArrowRight size={16} />}>
                {t('common.continue')}
              </Button>
            </div>
          )}
        </Card>
        <p className="mt-6 text-center text-sm text-muted">
          {t('onb.haveAccount')}{' '}
          <Link to="/login" className="text-brand hover:underline">
            {t('onb.login')}
          </Link>
        </p>
      </div>
    </Shell>
  )
}

function Range({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <input type="number" value={value} min={min} max={max} onChange={(e) => onChange(Number(e.target.value))} className="w-24 rounded-lg border bg-raised/60 px-2 py-1 text-right text-sm tnum outline-none focus:border-brand/50" />
      </div>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(e) => onChange(Number(e.target.value))} className="mt-3 w-full accent-[rgb(var(--c-brand))]" />
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-canvas">
      <div className="aurora" />
      <div className="grid-bg absolute inset-x-0 top-0 h-[500px]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-8 flex items-center justify-between">
          <Link to="/">
            <Wordmark />
          </Link>
          <div className="flex items-center gap-2">
            <LangSwitch />
            <ThemeToggle />
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}
