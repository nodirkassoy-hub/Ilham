import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, CheckCircle2, CreditCard, Info, Lock, ShieldCheck } from 'lucide-react'
import { useAction, useSession } from '@/app/useSession'
import { useT } from '@/core/i18n'
import { useAppStore } from '@/store/appStore'
import { PLANS, annualSaving, priceFor } from '@/core/billing/plans'
import { PAYMENT_PROVIDERS, type BillingCycle, type PaymentProvider, type PlanId } from '@/core/domain/enums'
import { Badge, Button, Card, SectionHeader, Segmented } from '@/ui/primitives'
import { AccessDenied } from '@/ui/gates'
import { cx, money } from '@/core/utils/format'
import type { DictKey } from '@/core/i18n/uz'

/**
 * Subscription checkout. Providers are integration *targets*: none is
 * connected, and the UI says so on every card. The confirm button is
 * explicitly labelled as a demo simulation.
 */
const PROVIDER_META: Record<PaymentProvider, { label: DictKey; hint: string; connected: boolean }> = {
  PAYME: { label: 'checkout.method.payme', hint: 'Payme Business · Merchant API', connected: false },
  CLICK: { label: 'checkout.method.click', hint: 'Click Merchant API · SHOP-API', connected: false },
  UZUM: { label: 'checkout.method.uzum', hint: 'Uzum Bank · Uzum Pay', connected: false },
  BANK_TRANSFER: { label: 'checkout.method.bank', hint: 'Hisob-faktura asosida bank o‘tkazmasi', connected: false },
}

