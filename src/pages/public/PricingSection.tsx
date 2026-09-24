import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Lock, Sparkles } from 'lucide-react'
import { useT } from '@/core/i18n'
import { ANNUAL_DISCOUNT_PCT, COMPARISON_GROUPS, PLAN_LIST, annualSaving, monthlyEquivalent, priceFor } from '@/core/billing/plans'
import type { BillingCycle, PlanId } from '@/core/domain/enums'
import { money } from '@/core/utils/format'
import { Badge, Button, CheckIcon, Segmented } from '@/ui/primitives'
import { cx } from '@/core/utils/format'
import { useAppStore } from '@/store/appStore'
import type { DictKey } from '@/core/i18n/uz'

const PLAN_POINTS: Record<PlanId, string[]> = {
  FREE: ['Asosiy mahsulot katalogi (100 tagacha)', 'Oddiy savdo kiritish', 'Mijozlar ro‘yxati', 'Qoldiqlar ko‘rinishi', 'Savdo tarixi', 'Cheklangan hisobotlar', '1 kompaniya · 1 ombor · 2 foydalanuvchi', 'AI CFO — 20 savol / oy'],
  PREMIUM: ['To‘liq buxgalteriya: kirim, chiqim, bosh daftar', 'Hisob-fakturalar, debitorlik va kreditorlik', 'Ombor, xarid va ta‘minotchilar', 'Pul oqimi, foyda-zarar, balans', '10 tagacha foydalanuvchi · 3 ombor · filiallar', 'AI CFO — 500 savol / oy', 'Excel va PDF eksport', 'Audit tarixi va rol ruxsatlari'],
  PREMIUM_PLUS: ['Premium tarifidagi hammasi', 'Cheksiz foydalanuvchi, ombor va kompaniyalar', 'Ishlab chiqarish: retsept, tannarx, uskunalar', 'HR va ish haqi, asosiy vositalar, loyihalar', 'Bank sverkasi va tasdiqlash jarayonlari', 'To‘liq AI CFO: tahlil, anomaliya, prognoz', 'Kengaytirilgan ruxsatlar va audit', 'API kirish va prioritet qo‘llab-quvvatlash'],
}

