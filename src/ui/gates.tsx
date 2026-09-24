/**
 * Gating components. They render *why* something is unavailable — a
 * permission, a data scope, or a plan — instead of silently hiding it.
 * Sensitive numbers pass through <Scoped> which returns a locked placeholder
 * when the principal lacks the scope; the actual value is never in the DOM.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, EyeOff, Lock, ShieldAlert, Sparkles } from 'lucide-react'
import { useSession } from '@/app/useSession'
import { useT } from '@/core/i18n'
import type { DataScope, PermissionKey, RoleId } from '@/core/rbac/permissions'
import { ROLE_ORDER, ROLE_PERMISSIONS } from '@/core/rbac/permissions'
import type { FeatureId } from '@/core/billing/plans'
import { Badge, Button, Card } from './primitives'
import { cx } from '@/core/utils/format'

export function whoCanSee(scope: DataScope): RoleId[] {
  return ROLE_ORDER.filter((r) => {
    const set = ROLE_PERMISSIONS[r] as string[]
    return set.includes('*') || set.includes(scope)
  })
}

export function LockedValue({ scope, className, compact }: { scope: DataScope; className?: string; compact?: boolean }) {
  const t = useT()
  const roles = whoCanSee(scope).slice(0, 4)
  return (
    <div className={cx('group relative inline-flex items-center gap-2 text-faint', className)} title={t('access.scope.body')}>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1 text-xs">
        <EyeOff size={12} /> {compact ? t('common.locked') : t('access.scope.title')}
      </span>
      {!compact && (
        <span className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 hidden w-64 rounded-xl border bg-surface p-3 text-left text-xs shadow-lift group-hover:block">
          <b className="block text-ink">{t('access.scope.title')}</b>
          <span className="mt-1 block text-muted">{t('access.scope.body')}</span>
          <span className="mt-2 block text-faint">{t('access.scope.whoCan')}</span>
          <span className="mt-1 flex flex-wrap gap-1">
            {roles.map((r) => (
              <Badge key={r} tone="muted" size="xs">
                {t(`role.${r}` as never)}
              </Badge>
            ))}
          </span>
        </span>
      )}
    </div>
  )
}

/** Render children only if the scope is granted, otherwise a locked placeholder. */
export function Scoped({ scope, children, fallback, compact }: { scope: DataScope; children: ReactNode; fallback?: ReactNode; compact?: boolean }) {
  const { can } = useSession()
  if (can(scope)) return <>{children}</>
  return <>{fallback ?? <LockedValue scope={scope} compact={compact} />}</>
}

export function Can({ perm, children, fallback = null }: { perm: PermissionKey | PermissionKey[]; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useSession()
  const ok = Array.isArray(perm) ? perm.some((p) => can(p)) : can(perm)
  return <>{ok ? children : fallback}</>
}

export function AccessDenied({ perm, inline }: { perm?: PermissionKey; inline?: boolean }) {
  const t = useT()
  return (
    <div className={cx('flex items-center justify-center', inline ? 'py-10' : 'min-h-[60vh]')}>
      <Card className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-danger/12 text-danger">
          <ShieldAlert size={26} />
        </div>
        <h2 className="text-lg font-semibold">{t('access.denied.title')}</h2>
        <p className="mt-2 text-sm text-muted">{t('access.denied.body')}</p>
        {perm && (
          <p className="mt-3 font-mono text-2xs text-faint">
            {t('audit.permission')}: {perm}
          </p>
        )}
        <div className="mt-5 flex justify-center gap-2">
          <Link to="/app">
            <Button variant="secondary">{t('nav.overview')}</Button>
          </Link>
        </div>
      </Card>
    </div>
  )
}

export function PlanGate({ feature, children, title, inline }: { feature: FeatureId | FeatureId[]; children: ReactNode; title?: string; inline?: boolean }) {
  const { has, ent, can } = useSession()
  const t = useT()
  const ok = Array.isArray(feature) ? feature.some((f) => has(f)) : has(feature)
  if (ok) return <>{children}</>
  const requiredPlan = ent.planId === 'FREE' ? 'Premium' : 'Premium Plus'
  return (
    <div className={cx('relative', inline ? '' : 'min-h-[50vh] flex items-center justify-center')}>
      <Card className="relative mx-auto max-w-lg overflow-hidden text-center">
        <div className="aurora aurora-3 opacity-60" />
        <div className="relative">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gold/14 text-gold">
            <Sparkles size={26} />
          </div>
          <Badge tone="gold" className="mb-3">
            {requiredPlan}
          </Badge>
          <h2 className="text-lg font-semibold">{title ?? t('access.plan.title')}</h2>
          <p className="mt-2 text-sm text-muted">{t('access.plan.body')}</p>
          <div className="mt-5 flex justify-center gap-2">
            {can('billing.edit') ? (
              <Link to="/app/settings/billing?upgrade=1">
                <Button variant="gold" icon={<ArrowUpRight size={16} />}>
                  {t('access.plan.upgrade')}
                </Button>
              </Link>
            ) : (
              <span className="text-xs text-faint">{t('access.denied.body')}</span>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}

export function ReadOnlyBanner() {
  const { readOnly, can, ent } = useSession()
  const t = useT()
  if (!readOnly) return null
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-danger/30 bg-danger/8 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Lock size={18} className="mt-0.5 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-semibold text-ink">{ent.status === 'SUSPENDED' ? t('sub.SUSPENDED') : t('access.readonly.title')}</p>
          <p className="text-xs text-muted">{t('access.readonly.body')}</p>
        </div>
      </div>
      {can('billing.edit') && (
        <Link to="/app/settings/billing?upgrade=1">
          <Button size="sm" variant="danger">
            {t('trial.cta.choose')}
          </Button>
        </Link>
      )}
    </div>
  )
}