export default function CheckoutPage() {
  const t = useT()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const { tenant, can } = useSession()
  const overrides = useAppStore((s) => s.planOverrides)
  const simulate = useAppStore((s) => s.simulateCheckout)
  const run = useAction()
  const [planId, setPlanId] = useState<PlanId>((['PREMIUM', 'PREMIUM_PLUS'].includes(sp.get('plan') ?? '') ? sp.get('plan') : 'PREMIUM') as PlanId)
  const [cycle, setCycle] = useState<BillingCycle>(sp.get('cycle') === 'ANNUAL' ? 'ANNUAL' : 'MONTHLY')
  const [provider, setProvider] = useState<PaymentProvider>('PAYME')
  const [done, setDone] = useState<string | null>(null)
  if (!tenant || !can('billing.edit')) return <AccessDenied perm="billing.edit" />
  const ov = overrides[planId]
  const price = ov ? (cycle === 'ANNUAL' ? ov.priceAnnual : ov.priceMonthly) : priceFor(planId, cycle)
  const vat = Math.round(price * 0.12)
  const total = price + vat
  const saving = cycle === 'ANNUAL' ? annualSaving(planId) : 0

  if (done) {
    return (
      <div className="mx-auto max-w-lg">
        <Card className="text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-brand/12 text-brand"><CheckCircle2 size={32} /></div>
          <h2 className="mt-4 text-xl font-semibold">{t('checkout.success.title')}</h2>
          <p className="mt-1 text-sm text-muted">{t('checkout.success.sub')}</p>
          <div className="mt-4 rounded-2xl border p-4 text-left text-sm"><div className="flex justify-between"><span className="text-muted">{t('checkout.plan')}</span><b>{PLANS[planId].name}</b></div><div className="flex justify-between"><span className="text-muted">{t('billing.invoices')}</span><span className="font-mono">{done}</span></div><div className="flex justify-between"><span className="text-muted">{t('billing.status')}</span><Badge tone="success" dot>{t('sub.ACTIVE')}</Badge></div><div className="flex justify-between"><span className="text-muted">{t('checkout.method')}</span><Badge tone="warning">{provider} · SIMULYATSIYA</Badge></div></div>
          <Button block className="mt-5" onClick={() => nav('/app')}>{t('checkout.success.back')}</Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('checkout.title')} sub={t('checkout.sub')} actions={<Link to="/app/settings/billing"><Button variant="ghost" icon={<ArrowLeft size={16} />}>{t('billing.title')}</Button></Link>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Card>
            <p className="mb-3 text-sm font-semibold">{t('checkout.plan')}</p>
            <div className="grid gap-3 sm:grid-cols-2">{(['PREMIUM', 'PREMIUM_PLUS'] as PlanId[]).map((p) => <button key={p} onClick={() => setPlanId(p)} className={cx('rounded-2xl border p-4 text-left transition', planId === p ? 'border-brand bg-brand/8' : 'hover:bg-line/5')}><div className="flex items-center justify-between"><span className="font-semibold">{PLANS[p].name}</span>{PLANS[p].badge && <Badge tone={p === 'PREMIUM' ? 'brand' : 'gold'} size="xs">{p === 'PREMIUM' ? t('plan.popular') : t('plan.full')}</Badge>}</div><p className="mt-1 text-xs text-muted">{t(PLANS[p].tagline as DictKey)}</p><p className="mt-2 text-lg font-semibold tnum">{money(cycle === 'ANNUAL' ? Math.round(priceFor(p, 'ANNUAL') / 12) : priceFor(p, 'MONTHLY'))} <span className="text-xs font-normal text-muted">{t('common.perMonth')}</span></p></button>)}</div>
            <div className="mt-4 flex items-center justify-between"><p className="text-sm font-medium">{t('checkout.cycle')}</p><Segmented value={cycle} onChange={setCycle} options={[{ value: 'MONTHLY', label: t('plan.billing.monthly') }, { value: 'ANNUAL', label: t('plan.billing.annual'), badge: <Badge tone="brand" size="xs">−17%</Badge> }]} /></div>
          </Card>
          <Card>
            <p className="mb-1 text-sm font-semibold">{t('checkout.method')}</p>
            <p className="mb-3 text-xs text-muted">{t('checkout.provider.notConnected.long')}</p>
            <div className="grid gap-2 sm:grid-cols-2">{PAYMENT_PROVIDERS.map((p) => { const m = PROVIDER_META[p]; return <button key={p} onClick={() => setProvider(p)} className={cx('flex items-center gap-3 rounded-2xl border p-3 text-left transition', provider === p ? 'border-brand bg-brand/8' : 'hover:bg-line/5')}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-line/6 text-muted">{p === 'BANK_TRANSFER' ? <Building2 size={18} /> : <CreditCard size={18} />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{t(m.label)}</span><span className="block truncate text-2xs text-faint">{m.hint}</span></span><Badge tone={m.connected ? 'success' : 'muted'} size="xs">{m.connected ? t('checkout.provider.connected') : t('checkout.provider.notConnected')}</Badge></button> })}</div>
          </Card>
          <div className="flex items-start gap-3 rounded-2xl border border-dashed p-4 text-xs text-muted"><Info size={15} className="mt-0.5 shrink-0 text-sky" /><span>{t('checkout.simulateNote')} Haqiqiy integratsiya <code>PaymentProviderAdapter</code> interfeysi orqali ulanadi: <code>createInvoice → redirect → webhook → subscription.ACTIVE</code>.</span></div>
        </div>
        <Card className="h-fit lg:sticky lg:top-24">
          <p className="text-sm font-semibold">{t('checkout.order')}</p>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted">{PLANS[planId].name} · {cycle === 'ANNUAL' ? '12 oy' : '1 oy'}</span><span className="tnum">{money(cycle === 'ANNUAL' ? PLANS[planId].priceMonthly * 12 : price)}</span></div>
            {saving > 0 && <div className="flex justify-between text-brand"><span>{t('checkout.discount')}</span><span className="tnum">−{money(saving)}</span></div>}
            <div className="flex justify-between"><span className="text-muted">{t('checkout.vat')}</span><span className="tnum">{money(vat)}</span></div>
            <div className="flex justify-between border-t pt-2 text-base font-semibold"><span>{t('checkout.total')}</span><span className="tnum">{money(total)}</span></div>
          </div>
          <Button block size="lg" className="mt-5" icon={<Lock size={16} />} onClick={() => { const r = run(() => simulate(planId, cycle, provider), { title: t('checkout.success.title') }); if (r) setDone(r.invoiceNumber) }}>{t('checkout.simulate')}</Button>
          <p className="mt-3 flex items-start gap-2 text-2xs text-faint"><ShieldCheck size={12} className="mt-0.5 shrink-0" />{t('checkout.simulateNote')}</p>
        </Card>
      </div>
    </div>
  )
}
