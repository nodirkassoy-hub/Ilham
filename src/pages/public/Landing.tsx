import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, BookOpen, Boxes, Building2, CheckCircle2, ChevronDown, ClipboardCheck, Cog, Database, Eye, EyeOff, Factory, FileText, Gauge, HandCoins, HardDrive, KeyRound, Layers, Lock, PackageCheck, Play, ScrollText, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, UserCog, Users, Wallet, Wrench } from 'lucide-react'
import { useT } from '@/core/i18n'
import { Badge, Button, Card } from '@/ui/primitives'
import { AreaChart, Donut, Gauge as GaugeChart, Sparkline } from '@/ui/charts'
import { PricingSection } from './PricingSection'
import { useAppStore } from '@/store/appStore'
import { DEMO_TENANT_ID } from '@/data/seed'
import { Ledger, balanceSheet, monthlySeries, profitAndLoss, aging } from '@/core/services/accounting'
import { cx, fmtMonth, money, pct } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'

export default function Landing() {
  return (
    <div className="relative overflow-hidden">
      <Hero />
      <TrustStrip />
      <Problem />
      <Features />
      <Workflow />
      <Permissions />
      <Factories />
      <Industries />
      <AiSection />
      <Security />
      <PricingSection />
      <Faq />
      <FinalCta />
    </div>
  )
}

/* ------------------------------------------------------------------ Hero */

function useDemoNumbers() {
  const tenant = useAppStore((s) => s.tenants[DEMO_TENANT_ID])
  return useMemo(() => {
    if (!tenant) return null
    const ledger = new Ledger(tenant.accounts)
    const now = new Date()
    const months: string[] = []
    for (let i = 6; i >= 1; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7))
    const series = monthlySeries(ledger, tenant.journal, months)
    const last = months.at(-1)!
    const pl = profitAndLoss(ledger, tenant.journal, `${last}-01`, `${last}-31`)
    const bs = balanceSheet(ledger, tenant.journal)
    const ag = aging(tenant.invoices, 'OUT', now)
    return { series, pl, bs, ag, months }
  }, [tenant])
}

