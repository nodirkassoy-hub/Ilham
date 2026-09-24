import type { BillingCycle, Currency, PlanId, SubscriptionStatus } from '../domain/enums'
import type { Plan, PlanFeatureRow, PlanLimits } from '../domain/entities'

/* ==========================================================================
   PLANS
   Pricing is stored, never computed, so the annual discount can never drift
   out of sync with the monthly price.
     Premium      299 000 × 12 = 3 588 000   annual 2 990 000  → 2 months free
     Premium Plus 699 000 × 12 = 8 388 000   annual 6 990 000  → 2 months free
   "Yillik to'lovda 2 oy tejang" = 16.7% discount — inside the promised 15–20%.
   ========================================================================= */

export const CURRENCY: Currency = 'UZS'
export const ANNUAL_DISCOUNT_PCT = 16.7

export const PRICE_PREMIUM_MONTHLY = 299_000
export const PRICE_PREMIUM_ANNUAL = 2_990_000
export const PRICE_PLUS_MONTHLY = 699_000
export const PRICE_PLUS_ANNUAL = 6_990_000

/* --------------------------------------------------------------- feature ids */

export const FEATURES = [
  // Tekin
  'catalog.basic',
  'sales.basic',
  'customers.basic',
  'stock.basic',
  'sales.history',
  'reports.limited',
  // Premium
  'accounting.full',
  'accounting.income',
  'accounting.expenses',
  'purchasing.basic',
  'invoices',
  'receivables',
  'payables',
  'cashflow',
  'pnl',
  'balance.sheet',
  'trial.balance',
  'reports.basic',
  'branches.multi',
  'ai.basic',
  'export.excel',
  'export.pdf',
  'audit.history',
  'permissions.roles',
  // Premium Plus
  'companies.multi',
  'warehouses.unlimited',
  'users.unlimited',
  'reports.advanced',
  'analytics.advanced',
  'ai.full',
  'ai.business.analysis',
  'ai.anomaly',
  'forecast.cashflow',
  'budgeting',
  'manufacturing',
  'production.management',
  'bom',
  'production.costing',
  'raw.materials',
  'machines',
  'hr',
  'payroll',
  'fixed.assets',
  'projects',
  'crm.advanced',
  'purchasing.advanced',
  'sales.advanced',
  'bank.reconciliation',
  'approval.workflows',
  'audit.advanced',
  'permissions.advanced',
  'api.access',
  'import.advanced',
  'support.priority',
] as const
export type FeatureId = (typeof FEATURES)[number]

export const PLAN_FEATURES: Record<PlanId, FeatureId[]> = {
  FREE: [
    'catalog.basic',
    'sales.basic',
    'customers.basic',
    'stock.basic',
    'sales.history',
    'reports.limited',
    'ai.basic',
  ],
  PREMIUM: [
    'catalog.basic',
    'sales.basic',
    'sales.advanced',
    'customers.basic',
    'stock.basic',
    'sales.history',
    'invoices',
    'purchasing.basic',
    'receivables',
    'payables',
    'accounting.full',
    'accounting.income',
    'accounting.expenses',
    'cashflow',
    'pnl',
    'balance.sheet',
    'trial.balance',
    'reports.basic',
    'reports.limited',
    'branches.multi',
    'ai.basic',
    'export.excel',
    'export.pdf',
    'audit.history',
    'permissions.roles',
  ],
  PREMIUM_PLUS: [...FEATURES],
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  FREE: {
    users: 2,
    warehouses: 1,
    branches: 1,
    companies: 1,
    products: 100,
    monthlyTransactions: 200,
    aiQuestionsPerMonth: 20,
    storageMb: 200,
    apiAccess: false,
  },
  PREMIUM: {
    users: 10,
    warehouses: 3,
    branches: 5,
    companies: 1,
    products: null,
    monthlyTransactions: null,
    aiQuestionsPerMonth: 500,
    storageMb: 10_000,
    apiAccess: false,
  },
  PREMIUM_PLUS: {
    users: null,
    warehouses: null,
    branches: null,
    companies: null,
    products: null,
    monthlyTransactions: null,
    aiQuestionsPerMonth: null,
    storageMb: 100_000,
    apiAccess: true,
  },
}

/* ------------------------------------------------------------------- catalog */

const f = (labelKey: string, free: PlanFeatureRow['value'], premium: PlanFeatureRow['value'], plus: PlanFeatureRow['value']) => ({
  labelKey,
  free,
  premium,
  plus,
})

/**
 * Comparison table source of truth. Rendered by the marketing pricing page AND
 * the in-app upgrade dialog so the two can never disagree.
 */
