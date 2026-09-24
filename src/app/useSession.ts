import { useMemo } from 'react'
import { useAppStore, entitlementsOf, selectMember, selectSession, selectTenant, selectUser, buildPrincipal, ServiceError } from '@/store/appStore'
import { can as canFn, deniedScopes, type DataScope, type PermissionKey, type Principal } from '@/core/rbac/permissions'
import { hasFeature, trialBannerKind, type Entitlements, type FeatureId } from '@/core/billing/plans'
import type { TenantData } from '@/data/types'
import { useT } from '@/core/i18n'
import { toast } from '@/ui/toast'
import { translate, useI18nStore } from '@/core/i18n'
import type { DictKey } from '@/core/i18n/uz'

export interface SessionView {
  principal: Principal | null
  tenant: TenantData | null
  ent: Entitlements
  user: ReturnType<typeof selectUser>
  member: ReturnType<typeof selectMember>
  isSuperAdmin: boolean
  can: (k: PermissionKey) => boolean
  canAny: (...k: PermissionKey[]) => boolean
  has: (f: FeatureId) => boolean
  denied: DataScope[]
  readOnly: boolean
  banner: ReturnType<typeof trialBannerKind>
}

export function useSession(): SessionView {
  const session = useAppStore(selectSession)
  const tenant = useAppStore(selectTenant)
  const user = useAppStore(selectUser)
  const member = useAppStore(selectMember)
  // Principal derives from stable slices; memoised so permission Sets are not rebuilt per render.
  const principal = useMemo(() => buildPrincipal(session, user, tenant), [session, user, tenant])
  return useMemo(() => {
    const ent = entitlementsOf(tenant)
    return {
      principal,
      tenant,
      ent,
      user,
      member,
      isSuperAdmin: !!user?.isSuperAdmin && !tenant,
      can: (k) => canFn(principal, k),
      canAny: (...k) => k.some((x) => canFn(principal, x)),
      has: (f) => hasFeature(ent, f),
      denied: deniedScopes(principal),
      readOnly: !ent.canWrite,
      banner: trialBannerKind(ent),
    }
  }, [principal, tenant, user, member])
}

/** Run a store mutation, translate ServiceError codes into toasts. */
export function useAction() {
  const t = useT()
  return function run<T>(fn: () => T, success?: { title: string; body?: string }): T | undefined {
    try {
      const r = fn()
      if (success) toast.success(success.title, success.body)
      return r
    } catch (e) {
      if (e instanceof ServiceError) {
        const lang = useI18nStore.getState().lang
        toast.error(t('err.generic'), translate(lang, e.code as DictKey, e.vars))
      } else {
        console.error(e)
        toast.error(t('err.generic'), (e as Error).message)
      }
      return undefined
    }
  }
}