function Hero() {
  const t = useT()
  const d = useDemoNumbers()
  return (
    <section className="relative pt-32 pb-16 sm:pt-40 sm:pb-24">
      <div className="aurora" />
      <div className="grid-bg absolute inset-x-0 top-0 h-[720px]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border bg-surface/60 px-3.5 py-1.5 text-xs font-medium text-muted backdrop-blur animate-fade-up">
            <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
            {t('landing.hero.eyebrow')}
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-[68px] animate-fade-up [animation-delay:80ms]">
            <span className="block">{t('landing.hero.title1')}</span>
            <span className="block text-gradient">{t('landing.hero.title2')}</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted sm:text-xl animate-fade-up [animation-delay:160ms]">{t('landing.hero.sub')}</p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row animate-fade-up [animation-delay:240ms]">
            <Link to="/register">
              <Button size="xl" iconRight={<ArrowRight size={18} />}>
                {t('landing.cta.start')}
              </Button>
            </Link>
            <Link to="/login?demo=1">
              <Button size="xl" variant="glass" icon={<Play size={16} />}>
                {t('landing.cta.watchDemo')}
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-faint animate-fade-up [animation-delay:300ms]">{t('landing.hero.note')}</p>
        </div>

        {/* Executive dashboard visual */}
        <div className="relative mx-auto mt-16 max-w-6xl animate-fade-up [animation-delay:380ms]">
          <div className="absolute -inset-x-10 -top-10 h-40 bg-brand/20 blur-3xl" />
          <div className="relative glass-strong sheen rounded-[28px] p-2 shadow-lift">
            <div className="rounded-[22px] border bg-canvas/80 p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand/12 text-brand font-bold text-sm">BG</span>
                  <div>
                    <p className="text-sm font-semibold">BALANS GROUP · {t('dash.owner.title')}</p>
                    <p className="text-2xs text-faint">{t('role.OWNER')} · {t('common.demoBadge')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="sky" dot>
                    {t('trial.badge')}
                  </Badge>
                  <Badge tone="gold">Premium Plus</Badge>
                </div>
              </div>
              {d && (
                <>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <HeroKpi label={t('dash.revenue')} value={money(d.pl.revenue, { compact: true })} delta={d.series.length > 1 ? ((d.pl.revenue - d.series.at(-2)!.revenue) / d.series.at(-2)!.revenue) * 100 : 0} spark={d.series.map((s) => s.revenue)} color="brand" />
                    <HeroKpi label={t('dash.profit')} value={money(d.pl.netProfit, { compact: true })} delta={d.series.length > 1 && d.series.at(-2)!.profit ? ((d.pl.netProfit - d.series.at(-2)!.profit) / Math.abs(d.series.at(-2)!.profit)) * 100 : 0} spark={d.series.map((s) => s.profit)} color="sky" />
                    <HeroKpi label={t('dash.cash')} value={money(d.bs.cash + d.bs.bank, { compact: true })} spark={d.series.map((s) => s.revenue - s.expenses)} color="violet" />
                    <HeroKpi label={t('dash.receivables')} value={money(d.bs.receivables, { compact: true })} sub={`${money(d.ag.overdue, { compact: true })} ${t('dash.overdue').toLowerCase()}`} spark={d.series.map((s) => s.expenses)} color="gold" />
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                    <div className="rounded-2xl border bg-surface/70 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold">{t('dash.trend')}</p>
                        <span className="text-2xs text-faint">{t('dash.trend.sub')}</span>
                      </div>
                      <AreaChart
                        height={190}
                        labels={d.months.map((m) => fmtMonth(`${m}-01`))}
                        formatY={(v) => money(v, { compact: true, currency: '' })}
                        formatTip={(v) => money(v, { compact: true })}
                        series={[
                          { key: 'rev', label: t('dash.revenue'), color: 'brand', values: d.series.map((s) => s.revenue) },
                          { key: 'exp', label: t('dash.expenses'), color: 'danger', values: d.series.map((s) => s.expenses + s.cogs), dashed: true },
                        ]}
                      />
                    </div>
                    <div className="grid gap-4">
                      <div className="rounded-2xl border bg-surface/70 p-4">
                        <p className="mb-2 text-sm font-semibold">{t('dash.structure')}</p>
                        <Donut size={120} thickness={14} centerLabel={t('common.thisMonth')} centerValue={money(d.pl.opex, { compact: true, currency: '' })} formatValue={(v) => money(v, { compact: true, currency: '' })} data={d.pl.opexByAccount.slice(0, 4).map((r, i) => ({ label: r.account.name.replace(/Ma'muriy xarajatlar — /, ''), value: r.amount, color: (['brand', 'sky', 'violet', 'gold'] as const)[i] }))} />
                      </div>
                      <div className="flex items-center gap-4 rounded-2xl border bg-brand/8 p-4">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand text-brand-ink">
                          <Sparkles size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-brand">AI CFO · {t('ai.kind.RISK')}</p>
                          <p className="truncate text-xs text-muted">{d.ag.overdue > 0 ? `Muddati o'tgan debitorlik ${money(d.ag.overdue, { compact: true })} — 3 mijoz 30+ kun.` : 'Muddati o‘tgan to‘lov yo‘q.'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* floating chips */}
          <div className="pointer-events-none absolute -left-4 top-24 hidden animate-float lg:block">
            <div className="glass rounded-2xl px-4 py-3 shadow-card">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <EyeOff size={13} className="text-danger" /> {t('role.SALES_EMPLOYEE')}
              </p>
              <p className="mt-1 text-2xs text-muted">{t('dash.profit')}: {t('common.locked')}</p>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-4 bottom-20 hidden animate-float [animation-delay:1.2s] lg:block">
            <div className="glass rounded-2xl px-4 py-3 shadow-card">
              <p className="flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2 size={13} className="text-brand" /> Savdo S-2026-00312
              </p>
              <p className="mt-1 text-2xs text-muted">Ombor −6 · Faktura · O‘tkazma JE-…</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroKpi({ label, value, delta, sub, spark, color }: { label: string; value: string; delta?: number; sub?: string; spark: number[]; color: 'brand' | 'sky' | 'violet' | 'gold' }) {
  return (
    <div className="rounded-2xl border bg-surface/70 p-4">
      <p className="text-2xs uppercase tracking-wider text-faint">{label}</p>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div>
          <p className="text-lg font-semibold tnum leading-none">{value}</p>
          {delta !== undefined ? <p className={cx('mt-1.5 text-2xs tnum', delta >= 0 ? 'text-success' : 'text-danger')}>{pct(delta, 1, true)}</p> : sub ? <p className="mt-1.5 text-2xs text-faint">{sub}</p> : null}
        </div>
        <Sparkline values={spark} color={color} width={72} height={26} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ TrustStrip */

function TrustStrip() {
  const t = useT()
  const items = ['Savdo do‘koni', 'Ulgurji baza', 'Mebel zavodi', 'To‘qimachilik fabrikasi', 'Restoran', 'Qurilish kompaniyasi', 'Logistika', 'Farmatsevtika', 'IT xizmat', 'Agro eksport', 'Non kombinati', 'Avto servis']
  return (
    <section className="border-y bg-surface/40 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.18em] text-faint">{t('landing.trust.title')}</p>
        <div className="mask-fade-x overflow-hidden">
          <div className="flex w-max animate-marquee gap-3">
            {[...items, ...items].map((x, i) => (
              <span key={i} className="rounded-full border bg-surface px-4 py-2 text-sm text-muted">
                {x}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Problem */

function Problem() {
  const t = useT()
  const items = [
    { icon: Database, k: 1 },
    { icon: Eye, k: 2 },
    { icon: BarChart3, k: 3 },
    { icon: Sparkles, k: 4 },
  ]
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.problem.title')}</h2>
          <p className="mt-3 text-muted">{t('landing.problem.sub')}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, k }) => (
            <Card key={k} hover className="group">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-danger/10 text-danger transition group-hover:bg-brand/12 group-hover:text-brand">
                <Icon size={20} />
              </span>
              <h3 className="mt-4 text-base font-semibold">{t(`landing.problem.${k}.title` as DictKey)}</h3>
              <p className="mt-2 text-sm text-muted leading-relaxed">{t(`landing.problem.${k}.body` as DictKey)}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Features */

const FEATURES = [
  { key: 'accounting', icon: BookOpen, tone: 'brand' },
  { key: 'sales', icon: ShoppingCart, tone: 'sky' },
  { key: 'warehouse', icon: Boxes, tone: 'violet' },
  { key: 'purchasing', icon: PackageCheck, tone: 'gold' },
  { key: 'manufacturing', icon: Factory, tone: 'brand' },
  { key: 'crm', icon: Users, tone: 'sky' },
  { key: 'hr', icon: UserCog, tone: 'violet' },
  { key: 'payroll', icon: Wallet, tone: 'gold' },
  { key: 'reports', icon: BarChart3, tone: 'brand' },
  { key: 'ai', icon: Sparkles, tone: 'sky' },
] as const

function Features() {
  const t = useT()
  return (
    <section id="features" className="relative scroll-mt-28 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="brand" className="mb-4">
            {t('landing.nav.product')}
          </Badge>
          <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.features.title')}</h2>
          <p className="mt-3 text-muted">{t('landing.features.sub')}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map(({ key, icon: Icon, tone }) => (
            <Card key={key} hover className="group relative overflow-hidden">
              <div className={cx('absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-60', tone === 'brand' ? 'bg-brand' : tone === 'sky' ? 'bg-sky' : tone === 'violet' ? 'bg-violet' : 'bg-gold')} />
              <span className={cx('relative grid h-11 w-11 place-items-center rounded-2xl', tone === 'brand' ? 'bg-brand/12 text-brand' : tone === 'sky' ? 'bg-sky/12 text-sky' : tone === 'violet' ? 'bg-violet/12 text-violet' : 'bg-gold/14 text-gold')}>
                <Icon size={20} />
              </span>
              <h3 className="relative mt-4 text-base font-semibold">{t(`landing.features.${key}` as DictKey)}</h3>
              <p className="relative mt-1.5 text-sm text-muted leading-relaxed">{t(`landing.features.${key}.d` as DictKey)}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Workflow */

function Workflow() {
  const t = useT()
  const steps = [1, 2, 3, 4, 5, 6] as const
  const icons = [Store, Boxes, FileText, BookOpen, BarChart3, Sparkles]
  return (
    <section className="relative py-20 sm:py-28 bg-surface/30 border-y">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <Badge tone="sky" className="mb-4">
              Workflow
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.workflow.title')}</h2>
            <p className="mt-3 text-muted">{t('landing.workflow.sub')}</p>
            <div className="mt-8 rounded-2xl border bg-surface p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">Buxgalteriya o‘tkazmasi (avtomatik)</p>
              <table className="mt-3 w-full text-sm">
                <tbody className="font-mono text-[13px]">
                  {[
                    ['5010 Kassa', 'Dt', '1 650 000'],
                    ['9010 Daromad', 'Kt', '1 473 214'],
                    ['6411 Chiqish QQS', 'Kt', '176 786'],
                    ['9110 Tannarx', 'Dt', '1 004 300'],
                    ['2800 Tayyor mahsulot', 'Kt', '1 004 300'],
                  ].map(([a, s, v]) => (
                    <tr key={a} className="border-b last:border-0">
                      <td className="py-1.5 text-muted">{a}</td>
                      <td className={cx('py-1.5 text-center', s === 'Dt' ? 'text-brand' : 'text-sky')}>{s}</td>
                      <td className="py-1.5 text-right tnum">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-2xs text-faint">Debet = Kredit · 2 654 300. Bitta savdo → to‘liq balanslangan o‘tkazma.</p>
            </div>
          </div>
          <ol className="relative space-y-3">
            <span className="absolute left-[22px] top-4 bottom-4 w-px bg-gradient-to-b from-brand via-sky to-violet" />
            {steps.map((s, i) => {
              const Icon = icons[i]
              return (
                <li key={s} className="relative flex items-center gap-4 rounded-2xl border bg-surface p-4 pl-5 transition hover:translate-x-1">
                  <span className="relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-canvas ring-1 ring-brand/40">
                    <Icon size={16} className="text-brand" />
                  </span>
                  <span className="text-sm">
                    <b className="mr-2 text-faint tnum">0{s}</b>
                    {t(`landing.workflow.${s}` as DictKey)}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ Permissions */

function Permissions() {
  const t = useT()
  const roles = [
    { key: 'owner', icon: KeyRound, sees: [true, true, true, true, true, true], tone: 'brand' },
    { key: 'accountant', icon: BookOpen, sees: [true, true, false, true, true, true], tone: 'sky' },
    { key: 'sales', icon: Store, sees: [false, false, false, false, false, true], tone: 'gold' },
    { key: 'warehouse', icon: Boxes, sees: [false, false, false, false, false, false], tone: 'violet' },
  ] as const
  const cols = [t('dash.revenue'), t('dash.expenses'), t('dash.profit'), t('dash.bank'), t('nav.payroll'), t('nav.customers')]
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="danger" className="mb-4">
            <Lock size={11} /> RBAC
          </Badge>
          <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.permissions.title')}</h2>
          <p className="mt-3 text-muted">{t('landing.permissions.sub')}</p>
        </div>
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map(({ key, icon: Icon, tone }) => (
              <Card key={key} className="relative">
                <span className={cx('grid h-10 w-10 place-items-center rounded-xl', tone === 'brand' ? 'bg-brand/12 text-brand' : tone === 'sky' ? 'bg-sky/12 text-sky' : tone === 'gold' ? 'bg-gold/14 text-gold' : 'bg-violet/12 text-violet')}>
                  <Icon size={18} />
                </span>
                <h3 className="mt-3 font-semibold">{t(`landing.permissions.${key}` as DictKey)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`landing.permissions.${key}.d` as DictKey)}</p>
              </Card>
            ))}
            <Card className="sm:col-span-2 border-brand/30 bg-brand/6">
              <div className="flex gap-3">
                <Sparkles className="shrink-0 text-brand" size={20} />
                <div>
                  <h3 className="font-semibold">{t('landing.permissions.ai')}</h3>
                  <p className="mt-1 text-sm text-muted">{t('landing.permissions.ai.d')}</p>
                </div>
              </div>
            </Card>
          </div>
          <Card padded={false} className="overflow-hidden">
            <div className="border-b px-5 py-3 text-xs font-semibold uppercase tracking-wider text-faint">{t('set.permissions')} · {t('set.permissions.sensitive')}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-2xs text-faint">
                    <th className="px-5 py-2 text-left font-medium">Rol</th>
                    {cols.map((c) => (
                      <th key={c} className="px-2 py-2 text-center font-medium">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="px-5 py-3 font-medium">{t(`landing.permissions.${r.key}` as DictKey)}</td>
                      {r.sees.map((v, i) => (
                        <td key={i} className="px-2 py-3 text-center">
                          {v ? <Eye size={16} className="mx-auto text-brand" /> : <EyeOff size={16} className="mx-auto text-faint" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t bg-raised/40 px-5 py-3 text-xs text-muted">Egasi har bir kalitni alohida yoqadi yoki o‘chiradi. O‘zgarish audit jurnaliga tushadi.</div>
          </Card>
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- Factories */

function Factories() {
  const t = useT()
  const tenant = useAppStore((s) => s.tenants[DEMO_TENANT_ID])
  const cards = [
    { k: 'production', icon: Factory },
    { k: 'materials', icon: Layers },
    { k: 'warehouse', icon: Boxes },
    { k: 'machines', icon: Wrench },
    { k: 'cost', icon: HandCoins },
    { k: 'quality', icon: ClipboardCheck },
    { k: 'goods', icon: Truck },
  ] as const
  const active = tenant?.productionOrders.filter((o) => !['CLOSED', 'CANCELLED'].includes(o.status)).slice(0, 4) ?? []
  return (
    <section id="factories" className="relative scroll-mt-28 border-y bg-surface/30 py-20 sm:py-28">
      <div className="aurora aurora-3 opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <Badge tone="gold" className="mb-4">
              Premium Plus
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.factories.title')}</h2>
            <p className="mt-3 text-muted">{t('landing.factories.sub')}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {cards.map(({ k, icon: Icon }) => (
                <div key={k} className="flex gap-3 rounded-2xl border bg-surface p-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/14 text-gold">
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{t(`landing.factories.${k}` as DictKey)}</p>
                    <p className="mt-0.5 text-xs text-muted">{t(`landing.factories.${k}.d` as DictKey)}</p>
                  </div>
                </div>
              ))}
            </div>
            <Link to="/login?demo=1&as=u_otabek" className="mt-6 inline-block">
              <Button variant="gold" iconRight={<ArrowRight size={16} />}>
                {t('landing.factories.cta')}
              </Button>
            </Link>
          </div>
          <div className="glass-strong sheen rounded-3xl p-2 shadow-lift">
            <div className="rounded-[20px] border bg-canvas/80 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold">{t('dash.production.title')}</p>
                <Badge tone="gold">{t('common.demoBadge')}</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border bg-surface/70 p-3 text-center">
                  <GaugeChart value={tenant ? (tenant.machines.filter((m) => m.state === 'RUNNING').length / tenant.machines.length) * 100 : 60} label={t('dash.production.oee')} size={100} />
                </div>
                <div className="rounded-2xl border bg-surface/70 p-3">
                  <p className="text-2xs text-faint">{t('dash.production.active')}</p>
                  <p className="mt-1 text-2xl font-semibold tnum">{active.length}</p>
                  <p className="text-2xs text-muted">{active.filter((o) => o.status === 'QC').length} QC da</p>
                </div>
                <div className="rounded-2xl border bg-surface/70 p-3">
                  <p className="text-2xs text-faint">{t('dash.production.scrap')}</p>
                  <p className="mt-1 text-2xl font-semibold tnum">1,8%</p>
                  <p className="text-2xs text-success">−0,4% oyga</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {active.map((o) => {
                  const prod = tenant!.products.find((p) => p.id === o.productId)
                  const prog = Math.round((o.producedQty / o.plannedQty) * 100)
                  return (
                    <div key={o.id} className="rounded-xl border bg-surface/70 px-3 py-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{o.number} · {prod?.name}</span>
                        <Badge tone={o.status === 'QC' ? 'violet' : 'warning'} size="xs">
                          {t(`mfg.status.${o.status}` as DictKey)}
                        </Badge>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/10">
                          <div className="h-full rounded-full bg-gold" style={{ width: `${prog}%` }} />
                        </div>
                        <span className="text-2xs text-muted tnum">
                          {o.producedQty}/{o.plannedQty}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border bg-surface/70 p-3 text-center text-2xs">
                <div>
                  <p className="text-faint">{t('mfg.planned')}</p>
                  <p className="font-semibold tnum">1,21 mln</p>
                </div>
                <div>
                  <p className="text-faint">{t('mfg.actual')}</p>
                  <p className="font-semibold tnum">1,26 mln</p>
                </div>
                <div>
                  <p className="text-faint">{t('mfg.variance')}</p>
                  <p className="font-semibold tnum text-danger">+4,1%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------- Industries */

const INDUSTRY_CARDS = [
  { k: 'TRADING', icon: ShoppingCart, mods: ['Savdo', 'Xarid', 'Ombor', 'Debitorlik'] },
  { k: 'FACTORY', icon: Factory, mods: ['BOM', 'Ishlab chiqarish', 'Uskuna', 'Tannarx'] },
  { k: 'SERVICE', icon: Cog, mods: ['Loyihalar', 'Aktlar', 'Fakturalar', 'CRM'] },
  { k: 'RETAIL', icon: Store, mods: ['Kassa', 'Shtrix-kod', 'Tez savdo', 'Qoldiq'] },
  { k: 'WHOLESALE', icon: Truck, mods: ['Ulgurji narx', 'Kredit limit', 'Ko‘p ombor', 'Sverka'] },
  { k: 'RESTAURANT', icon: HandCoins, mods: ['Retsept', 'Oshxona sarfi', 'Kassa', 'Xarid'] },
  { k: 'CONSTRUCTION', icon: Building2, mods: ['Obyektlar', 'Smeta', 'Pudrat', 'Material'] },
  { k: 'LOGISTICS', icon: Gauge, mods: ['Reyslar', 'Yoqilg‘i', 'Asosiy vositalar', 'Xarajat'] },
  { k: 'OTHER', icon: Layers, mods: ['Buxgalteriya', 'Savdo', 'Ombor', 'AI CFO'] },
] as const

function Industries() {
  const t = useT()
  return (
    <section id="industries" className="scroll-mt-28 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.industries.title')}</h2>
          <p className="mt-3 text-muted">{t('landing.industries.sub')}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRY_CARDS.map(({ k, icon: Icon, mods }) => (
            <Link key={k} to={`/register?type=${k}`} className="card sheen group p-5 transition-all hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-line/6 text-muted transition group-hover:bg-brand/12 group-hover:text-brand">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-semibold">{t(`biz.${k}` as DictKey)}</p>
                  <p className="text-xs text-muted">{t(`biz.desc.${k}` as DictKey)}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {mods.map((m) => (
                  <Badge key={m} tone="muted">
                    {m}
                  </Badge>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------------- AI */

function AiSection() {
  const t = useT()
  return (
    <section id="ai" className="relative scroll-mt-28 border-y bg-surface/30 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="glass-strong sheen rounded-3xl p-5 shadow-lift">
              <div className="space-y-4">
                <ChatLine who="Sotuvchi" q="Bugungi kompaniya foydasi qancha?" a={t('ai.denied.profit')} denied />
                <ChatLine who="Buxgalter" q="Bu oy xarajatlar qancha?" a="FAKT · Joriy oy operatsion xarajatlari 71,4 mln so‘m; o‘tgan oy 66,9 mln. «Sotish xarajatlari (marketing)» o‘tgan oyga nisbatan +18% oshgan." />
                <ChatLine who="Egasi" q="Bu oy foyda nima uchun kamaydi?" a="FAKT · Sof foyda 118 mln → 96 mln. BAHO · Asosiy ta’sir: tannarx ulushi 56% → 59%, marketing +18%. TAVSIYA · «Premium» stol uchun chegirmani 7% dan 3% ga tushiring." />
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <Badge tone="brand" className="mb-4">
              <Sparkles size={11} /> AI CFO
            </Badge>
            <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.ai.title')}</h2>
            <p className="mt-3 text-muted">{t('landing.ai.sub')}</p>
            <div className="mt-8 space-y-3">
              {(['fact', 'estimate', 'recommendation'] as const).map((k) => (
                <div key={k} className="flex items-start gap-3 rounded-2xl border bg-surface p-4">
                  <Badge tone={k === 'fact' ? 'brand' : k === 'estimate' ? 'sky' : 'gold'} className="mt-0.5 shrink-0">
                    {t(`landing.ai.${k}` as DictKey)}
                  </Badge>
                  <p className="text-sm text-muted">{t(`landing.ai.${k}.d` as DictKey)}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 flex items-start gap-2 text-sm text-muted">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-brand" /> {t('landing.ai.nodata')}
            </p>
            <Link to="/login?demo=1" className="mt-6 inline-block">
              <Button iconRight={<ArrowRight size={16} />}>{t('landing.ai.cta')}</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function ChatLine({ who, q, a, denied }: { who: string; q: string; a: string; denied?: boolean }) {
  return (
    <div>
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm text-brand-ink">
          <span className="mr-2 text-[10px] font-bold uppercase opacity-70">{who}</span>
          {q}
        </div>
      </div>
      <div className="mt-2 flex gap-2.5">
        <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-brand/12 text-brand">
          <Sparkles size={12} />
        </span>
        <div className={cx('max-w-[90%] rounded-2xl rounded-tl-md border px-3.5 py-2 text-sm', denied ? 'border-warning/30 bg-warning/8 text-ink' : 'bg-raised/60 text-ink')}>
          {denied && <Lock size={12} className="mr-1.5 inline text-warning" />}
          {a}
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- Security */

function Security() {
  const t = useT()
  const items = [
    { k: 'tenant', icon: Database },
    { k: 'rbac', icon: ShieldCheck },
    { k: 'audit', icon: ScrollText },
    { k: 'session', icon: KeyRound },
    { k: 'transport', icon: Lock },
    { k: 'backup', icon: HardDrive },
  ] as const
  return (
    <section id="security" className="scroll-mt-28 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold sm:text-4xl">{t('landing.security.title')}</h2>
          <p className="mt-3 text-muted">{t('landing.security.sub')}</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ k, icon: Icon }) => (
            <Card key={k} hover>
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-line/6 text-ink">
                <Icon size={18} />
              </span>
              <h3 className="mt-4 font-semibold">{t(`landing.security.${k}` as DictKey)}</h3>
              <p className="mt-1.5 text-sm text-muted">{t(`landing.security.${k}.d` as DictKey)}</p>
            </Card>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-faint">{t('landing.security.disclaimer')}</p>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------- FAQ */

function Faq() {
  const t = useT()
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section className="border-t py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-center text-3xl font-bold">{t('landing.faq.title')}</h2>
        <div className="mt-10 divide-y rounded-3xl border bg-surface">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <button onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left">
                <span className="font-medium">{t(`landing.faq.${i}.q` as DictKey)}</span>
                <ChevronDown size={18} className={cx('shrink-0 text-faint transition-transform', open === i && 'rotate-180')} />
              </button>
              {open === i && <p className="px-6 pb-5 text-sm text-muted animate-fade-in">{t(`landing.faq.${i}.a` as DictKey)}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Final CTA */

function FinalCta() {
  const t = useT()
  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div className="aurora" />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
        <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-5xl">{t('landing.trial.title')}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{t('landing.trial.sub')}</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/register">
            <Button size="xl" iconRight={<ArrowRight size={18} />}>
              {t('landing.cta.start')}
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="xl" variant="glass">
              {t('landing.cta.seePricing')}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