export const COMPARISON_GROUPS: { groupKey: string; rows: ReturnType<typeof f>[] }[] = [
  {
    groupKey: 'cmp.group.core',
    rows: [
      f('cmp.companies', '1 ta', '1 ta', 'Cheksiz'),
      f('cmp.branches', '1 ta', '5 tagacha', true),
      f('cmp.warehouses', '1 ta', '3 tagacha', true),
      f('cmp.users', '2 tagacha', '10 tagacha', true),
      f('cmp.products', '100 tagacha', true, true),
      f('cmp.transactions', '200 / oy', true, true),
    ],
  },
  {
    groupKey: 'cmp.group.sales',
    rows: [
      f('cmp.salesEntry', true, true, true),
      f('cmp.customers', 'Cheklangan', true, true),
      f('cmp.invoices', false, true, true),
      f('cmp.receivables', false, true, true),
      f('cmp.payables', false, true, true),
      f('cmp.crmAdvanced', false, false, true),
      f('cmp.approvalWorkflows', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.inventory',
    rows: [
      f('cmp.stockView', true, true, true),
      f('cmp.salesHistory', true, true, true),
      f('cmp.transfers', false, true, true),
      f('cmp.stockCounts', false, true, true),
      f('cmp.barcodes', false, true, true),
      f('cmp.reorderAlerts', false, true, true),
    ],
  },
  {
    groupKey: 'cmp.group.accounting',
    rows: [
      f('cmp.accountingFull', false, true, true),
      f('cmp.chartOfAccounts', false, true, true),
      f('cmp.generalLedger', false, true, true),
      f('cmp.journalEntries', false, true, true),
      f('cmp.trialBalance', false, true, true),
      f('cmp.balanceSheet', false, true, true),
      f('cmp.pnl', false, true, true),
      f('cmp.cashflow', false, true, true),
      f('cmp.bankReconciliation', false, false, true),
      f('cmp.taxAccounting', false, 'Asosiy', true),
      f('cmp.periodClosing', false, true, true),
      f('cmp.fixedAssets', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.purchasing',
    rows: [
      f('cmp.purchaseOrders', false, true, true),
      f('cmp.goodsReceived', false, true, true),
      f('cmp.supplierInvoices', false, true, true),
      f('cmp.purchasingAdvanced', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.manufacturing',
    rows: [
      f('cmp.manufacturing', false, false, true),
      f('cmp.bom', false, false, true),
      f('cmp.productionCosting', false, false, true),
      f('cmp.rawMaterials', false, false, true),
      f('cmp.machines', false, false, true),
      f('cmp.qualityControl', false, false, true),
      f('cmp.workOrders', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.hr',
    rows: [
      f('cmp.hr', false, false, true),
      f('cmp.payroll', false, false, true),
      f('cmp.attendance', false, false, true),
      f('cmp.leave', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.reports',
    rows: [
      f('cmp.reportsLimited', true, true, true),
      f('cmp.reportsAdvanced', false, 'Asosiy', true),
      f('cmp.analytics', false, false, true),
      f('cmp.budgeting', false, false, true),
      f('cmp.cashForecast', false, false, true),
      f('cmp.exportExcel', false, true, true),
      f('cmp.exportPdf', false, true, true),
      f('cmp.importAdvanced', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.ai',
    rows: [
      f('cmp.aiQuestions', '20 / oy', '500 / oy', true),
      f('cmp.aiCfo', 'Cheklangan', true, true),
      f('cmp.aiBusinessAnalysis', false, false, true),
      f('cmp.aiAnomaly', false, false, true),
      f('cmp.aiForecast', false, false, true),
    ],
  },
  {
    groupKey: 'cmp.group.security',
    rows: [
      f('cmp.roles', 'Asosiy', true, true),
      f('cmp.permissionsAdvanced', false, 'Asosiy', true),
      f('cmp.auditLog', false, true, true),
      f('cmp.auditAdvanced', false, false, true),
      f('cmp.apiAccess', false, false, true),
      f('cmp.support', 'Jamiyat', 'Email', 'Prioritet'),
    ],
  },
]

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: 'FREE',
    name: 'Tekin',
    tagline: 'plan.free.tagline',
    badge: null,
    priceMonthly: 0,
    priceAnnual: 0,
    currency: CURRENCY,
    limits: PLAN_LIMITS.FREE,
    features: [],
    isPublic: true,
    sortOrder: 0,
  },
  PREMIUM: {
    id: 'PREMIUM',
    name: 'Premium',
    tagline: 'plan.premium.tagline',
    badge: 'ENG MASHHUR',
    priceMonthly: PRICE_PREMIUM_MONTHLY,
    priceAnnual: PRICE_PREMIUM_ANNUAL,
    currency: CURRENCY,
    limits: PLAN_LIMITS.PREMIUM,
    features: [],
    isPublic: true,
    sortOrder: 1,
  },
  PREMIUM_PLUS: {
    id: 'PREMIUM_PLUS',
    name: 'Premium Plus',
    tagline: 'plan.plus.tagline',
    badge: "TO'LIQ BOSHQARUV",
    priceMonthly: PRICE_PLUS_MONTHLY,
    priceAnnual: PRICE_PLUS_ANNUAL,
    currency: CURRENCY,
    limits: PLAN_LIMITS.PREMIUM_PLUS,
    features: [],
    isPublic: true,
    sortOrder: 2,
  },
}

export const PLAN_LIST: Plan[] = [PLANS.FREE, PLANS.PREMIUM, PLANS.PREMIUM_PLUS]

export function priceFor(planId: PlanId, cycle: BillingCycle): number {
  const plan = PLANS[planId]
  return cycle === 'ANNUAL' ? plan.priceAnnual : plan.priceMonthly
}

export function monthlyEquivalent(planId: PlanId, cycle: BillingCycle): number {
  return cycle === 'ANNUAL' ? Math.round(priceFor(planId, cycle) / 12) : priceFor(planId, cycle)
}

export function annualSaving(planId: PlanId): number {
  const p = PLANS[planId]
  return Math.max(0, p.priceMonthly * 12 - p.priceAnnual)
}

export function annualSavingMonths(planId: PlanId): number {
  const p = PLANS[planId]
  if (p.priceMonthly === 0) return 0
  return Math.round((annualSaving(planId) / p.priceMonthly) * 10) / 10
}

/* ---------------------------------------------------------- entitlements */

export type WorkspaceMode =
  /** Everything the plan allows. */
  | 'FULL'
  /** Trial / past-due grace: still usable, banner shown. */
  | 'GRACE'
  /** Expired or suspended: data preserved, writes refused. */
  | 'READ_ONLY'
  /** Deleted/closed by platform admin. */
  | 'LOCKED'

export interface Entitlements {
  planId: PlanId
  mode: WorkspaceMode
  status: SubscriptionStatus
  features: Set<FeatureId>
  limits: PlanLimits
  canWrite: boolean
  /** Days remaining on the trial, or null when not trialling. */
  trialDaysLeft: number | null
  trialExpiresAt: string | null
  renewsAt: string | null
  /** Which plan the workspace would fall back to if it stays unpaid. */
  fallbackPlanId: PlanId
}

/** Free-tier always keeps the workspace readable; only reads of basic modules. */
const READ_ONLY_STATUSES: SubscriptionStatus[] = ['EXPIRED', 'SUSPENDED', 'CANCELLED']

export function resolveEntitlements(
  subscription: { planId: PlanId; status: SubscriptionStatus; trialEnd: string | null; renewalAt: string | null } | null,
  now: Date = new Date(),
): Entitlements {
  const planId = subscription?.planId ?? 'FREE'
  const status = subscription?.status ?? 'EXPIRED'

  let mode: WorkspaceMode = 'FULL'
  if (READ_ONLY_STATUSES.includes(status)) mode = 'READ_ONLY'
  else if (status === 'PAST_DUE') mode = 'GRACE'
  else if (status === 'TRIAL') mode = 'GRACE'

  const trialDaysLeft =
    subscription?.trialEnd && status === 'TRIAL'
      ? Math.max(0, Math.ceil((new Date(subscription.trialEnd).getTime() - now.getTime()) / 86_400_000))
      : null

  return {
    planId,
    mode,
    status,
    features: new Set(PLAN_FEATURES[planId]),
    limits: PLAN_LIMITS[planId],
    canWrite: mode === 'FULL' || mode === 'GRACE',
    trialDaysLeft,
    trialExpiresAt: subscription?.trialEnd ?? null,
    renewsAt: subscription?.renewalAt ?? null,
    fallbackPlanId: 'FREE',
  }
}

export function hasFeature(e: Entitlements, feature: FeatureId): boolean {
  return e.features.has(feature)
}

export function hasAnyFeature(e: Entitlements, features: FeatureId[]): boolean {
  return features.some((f) => e.features.has(f))
}

export type LimitKey = Exclude<keyof PlanLimits, 'apiAccess'>

export interface LimitCheck {
  ok: boolean
  limit: number | null
  current: number
  requested: number
}

/**
 * Hard quota check. Called by services BEFORE a write is committed — the UI
 * shows the same message, but the service is what actually refuses.
 */
export function checkLimit(e: Entitlements, key: LimitKey, current: number, requested = 1): LimitCheck {
  const limit = e.limits[key] as number | null
  const next = current + requested
  return {
    ok: limit === null || next <= limit,
    limit: limit as number | null,
    current,
    requested,
  }
}

/** Human-readable trial banner state machine (spec §34). */
export type TrialBannerKind = 'NORMAL' | 'D7' | 'D3' | 'D1' | 'EXPIRED' | 'NONE'

export function trialBannerKind(e: Entitlements): TrialBannerKind {
  if (e.status === 'TRIAL' && e.trialDaysLeft !== null) {
    if (e.trialDaysLeft <= 0) return 'EXPIRED'
    if (e.trialDaysLeft <= 1) return 'D1'
    if (e.trialDaysLeft <= 3) return 'D3'
    if (e.trialDaysLeft <= 7) return 'D7'
    return 'NORMAL'
  }
  if (e.status === 'EXPIRED') return 'EXPIRED'
  return 'NONE'
}