export function PricingCards({ cycle, onChoose, currentPlan, compact }: { cycle: BillingCycle; onChoose?: (planId: PlanId) => void; currentPlan?: PlanId; compact?: boolean }) {
  const t = useT()
  const overrides = useAppStore((s) => s.planOverrides)
  return (
    <div className={cx('grid gap-5', compact ? 'lg:grid-cols-3' : 'md:grid-cols-3')}>
      {PLAN_LIST.map((p) => {
        const ov = overrides[p.id]
        const price = ov ? (cycle === 'ANNUAL' ? ov.priceAnnual : ov.priceMonthly) : priceFor(p.id, cycle)
        const perMonth = cycle === 'ANNUAL' ? Math.round(price / 12) : price
        const highlight = p.id === 'PREMIUM'
        const plus = p.id === 'PREMIUM_PLUS'
        const isCurrent = currentPlan === p.id
        const cta = p.id === 'FREE' ? t('plan.free.cta') : p.id === 'PREMIUM' ? t('plan.premium.cta') : t('plan.plus.cta')
        return (
          <div key={p.id} className={cx('relative flex flex-col rounded-3xl border p-6 sm:p-7 transition-all duration-300', highlight ? 'border-brand/40 bg-surface shadow-glow scale-[1.015] z-10' : plus ? 'border-gold/30 bg-surface shadow-card' : 'bg-surface/70 shadow-card', ov && !ov.isActive && 'opacity-60')}>
            {p.badge && (
              <span className={cx('absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide', highlight ? 'bg-brand text-brand-ink' : 'bg-gold text-[#1c1400]')}>
                {p.id === 'PREMIUM' ? t('plan.popular') : t('plan.full')}
              </span>
            )}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">{p.name}</h3>
                <p className="mt-1 text-sm text-muted min-h-[40px]">{t(p.tagline as DictKey)}</p>
              </div>
              {plus && <Sparkles className="text-gold" size={20} />}
            </div>
            <div className="mt-5">
              <div className="flex items-end gap-1.5">
                <span className="font-display text-3xl sm:text-[34px] font-bold tracking-tight tnum">{perMonth === 0 ? '0' : money(perMonth, { currency: '' })}</span>
                <span className="mb-1.5 text-sm text-muted">so‘m {t('common.perMonth')}</span>
              </div>
              {cycle === 'ANNUAL' && price > 0 ? (
                <p className="mt-1 text-xs text-muted">
                  {money(price)} {t('common.perYear')} · <span className="text-brand font-medium">{money(annualSaving(p.id), { compact: true })} tejaysiz</span>
                </p>
              ) : (
                <p className="mt-1 text-xs text-faint">{price === 0 ? 'Doimiy bepul' : 'Har oy to‘lanadi · istalgan vaqtda bekor qilinadi'}</p>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {PLAN_POINTS[p.id].map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <span className={cx('mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full', highlight ? 'bg-brand/15 text-brand' : plus ? 'bg-gold/15 text-gold' : 'bg-line/10 text-muted')}>
                    <Check size={11} strokeWidth={3} />
                  </span>
                  <span className="text-ink/90">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              {isCurrent ? (
                <Button block variant="secondary" disabled>
                  {t('plan.current')}
                </Button>
              ) : onChoose ? (
                <Button block variant={highlight ? 'primary' : plus ? 'gold' : 'secondary'} onClick={() => onChoose(p.id)} disabled={ov ? !ov.isActive : false}>
                  {cta}
                </Button>
              ) : (
                <Link to={`/register?plan=${p.id}`}>
                  <Button block variant={highlight ? 'primary' : plus ? 'gold' : 'secondary'}>
                    {cta}
                  </Button>
                </Link>
              )}
              {!compact && <p className="mt-2 text-center text-2xs text-faint">{p.id === 'FREE' ? 'Karta talab qilinmaydi' : t('plan.trial.badge') + ' · karta talab qilinmaydi'}</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function BillingToggle({ cycle, onChange, size = 'lg' }: { cycle: BillingCycle; onChange: (c: BillingCycle) => void; size?: 'md' | 'lg' }) {
  const t = useT()
  return (
    <div className="flex flex-col items-center gap-2">
      <Segmented
        size={size}
        value={cycle}
        onChange={onChange}
        options={[
          { value: 'MONTHLY', label: t('plan.billing.monthly') },
          { value: 'ANNUAL', label: t('plan.billing.annual'), badge: <Badge tone="brand" size="xs">−{Math.round(ANNUAL_DISCOUNT_PCT)}%</Badge> },
        ]}
      />
      <p className={cx('text-xs transition-opacity', cycle === 'ANNUAL' ? 'text-brand' : 'text-faint')}>{t('plan.billing.save')}</p>
    </div>
  )
}

export function ComparisonTable({ className }: { className?: string }) {
  const t = useT()
  const [openAll, setOpenAll] = useState(false)
  const groups = openAll ? COMPARISON_GROUPS : COMPARISON_GROUPS.slice(0, 4)
  return (
    <div className={cx('card overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-raised/60">
              <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-faint">Imkoniyat</th>
              {PLAN_LIST.map((p) => (
                <th key={p.id} className={cx('px-4 py-4 text-center text-sm font-semibold', p.id === 'PREMIUM' && 'text-brand')}>
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <GroupRows key={g.groupKey} labelKey={g.groupKey as DictKey} rows={g.rows} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-5 py-3">
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon ok /> {t('common.included')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-line/6 text-faint">
              <Lock size={12} />
            </span>
            {t('common.notIncluded')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-warning font-medium">Cheklangan</span> {t('common.limited')}
          </span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => setOpenAll((v) => !v)}>
          {openAll ? 'Qisqartirish' : `Barcha ${COMPARISON_GROUPS.length} bo‘limni ko‘rish`}
        </Button>
      </div>
    </div>
  )
}

function GroupRows({ labelKey, rows, t }: { labelKey: DictKey; rows: { labelKey: string; free: boolean | string; premium: boolean | string; plus: boolean | string }[]; t: (k: DictKey) => string }) {
  return (
    <>
      <tr className="border-b bg-line/[0.03]">
        <td colSpan={4} className="px-5 py-2 text-2xs font-semibold uppercase tracking-[0.14em] text-brand">
          {t(labelKey)}
        </td>
      </tr>
      {rows.map((r) => (
        <tr key={r.labelKey} className="border-b last:border-0 hover:bg-line/[0.03]">
          <td className="px-5 py-2.5 text-ink/90">{t(r.labelKey as DictKey)}</td>
          <td className="px-4 py-2.5 text-center">
            <CheckIcon ok={r.free} />
          </td>
          <td className="px-4 py-2.5 text-center bg-brand/[0.03]">
            <CheckIcon ok={r.premium} />
          </td>
          <td className="px-4 py-2.5 text-center">
            <CheckIcon ok={r.plus} />
          </td>
        </tr>
      ))}
    </>
  )
}

export function PricingSection({ id = 'pricing', showCompare = true }: { id?: string; showCompare?: boolean }) {
  const t = useT()
  const [cycle, setCycle] = useState<BillingCycle>('MONTHLY')
  return (
    <section id={id} className="relative scroll-mt-28 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="brand" className="mb-4">
            {t('landing.nav.pricing')}
          </Badge>
          <h2 className="text-3xl font-bold sm:text-4xl">Shaffof tariflar. Yashirin to‘lovlar yo‘q.</h2>
          <p className="mt-3 text-muted">{t('plan.trial.note')} Keyin biznesingizga mos tarifni tanlang.</p>
          <div className="mt-8 flex justify-center">
            <BillingToggle cycle={cycle} onChange={setCycle} />
          </div>
        </div>
        <div className="mt-12">
          <PricingCards cycle={cycle} />
        </div>
        <div className="mt-6 rounded-2xl border border-dashed p-4 text-center text-sm text-muted">
          <b className="text-ink">{t('plan.whyFree')}</b> {t('plan.whyFree.body')}
        </div>
        {showCompare && (
          <div className="mt-16">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-semibold">{t('plan.compare.title')}</h3>
              <p className="mt-1 text-sm text-muted">{t('plan.compare.sub')}</p>
            </div>
            <ComparisonTable />
          </div>
        )}
        <p className="mt-6 text-center text-xs text-faint">Premium: {money(monthlyEquivalent('PREMIUM', 'ANNUAL'))}/oy yillik to‘lovda ({money(priceFor('PREMIUM', 'ANNUAL'))}/yil). Premium Plus: {money(monthlyEquivalent('PREMIUM_PLUS', 'ANNUAL'))}/oy yillik to‘lovda ({money(priceFor('PREMIUM_PLUS', 'ANNUAL'))}/yil). Narxlar QQSsiz.</p>
      </div>
    </section>
  )
}
