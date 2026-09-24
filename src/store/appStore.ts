/**
 * Application store.
 *
 * Think of this as the "backend" the frontend talks to today. Every write:
 *   1. resolves the caller's Principal (tenant + role + effective permissions)
 *   2. checks the module permission            → err.permission
 *   3. checks workspace mode & plan limits       → err.readonly / err.limit.*
 *   4. mutates ONLY `tenants[session.tenantId]`  → tenant isolation
 *   5. posts to the journal when money moves     → accounting consistency
 *   6. appends an AuditLog row
 *
 * Swapping this for HTTP later means replacing the bodies, not the callers.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type {
  AIInsight,
  AuditLog,
  Counterparty,
  Invoice,
  InventoryMovement,
  JournalLine,
  Member,
  Notification,
  Payment,
  PlatformCompanyRow,
  Product,
  ProductionOrder,
  Purchase,
  Sale,
  StockBalance,
  Subscription,
  SupportTicket,
  SystemLogEntry,
  User,
  Warehouse,
} from '@/core/domain/entities'
import type { AuditAction, BillingCycle, BusinessType, Industry, PaymentMethod, PaymentProvider, PlanId, SubscriptionStatus, Theme } from '@/core/domain/enums'
import { can, effectivePermissions, type PermissionKey, type Principal, type RoleId } from '@/core/rbac/permissions'
import { PLANS, checkLimit, hasFeature, resolveEntitlements, type Entitlements, type FeatureId } from '@/core/billing/plans'
import { Ledger, postPayment, postPurchase, postSale, postProductionCompletion, postMaterialIssue, postPayroll, buildChartOfAccounts, postOpening } from '@/core/services/accounting'
import { addDays, docNumber, iso, isoDate, sum, uid } from '@/core/utils/format'
import { buildSeed, DEMO_TENANT_ID, hashPassword, rowFromTenant } from '@/data/seed'
import { emptyTenantData, type TenantData } from '@/data/types'

/* ------------------------------------------------------------------ types */

export interface Session {
  userId: string
  tenantId: string | null
  memberId: string | null
  startedAt: string
}

export interface PlanOverride {
  priceMonthly: number
  priceAnnual: number
  isActive: boolean
}

export type DashboardMetric = 'revenue' | 'expenses' | 'profit' | 'cash' | 'receivables' | 'payables' | 'inventory' | 'production' | 'alerts'

export interface RegisterPayload {
  fullName: string
  phone: string
  email: string
  password: string
  companyName: string
  tin: string
  industry: Industry
  businessType: BusinessType
  employees: number
  branches: number
  warehouses: number
  transactions: number
  planId: PlanId
  city: string
}

export class ServiceError extends Error {
  constructor(
    public code: string,
    public vars: Record<string, string | number> = {},
  ) {
    super(code)
  }
}

interface State {
  ready: boolean
  seedVersion: number
  users: User[]
  tenants: Record<string, TenantData>
  platformCompanies: PlatformCompanyRow[]
  supportTickets: SupportTicket[]
  systemLogs: SystemLogEntry[]
  planOverrides: Partial<Record<PlanId, PlanOverride>>
  /** Owner-configured: which roles may see which dashboard metric (in addition to scope rules). */
  dashboardHidden: Record<string, Partial<Record<DashboardMetric, RoleId[]>>>
  session: Session | null
  theme: Theme
  maintenanceMode: boolean
}

interface Actions {
  boot: () => void
  resetDemo: () => void
  setTheme: (t: Theme) => void
  /* auth */
  login: (email: string, password: string) => { ok: true; superAdmin: boolean } | { ok: false; error: string }
  loginAs: (userId: string, tenantId?: string) => void
  selectTenant: (tenantId: string) => void
  logout: () => void
  register: (p: RegisterPayload) => string
  /* commerce */
  createSale: (input: { lines: { productId: string; qty: number; warehouseId: string; discountPct?: number }[]; customerId: string | null; paymentMethod: PaymentMethod; paidAmount: number; branchId?: string; channel?: Sale['channel'] }) => Sale
  recordPayment: (input: { invoiceId: string | null; counterpartyId: string | null; direction: 'IN' | 'OUT'; amount: number; method: PaymentMethod; note?: string }) => Payment
  approvePayment: (paymentId: string) => void
  createCounterparty: (c: Pick<Counterparty, 'type' | 'name' | 'tin' | 'contactName' | 'phone' | 'email' | 'paymentTermDays' | 'creditLimit' | 'segment'>) => Counterparty
  /* inventory */
  createProduct: (p: Pick<Product, 'name' | 'sku' | 'type' | 'salePrice' | 'purchasePrice' | 'reorderLevel' | 'categoryId' | 'unitId' | 'barcode'> & { openingQty?: number; warehouseId?: string }) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void
  adjustStock: (productId: string, warehouseId: string, delta: number, note: string) => void
  createTransfer: (from: string, to: string, lines: { productId: string; qty: number }[]) => void
  receiveTransfer: (transferId: string) => void
  postStockCount: (warehouseId: string, lines: { productId: string; countedQty: number }[]) => void
  createWarehouse: (w: Pick<Warehouse, 'name' | 'code' | 'branchId' | 'type' | 'address'>) => Warehouse
  createBranch: (b: { name: string; code: string; city: string; address: string; phone: string }) => void
  /* purchasing */
  createPurchase: (input: { supplierId: string; warehouseId: string; lines: { productId: string; qty: number; unitPrice: number }[]; asRequest?: boolean }) => Purchase
  approvePurchase: (id: string) => void
  receivePurchase: (id: string) => void
  /* accounting */
  postManualEntry: (input: { date: string; memo: string; lines: { accountId: string; debit: number; credit: number; memo?: string }[] }) => void
  closePeriod: (periodId: string) => void
  matchBankLine: (lineId: string, paymentId: string | null) => void
  fileTax: (taxId: string) => void
  /* manufacturing */
  createProductionOrder: (input: { bomId: string; plannedQty: number; plannedStart: string; plannedEnd: string }) => ProductionOrder
  advanceProductionOrder: (id: string) => void
  setMachineState: (id: string, state: import('@/core/domain/enums').MachineState) => void
  /* hr */
  decideLeave: (id: string, approve: boolean) => void
  approvePayroll: (runId: string) => void
  payPayroll: (runId: string) => void
  createEmployee: (e: { fullName: string; position: string; departmentId: string | null; baseSalary: number; employmentType: import('@/core/domain/enums').EmploymentType }) => void
  clockIn: (employeeId: string) => void
  /* team & permissions */
  inviteMember: (m: { fullName: string; email: string; phone: string; role: RoleId; dataScope: Member['dataScope'] }) => Member
  updateMember: (id: string, patch: Partial<Pick<Member, 'role' | 'dataScope' | 'status' | 'branchIds' | 'warehouseIds'>>) => void
  setPermissionOverride: (memberId: string, key: PermissionKey, value: boolean | null) => void
  updateCompany: (patch: Partial<TenantData['company']>) => void
  setDashboardHidden: (metric: DashboardMetric, roles: RoleId[]) => void
  /* notifications & AI */
  markNotificationsRead: (ids?: string[]) => void
  appendAIMessage: (conversationId: string | null, role: 'user' | 'assistant', content: string, extra?: { claimType?: import('@/core/domain/enums').AIClaimType | null; insights?: AIInsight[]; permissionsUsed?: PermissionKey[]; deniedScopes?: string[] }) => string
  clearAIHistory: () => void
  toggle2FA: () => void
  revokeSession: (id: string) => void
  /* billing */
  simulateCheckout: (planId: PlanId, cycle: BillingCycle, provider: PaymentProvider) => { invoiceNumber: string }
  changePlan: (planId: PlanId, cycle: BillingCycle) => void
  cancelSubscription: () => void
  /* platform admin */
  adminSetCompanyStatus: (tenantId: string, status: SubscriptionStatus) => void
  adminChangePlan: (tenantId: string, planId: PlanId) => void
  adminExtendTrial: (tenantId: string, days: number) => void
  adminDeleteCompany: (tenantId: string) => void
  adminUpdatePlan: (planId: PlanId, o: Partial<PlanOverride>) => void
  adminSetTicketStatus: (id: string, status: SupportTicket['status']) => void
  adminSetMaintenance: (v: boolean) => void
}

export type AppStore = State & Actions

/* ---------------------------------------------------------------- helpers */

const SEED_VERSION = 7

function nowIso() {
  return iso()
}

function principalOf(s: State): Principal | null {
  if (!s.session) return null
  const user = s.users.find((u) => u.id === s.session!.userId)
  if (!user) return null
  if (user.isSuperAdmin && !s.session.tenantId) {
    return { memberId: null, userId: user.id, tenantId: null, role: null, isSuperAdmin: true, permissions: new Set(), dataScope: 'ALL', branchIds: [], warehouseIds: [] }
  }
  const t = s.session.tenantId ? s.tenants[s.session.tenantId] : null
  const member = t?.members.find((m) => m.id === s.session!.memberId)
  if (!t || !member) return null
  return {
    memberId: member.id,
    userId: user.id,
    tenantId: t.company.tenantId,
    role: member.role,
    isSuperAdmin: false,
    permissions: effectivePermissions(member.role, member.permissionOverrides),
    dataScope: member.dataScope,
    branchIds: member.branchIds,
    warehouseIds: member.warehouseIds,
  }
}

export function entitlementsOf(t: TenantData | null | undefined): Entitlements {
  return resolveEntitlements(t ? t.subscription : null)
}

function nextNumber(t: TenantData, key: string, prefix: string) {
  t.counters[key] = (t.counters[key] ?? 0) + 1
  return docNumber(prefix, t.counters[key])
}

function periodFor(t: TenantData, date: string) {
  const m = date.slice(0, 7)
  let p = t.periods.find((x) => x.label === m)
  if (!p) {
    const s = new Date(`${m}-01T00:00:00Z`)
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
    p = { id: `per_${m}`, tenantId: t.company.tenantId, label: m, startDate: isoDate(s), endDate: isoDate(e), status: 'OPEN', closedAt: null, closedByMemberId: null, createdAt: nowIso(), updatedAt: nowIso() }
    t.periods.push(p)
  }
  if (p.status === 'CLOSED') throw new ServiceError('err.periodClosed')
  return p.id
}

function audit(t: TenantData, p: Principal, action: AuditAction, entityType: string, summary: string, perm: PermissionKey | null, entityId: string | null = null) {
  const m = t.members.find((x) => x.id === p.memberId)
  const row: AuditLog = {
    id: uid('au'),
    tenantId: t.company.tenantId,
    action,
    actorMemberId: p.memberId,
    actorUserId: p.userId,
    actorLabel: m?.fullName ?? 'Tizim',
    entityType,
    entityId,
    summary,
    before: null,
    after: null,
    permissionRequired: perm,
    ipLabel: 'sessiya',
    createdAt: nowIso(),
  }
  t.audit.unshift(row)
  if (t.audit.length > 800) t.audit.length = 800
}

function notify(t: TenantData, n: Omit<Notification, 'id' | 'tenantId' | 'readAt' | 'readByMemberIds' | 'createdAt' | 'updatedAt' | 'audienceMemberId'> & { audienceMemberId?: string | null }) {
  t.notifications.unshift({ id: uid('nt'), tenantId: t.company.tenantId, readAt: null, readByMemberIds: [], audienceMemberId: n.audienceMemberId ?? null, createdAt: nowIso(), updatedAt: nowIso(), ...n })
  if (t.notifications.length > 300) t.notifications.length = 300
}

function stockOf(t: TenantData, productId: string, warehouseId: string, createCost = 0): StockBalance {
  let s = t.stock.find((x) => x.productId === productId && x.warehouseId === warehouseId)
  if (!s) {
    s = { id: uid('stk'), tenantId: t.company.tenantId, productId, warehouseId, onHand: 0, reserved: 0, inTransit: 0, avgCost: createCost, lastCountedAt: null, createdAt: nowIso(), updatedAt: nowIso() }
    t.stock.push(s)
  }
  return s
}

function move(t: TenantData, p: Principal, productId: string, warehouseId: string, type: InventoryMovement['type'], qty: number, unitCost: number, referenceType: string, referenceId: string | null, note = '') {
  const s = stockOf(t, productId, warehouseId, unitCost)
  if (qty > 0 && s.onHand + qty > 0) s.avgCost = Math.round((s.onHand * s.avgCost + qty * unitCost) / (s.onHand + qty))
  s.onHand = Math.round((s.onHand + qty) * 100) / 100
  s.updatedAt = nowIso()
  t.movements.push({ id: uid('mv'), tenantId: t.company.tenantId, productId, warehouseId, type, qty, unitCost, value: Math.round(qty * unitCost), referenceType, referenceId, note, performedByMemberId: p.memberId ?? 'system', occurredAt: nowIso(), createdAt: nowIso(), updatedAt: nowIso() })
  const prod = t.products.find((x) => x.id === productId)
  if (prod && prod.reorderLevel > 0 && s.onHand - s.reserved <= prod.reorderLevel && qty < 0) {
    const already = t.notifications.find((n) => n.kind === 'LOW_STOCK' && n.body.includes(prod.name) && Date.now() - new Date(n.createdAt).getTime() < 86_400_000)
    if (!already) notify(t, { kind: 'LOW_STOCK', severity: 'WARNING', title: 'Zaxira tugayapti', body: `${prod.name}: qoldiq ${s.onHand} (minimal ${prod.reorderLevel}).`, audienceRoles: ['OWNER', 'ADMIN', 'WAREHOUSE_MANAGER', 'WAREHOUSE_EMPLOYEE', 'PURCHASING_MANAGER'], link: '/app/inventory/stock' })
  }
}

interface Ctx {
  t: TenantData
  p: Principal
  ent: Entitlements
  ledger: Ledger
}

/**
 * A denied permission check. Thrown from inside an immer producer, which
 * discards the draft — so the audit row is re-applied by `mutate()` afterwards.
 */
class DeniedError extends ServiceError {
  constructor(public tenantId: string, public perm: PermissionKey) {
    super('err.permission')
  }
}

/** Resolve tenant + principal for a write. Throws if not allowed. */
function guard(s: State, perm: PermissionKey | null, opts: { write?: boolean; feature?: FeatureId } = {}): Ctx {
  const p = principalOf(s)
  if (!p || !p.tenantId) throw new ServiceError('err.permission')
  const t = s.tenants[p.tenantId]
  if (!t) throw new ServiceError('err.tenant')
  if (perm && !can(p, perm)) throw new DeniedError(t.company.tenantId, perm)
  const ent = entitlementsOf(t)
  if (opts.write !== false && !ent.canWrite) throw new ServiceError('err.readonly')
  if (opts.feature && !hasFeature(ent, opts.feature)) throw new ServiceError('access.plan.body')
  return { t, p, ent, ledger: new Ledger(t.accounts) }
}

function jeCtx(t: TenantData, p: Principal, at: string) {
  return { tenantId: t.company.tenantId, periodId: periodFor(t, at), memberId: p.memberId ?? 'system', number: nextNumber(t, 'JE', 'JE'), now: at }
}

function recomputeInvoiceStatus(inv: Invoice) {
  if (inv.status === 'VOID' || inv.status === 'DRAFT') return
  if (inv.paidAmount >= inv.total) inv.status = 'PAID'
  else if (inv.paidAmount > 0) inv.status = 'PARTIALLY_PAID'
  else inv.status = 'ISSUED'
  if (inv.status !== 'PAID' && inv.dueDate < isoDate()) inv.status = 'OVERDUE'
}

function syncPlatformRow(s: State, tenantId: string) {
  const t = s.tenants[tenantId]
  if (!t) return
  const row = rowFromTenant(t)
  const i = s.platformCompanies.findIndex((r) => r.tenantId === tenantId)
  if (i >= 0) s.platformCompanies[i] = row
  else s.platformCompanies.unshift(row)
}

function monthlyTxCount(t: TenantData) {
  const m = isoDate().slice(0, 7)
  return t.sales.filter((x) => x.occurredAt.startsWith(m)).length + t.purchases.filter((x) => x.createdAt.startsWith(m)).length
}

/* ------------------------------------------------------------------ store */

export const useAppStore = create<AppStore>()(
  persist(
    immer((rawSet, get) => {
      /** Like `set`, but a DENIED_ACCESS is recorded in the tenant audit log even though the failed draft is discarded. */
      const set: typeof rawSet = (fn, replace) => {
        try {
          return rawSet(fn as never, replace as never)
        } catch (e) {
          if (e instanceof DeniedError) {
            rawSet((d) => {
              const t = d.tenants[e.tenantId]
              const p = principalOf(d)
              if (t && p) audit(t, p, 'DENIED_ACCESS', 'Permission', `Rad etildi: ${e.perm}`, e.perm)
            })
          }
          throw e
        }
      }
      return {
      ready: false,
      seedVersion: 0,
      users: [],
      tenants: {},
      platformCompanies: [],
      supportTickets: [],
      systemLogs: [],
      planOverrides: {},
      dashboardHidden: {},
      session: null,
      theme: 'dark',
      maintenanceMode: false,

      boot: () => {
        const s = get()
        if (s.ready && s.seedVersion === SEED_VERSION && Object.keys(s.tenants).length) return
        const seed = buildSeed()
        set((d) => {
          d.users = seed.users
          d.tenants = seed.tenants
          d.platformCompanies = seed.platformCompanies
          d.supportTickets = seed.supportTickets
          d.systemLogs = seed.systemLogs
          d.session = null
          d.ready = true
          d.seedVersion = SEED_VERSION
        })
      },
      resetDemo: () => {
        const seed = buildSeed()
        set((d) => {
          d.users = seed.users
          d.tenants = seed.tenants
          d.platformCompanies = seed.platformCompanies
          d.supportTickets = seed.supportTickets
          d.systemLogs = seed.systemLogs
          d.planOverrides = {}
          d.dashboardHidden = {}
          d.session = null
        })
      },
      setTheme: (theme) => set((d) => void (d.theme = theme)),

      /* ---------------------------------------------------------- auth */
      login: (email, password) => {
        const s = get()
        const user = s.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!user || user.passwordHash !== hashPassword(password)) return { ok: false, error: 'auth.invalid' }
        if (user.isSuperAdmin) {
          set((d) => void (d.session = { userId: user.id, tenantId: null, memberId: null, startedAt: nowIso() }))
          return { ok: true, superAdmin: true }
        }
        const membership = Object.values(s.tenants).find((t) => t.members.some((m) => m.userId === user.id && m.status !== 'SUSPENDED'))
        if (!membership) return { ok: false, error: 'auth.noTenant' }
        const member = membership.members.find((m) => m.userId === user.id)!
        set((d) => {
          d.session = { userId: user.id, tenantId: membership.company.tenantId, memberId: member.id, startedAt: nowIso() }
          const u = d.users.find((x) => x.id === user.id)!
          u.lastLoginAt = nowIso()
          const t = d.tenants[membership.company.tenantId]
          const m = t.members.find((x) => x.id === member.id)!
          m.lastActiveAt = nowIso()
          const p = principalOf(d)!
          audit(t, p, 'LOGIN', 'Session', `Kirish: ${user.fullName}`, null)
        })
        return { ok: true, superAdmin: false }
      },
      loginAs: (userId, tenantId) => {
        const s = get()
        const user = s.users.find((u) => u.id === userId)
        if (!user) return
        if (user.isSuperAdmin) {
          set((d) => void (d.session = { userId, tenantId: null, memberId: null, startedAt: nowIso() }))
          return
        }
        const tid = tenantId ?? Object.values(s.tenants).find((t) => t.members.some((m) => m.userId === userId))?.company.tenantId
        if (!tid) return
        const member = s.tenants[tid].members.find((m) => m.userId === userId)
        if (!member) return
        set((d) => {
          d.session = { userId, tenantId: tid, memberId: member.id, startedAt: nowIso() }
          const t = d.tenants[tid]
          t.members.find((x) => x.id === member.id)!.lastActiveAt = nowIso()
          audit(t, principalOf(d)!, 'LOGIN', 'Session', `Kirish (demo): ${user.fullName}`, null)
        })
      },
      selectTenant: (tenantId) => {
        const s = get()
        if (!s.session) return
        const member = s.tenants[tenantId]?.members.find((m) => m.userId === s.session!.userId)
        // Tenant isolation: you can only switch into a tenant where you hold a membership.
        if (!member) throw new ServiceError('err.tenant')
        set((d) => void (d.session = { ...d.session!, tenantId, memberId: member.id }))
      },
      logout: () =>
        set((d) => {
          const p = principalOf(d)
          if (p?.tenantId) audit(d.tenants[p.tenantId], p, 'LOGOUT', 'Session', 'Chiqish', null)
          d.session = null
        }),

      register: (pl) => {
        const s = get()
        if (s.users.some((u) => u.email.toLowerCase() === pl.email.toLowerCase())) throw new ServiceError('onb.error.exists')
        const now = nowIso()
        const userId = uid('u')
        const tenantId = uid('t')
        const memberId = uid('m')
        const user: User = { id: userId, fullName: pl.fullName, email: pl.email, phone: pl.phone, passwordHash: hashPassword(pl.password), avatarTone: 'brand', locale: 'uz', theme: 'dark', twoFactorEnabled: false, isSuperAdmin: false, lastLoginAt: now, createdAt: now, updatedAt: now }
        const company: TenantData['company'] = { id: tenantId, tenantId, name: pl.companyName, legalName: pl.companyName, tin: pl.tin, vatCertificate: null, industry: pl.industry, businessType: pl.businessType, ownerUserId: userId, directorName: pl.fullName, chiefAccountantName: null, phone: pl.phone, email: pl.email, address: pl.city, bankName: null, bankAccount: null, bankMfo: null, baseCurrency: 'UZS', fiscalYearStartMonth: 1, vatRate: 12, turnoverTaxRate: 4, isDemo: false, status: 'TRIAL', employeeCount: pl.employees, logoTone: ['brand', 'sky', 'violet', 'gold'][pl.companyName.length % 4], createdAt: now, updatedAt: now }
        const sub: Subscription = { id: uid('sub'), tenantId, planId: pl.planId, status: 'TRIAL', billingCycle: 'MONTHLY', trialStart: now, trialEnd: addDays(now, 30).toISOString(), startedAt: null, currentPeriodStart: null, currentPeriodEnd: null, renewalAt: null, cancelledAt: null, paymentStatus: 'UNPAID', seatsUsed: 1, trialExtendedDays: 0, provider: null, createdAt: now, updatedAt: now }
        const t = emptyTenantData(company, sub)
        const stamp = { createdAt: now, updatedAt: now }
        const br = { id: uid('br'), tenantId, name: `${pl.city || 'Bosh ofis'}`, code: 'HQ', city: pl.city, address: pl.city, phone: pl.phone, managerMemberId: memberId, isActive: true, ...stamp }
        t.branches = [br]
        t.warehouses = [{ id: uid('wh'), tenantId, name: 'Asosiy ombor', code: 'WH-01', branchId: br.id, type: 'MAIN', address: pl.city, managerMemberId: memberId, isActive: true, ...stamp }]
        t.members = [{ id: memberId, tenantId, userId, fullName: pl.fullName, email: pl.email, phone: pl.phone, role: 'OWNER', departmentId: null, branchIds: [br.id], warehouseIds: [t.warehouses[0].id], permissionOverrides: {}, dataScope: 'ALL', status: 'ACTIVE', lastActiveAt: now, avatarTone: 'brand', ...stamp }]
        t.units = [{ id: uid('unit'), tenantId, name: 'dona', symbol: 'dona', factor: 1, baseUnitId: null, ...stamp }]
        t.categories = [{ id: uid('cat'), tenantId, name: 'Umumiy', parentId: null, code: 'C1', ...stamp }]
        t.counterparties = [{ id: uid('c'), tenantId, type: 'CUSTOMER', name: 'Chakana xaridor', tin: null, contactName: '—', phone: '', email: '', address: '', bankAccount: null, balance: 0, creditLimit: 0, paymentTermDays: 0, segment: 'Chakana', ownerMemberId: null, isActive: true, riskScore: null, ...stamp }]
        t.employees = [{ id: uid('emp'), tenantId, memberId, fullName: pl.fullName, tin: null, position: 'Direktor', departmentId: null, branchId: br.id, employmentType: 'FULL_TIME', hiredAt: now, baseSalary: 0, phone: pl.phone, email: pl.email, status: 'ACTIVE', bankAccount: null, ...stamp }]
        t.accounts = buildChartOfAccounts(tenantId, now)
        const ledger = new Ledger(t.accounts)
        const perId = `per_${now.slice(0, 7)}`
        t.periods = [{ id: perId, tenantId, label: now.slice(0, 7), startDate: `${now.slice(0, 7)}-01`, endDate: isoDate(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)), status: 'OPEN', closedAt: null, closedByMemberId: null, ...stamp }]
        t.journal = [postOpening(ledger, { tenantId, periodId: perId, memberId, number: 'JE-0001', now }, now, { cash: 0, bank: 0, inventory: 0, fixedAssets: 0, equity: 0, loans: 0 })].filter((e) => e.lines.length)
        t.bankAccounts = [{ id: uid('bank'), tenantId, name: 'Asosiy hisob', bankName: '', accountNumber: '', mfo: '', currency: 'UZS', balance: 0, openingBalance: 0, isActive: true, accountId: ledger.sys('BANK_MAIN').id, feedConnected: false, ...stamp }]
        t.notifications = [{ id: uid('nt'), tenantId, kind: 'TRIAL_EXPIRING', severity: 'SUCCESS', title: '30 kunlik bepul sinov boshlandi', body: `Sinov muddati ${addDays(now, 30).toLocaleDateString('uz-UZ')} gacha. Karta ma'lumoti talab qilinmaydi.`, audienceRoles: ['OWNER'], audienceMemberId: null, link: '/app/settings/billing', readAt: null, readByMemberIds: [], ...stamp }]
        t.counters = { JE: 1 }
        set((d) => {
          d.users.push(user)
          d.tenants[tenantId] = t
          d.session = { userId, tenantId, memberId, startedAt: now }
          audit(d.tenants[tenantId], principalOf(d)!, 'CREATE', 'Company', `Kompaniya yaratildi: ${pl.companyName} — 30 kunlik sinov boshlandi`, null)
          syncPlatformRow(d, tenantId)
        })
        return tenantId
      },

      /* ------------------------------------------------------- commerce */
      createSale: (input) => {
        let created!: Sale
        set((d) => {
          const { t, p, ent, ledger } = guard(d, 'sales.create')
          const lim = checkLimit(ent, 'monthlyTransactions', monthlyTxCount(t))
          if (!lim.ok) throw new ServiceError('err.limit.transactions', { limit: lim.limit ?? 0 })
          const at = nowIso()
          const lines: Sale['lines'] = []
          for (const l of input.lines) {
            const prod = t.products.find((x) => x.id === l.productId)
            if (!prod) throw new ServiceError('err.notFound')
            const s = stockOf(t, prod.id, l.warehouseId, prod.purchasePrice)
            if (prod.type !== 'SERVICE' && s.onHand - s.reserved < l.qty) throw new ServiceError('err.stock')
            lines.push({ id: uid('sl'), productId: prod.id, warehouseId: l.warehouseId, qty: l.qty, unitPrice: prod.salePrice, discountPct: l.discountPct ?? 0, vatRate: prod.vatRate, unitCost: prod.type === 'SERVICE' ? 0 : s.avgCost })
          }
          const total = Math.round(sum(lines, (l) => l.qty * l.unitPrice * (1 - l.discountPct / 100)))
          const vat = Math.round(total - total / (1 + t.company.vatRate / 100))
          const cogs = Math.round(sum(lines, (l) => l.qty * l.unitCost))
          const paid = Math.min(total, Math.max(0, input.paymentMethod === 'CREDIT' ? 0 : input.paidAmount))
          const customer = t.counterparties.find((c) => c.id === input.customerId)
          const sale: Sale = { id: uid('sale'), tenantId: t.company.tenantId, number: nextNumber(t, 'SALE', 'S'), customerId: input.customerId, branchId: input.branchId ?? p.branchIds[0] ?? t.branches[0]?.id, warehouseId: lines[0].warehouseId, status: paid >= total ? 'PAID' : paid > 0 ? 'PARTIALLY_PAID' : 'INVOICED', lines, discountPct: 0, vatAmount: vat, total, cogs, paymentMethod: input.paymentMethod, paidAmount: paid, dueAt: paid < total ? addDays(at, customer?.paymentTermDays || 14).toISOString() : null, channel: input.channel ?? (customer?.segment === 'Chakana' ? 'RETAIL' : 'B2B'), soldByMemberId: p.memberId!, invoiceId: null, note: '', occurredAt: at, createdAt: at, updatedAt: at }
          for (const l of lines) {
            const prod = t.products.find((x) => x.id === l.productId)!
            if (prod.type !== 'SERVICE') move(t, p, l.productId, l.warehouseId, 'SALES_ISSUE', -l.qty, l.unitCost, 'SALE', sale.id, sale.number)
          }
          t.journal.push(postSale(ledger, jeCtx(t, p, at), sale))
          // invoice when not fully paid or B2B customer
          if (paid < total || (customer && customer.segment !== 'Chakana')) {
            const inv: Invoice = { id: uid('inv'), tenantId: t.company.tenantId, number: nextNumber(t, 'INV', 'INV'), counterpartyId: input.customerId ?? t.counterparties[0].id, direction: 'OUT', status: 'ISSUED', issueDate: isoDate(), dueDate: isoDate(addDays(at, customer?.paymentTermDays || 14)), lines: lines.map((l) => ({ id: l.id, description: t.products.find((x) => x.id === l.productId)!.name, productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, vatRate: l.vatRate, total: Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)) })), subtotal: total - vat, vatAmount: vat, total, paidAmount: paid, currency: 'UZS', saleId: sale.id, purchaseId: null, note: '', createdAt: at, updatedAt: at }
            recomputeInvoiceStatus(inv)
            t.invoices.unshift(inv)
            sale.invoiceId = inv.id
          }
          if (paid > 0) {
            t.payments.unshift({ id: uid('pay'), tenantId: t.company.tenantId, number: nextNumber(t, 'PAY', 'PAY'), direction: 'IN', invoiceId: sale.invoiceId, counterpartyId: input.customerId, method: input.paymentMethod, amount: paid, accountId: input.paymentMethod === 'CASH' ? ledger.sys('CASH').id : ledger.sys('BANK_MAIN').id, bankAccountId: input.paymentMethod === 'CASH' ? null : t.bankAccounts[0]?.id ?? null, status: 'POSTED', requiresApproval: false, approvedByMemberId: null, paidAt: at, reference: sale.number, note: 'Savdo bilan birga', recordedByMemberId: p.memberId!, createdAt: at, updatedAt: at })
          }
          if (customer && customer.id) customer.balance += total - paid
          t.sales.unshift(sale)
          audit(t, p, 'CREATE', 'Sale', `Savdo ${sale.number} · ${lines.length} qator`, 'sales.create', sale.id)
          created = JSON.parse(JSON.stringify(sale))
        })
        return created
      },

      recordPayment: (input) => {
        let created!: Payment
        set((d) => {
          const { t, p, ledger } = guard(d, 'payments.create')
          const at = nowIso()
          const requiresApproval = input.direction === 'OUT' && input.amount > 50_000_000 && !can(p, 'payments.approve')
          const pay: Payment = { id: uid('pay'), tenantId: t.company.tenantId, number: nextNumber(t, 'PAY', 'PAY'), direction: input.direction, invoiceId: input.invoiceId, counterpartyId: input.counterpartyId, method: input.method, amount: input.amount, accountId: input.method === 'CASH' ? ledger.sys('CASH').id : ledger.sys('BANK_MAIN').id, bankAccountId: input.method === 'CASH' ? null : t.bankAccounts[0]?.id ?? null, status: requiresApproval ? 'PENDING' : 'POSTED', requiresApproval, approvedByMemberId: null, paidAt: at, reference: '', note: input.note ?? '', recordedByMemberId: p.memberId!, createdAt: at, updatedAt: at }
          if (!requiresApproval) {
            t.journal.push(postPayment(ledger, jeCtx(t, p, at), pay))
            const inv = t.invoices.find((i) => i.id === input.invoiceId)
            if (inv) {
              inv.paidAmount = Math.min(inv.total, inv.paidAmount + input.amount)
              recomputeInvoiceStatus(inv)
              const sale = t.sales.find((s) => s.id === inv.saleId)
              if (sale) {
                sale.paidAmount = inv.paidAmount
                sale.status = inv.paidAmount >= sale.total ? 'PAID' : 'PARTIALLY_PAID'
              }
              const po = t.purchases.find((x) => x.id === inv.purchaseId)
              if (po) {
                po.paidAmount = inv.paidAmount
                if (po.paidAmount >= po.total) po.status = 'PAID'
              }
            }
            const cp = t.counterparties.find((c) => c.id === input.counterpartyId)
            if (cp) cp.balance += input.direction === 'IN' ? -input.amount : input.amount
          } else {
            notify(t, { kind: 'APPROVAL_REQUEST', severity: 'INFO', title: "To'lov tasdiqlash so'rovi", body: `${pay.number}: ${input.amount.toLocaleString('uz-UZ')} so'm chiqim tasdiq kutmoqda.`, audienceRoles: ['OWNER', 'ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT'], link: '/app/payments' })
          }
          t.payments.unshift(pay)
          audit(t, p, 'CREATE', 'Payment', `To'lov ${pay.number} (${input.direction})`, 'payments.create', pay.id)
          created = JSON.parse(JSON.stringify(pay))
        })
        return created
      },

      approvePayment: (paymentId) =>
        set((d) => {
          const { t, p, ledger } = guard(d, 'payments.approve')
          const pay = t.payments.find((x) => x.id === paymentId)
          if (!pay || pay.status !== 'PENDING') return
          pay.status = 'POSTED'
          pay.approvedByMemberId = p.memberId
          pay.updatedAt = nowIso()
          t.journal.push(postPayment(ledger, jeCtx(t, p, nowIso()), pay))
          const inv = t.invoices.find((i) => i.id === pay.invoiceId)
          if (inv) {
            inv.paidAmount = Math.min(inv.total, inv.paidAmount + pay.amount)
            recomputeInvoiceStatus(inv)
          }
          audit(t, p, 'APPROVE', 'Payment', `To'lov ${pay.number} tasdiqlandi`, 'payments.approve', pay.id)
        }),

      createCounterparty: (c) => {
        let created!: Counterparty
        set((d) => {
          const { t, p } = guard(d, c.type === 'SUPPLIER' ? 'suppliers.create' : 'customers.create')
          const at = nowIso()
          created = { id: uid('c'), tenantId: t.company.tenantId, address: '', bankAccount: null, balance: 0, ownerMemberId: p.memberId, isActive: true, riskScore: null, createdAt: at, updatedAt: at, ...c }
          t.counterparties.unshift(created)
          audit(t, p, 'CREATE', 'Counterparty', `${c.type === 'SUPPLIER' ? "Ta'minotchi" : 'Mijoz'}: ${c.name}`, 'customers.create', created.id)
        })
        return created
      },

      /* ------------------------------------------------------ inventory */
      createProduct: (input) => {
        let created!: Product
        set((d) => {
          const { t, p, ent } = guard(d, 'products.create')
          const lim = checkLimit(ent, 'products', t.products.length)
          if (!lim.ok) throw new ServiceError('err.limit.products', { limit: lim.limit ?? 0 })
          const at = nowIso()
          const { openingQty, warehouseId, ...rest } = input
          created = { id: uid('p'), tenantId: t.company.tenantId, description: '', vatRate: t.company.vatRate, trackingMode: 'NONE', isActive: true, reorderQty: rest.reorderLevel * 2, leadTimeDays: 7, imageTone: 'sky', defaultWarehouseId: warehouseId ?? t.warehouses[0]?.id ?? null, createdAt: at, updatedAt: at, ...rest }
          t.products.unshift(created)
          if (openingQty && warehouseId) move(t, p, created.id, warehouseId, 'OPENING', openingQty, rest.purchasePrice, 'OPENING', null, "Boshlang'ich qoldiq")
          audit(t, p, 'CREATE', 'Product', `Mahsulot: ${rest.name}`, 'products.create', created.id)
        })
        return created
      },
      updateProduct: (id, patch) =>
        set((d) => {
          const { t, p } = guard(d, 'products.edit')
          const prod = t.products.find((x) => x.id === id)
          if (!prod) return
          Object.assign(prod, patch, { updatedAt: nowIso() })
          audit(t, p, 'UPDATE', 'Product', `Mahsulot yangilandi: ${prod.name}`, 'products.edit', id)
        }),
      adjustStock: (productId, warehouseId, delta, note) =>
        set((d) => {
          const { t, p } = guard(d, 'stock.edit')
          const s = stockOf(t, productId, warehouseId)
          move(t, p, productId, warehouseId, delta >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', delta, s.avgCost, 'ADJUSTMENT', null, note)
          audit(t, p, 'UPDATE', 'Stock', `Qoldiq tuzatildi ${delta > 0 ? '+' : ''}${delta}: ${note}`, 'stock.edit')
        }),
      createTransfer: (from, to, lines) =>
        set((d) => {
          const { t, p } = guard(d, 'transfers.create')
          const at = nowIso()
          for (const l of lines) {
            const s = stockOf(t, l.productId, from)
            if (s.onHand - s.reserved < l.qty) throw new ServiceError('err.stock')
          }
          const tr = { id: uid('trf'), tenantId: t.company.tenantId, number: nextNumber(t, 'TRF', 'TRF'), fromWarehouseId: from, toWarehouseId: to, status: 'IN_TRANSIT' as const, lines: lines.map((l) => ({ ...l, receivedQty: 0 })), shippedAt: at, receivedAt: null, createdAt: at, updatedAt: at }
          for (const l of lines) {
            const s = stockOf(t, l.productId, from)
            move(t, p, l.productId, from, 'TRANSFER_OUT', -l.qty, s.avgCost, 'TRANSFER', tr.id, tr.number)
            stockOf(t, l.productId, to, s.avgCost).inTransit += l.qty
          }
          t.transfers.unshift(tr)
          audit(t, p, 'CREATE', 'StockTransfer', `Ko'chirma ${tr.number}`, 'transfers.create', tr.id)
        }),
      receiveTransfer: (id) =>
        set((d) => {
          const { t, p } = guard(d, 'transfers.edit')
          const tr = t.transfers.find((x) => x.id === id)
          if (!tr || tr.status !== 'IN_TRANSIT') return
          for (const l of tr.lines) {
            const src = stockOf(t, l.productId, tr.fromWarehouseId)
            const dst = stockOf(t, l.productId, tr.toWarehouseId, src.avgCost)
            dst.inTransit = Math.max(0, dst.inTransit - l.qty)
            move(t, p, l.productId, tr.toWarehouseId, 'TRANSFER_IN', l.qty, src.avgCost, 'TRANSFER', tr.id, tr.number)
            l.receivedQty = l.qty
          }
          tr.status = 'RECEIVED'
          tr.receivedAt = nowIso()
          audit(t, p, 'UPDATE', 'StockTransfer', `Ko'chirma ${tr.number} qabul qilindi`, 'transfers.edit', tr.id)
        }),
      postStockCount: (warehouseId, lines) =>
        set((d) => {
          const { t, p } = guard(d, 'stockcounts.create')
          const at = nowIso()
          const cnt = { id: uid('cnt'), tenantId: t.company.tenantId, number: nextNumber(t, 'CNT', 'CNT'), warehouseId, status: 'POSTED' as const, lines: [] as { productId: string; systemQty: number; countedQty: number }[], postedAt: at, createdAt: at, updatedAt: at }
          for (const l of lines) {
            const s = stockOf(t, l.productId, warehouseId)
            cnt.lines.push({ productId: l.productId, systemQty: s.onHand, countedQty: l.countedQty })
            const diff = l.countedQty - s.onHand
            if (diff !== 0) move(t, p, l.productId, warehouseId, diff > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', diff, s.avgCost, 'STOCK_COUNT', cnt.id, cnt.number)
            s.lastCountedAt = at
          }
          t.stockCounts.unshift(cnt)
          audit(t, p, 'CREATE', 'StockCount', `Inventarizatsiya ${cnt.number}`, 'stockcounts.create', cnt.id)
        }),
      createWarehouse: (w) => {
        let created!: Warehouse
        set((d) => {
          const { t, p, ent } = guard(d, 'warehouses.create')
          const lim = checkLimit(ent, 'warehouses', t.warehouses.length)
          if (!lim.ok) throw new ServiceError('err.limit.warehouses', { limit: lim.limit ?? 0 })
          const at = nowIso()
          created = { id: uid('wh'), tenantId: t.company.tenantId, managerMemberId: null, isActive: true, createdAt: at, updatedAt: at, ...w }
          t.warehouses.push(created)
          audit(t, p, 'CREATE', 'Warehouse', `Ombor: ${w.name}`, 'warehouses.create', created.id)
          syncPlatformRow(d, t.company.tenantId)
        })
        return created
      },
      createBranch: (b) =>
        set((d) => {
          const { t, p, ent } = guard(d, 'branches.create')
          const lim = checkLimit(ent, 'branches', t.branches.length)
          if (!lim.ok) throw new ServiceError('err.limit.warehouses', { limit: lim.limit ?? 0 })
          const at = nowIso()
          t.branches.push({ id: uid('br'), tenantId: t.company.tenantId, managerMemberId: null, isActive: true, createdAt: at, updatedAt: at, ...b })
          audit(t, p, 'CREATE', 'Branch', `Filial: ${b.name}`, 'branches.create')
        }),

      /* ----------------------------------------------------- purchasing */
      createPurchase: (input) => {
        let created!: Purchase
        set((d) => {
          const { t, p } = guard(d, 'purchasing.create')
          const at = nowIso()
          const lines = input.lines.map((l) => ({ id: uid('pl'), ...l, vatRate: t.company.vatRate, receivedQty: 0 }))
          const subtotal = Math.round(sum(lines, (l) => l.qty * l.unitPrice))
          const vat = Math.round(subtotal * (t.company.vatRate / 100))
          const canApprove = can(p, 'purchasing.approve')
          created = { id: uid('po'), tenantId: t.company.tenantId, number: nextNumber(t, 'PO', 'PO'), supplierId: input.supplierId, warehouseId: input.warehouseId, status: input.asRequest || !canApprove ? 'REQUEST' : 'ORDERED', lines, subtotal, vatAmount: vat, total: subtotal + vat, paidAmount: 0, requestedByMemberId: p.memberId!, approvedByMemberId: canApprove && !input.asRequest ? p.memberId : null, expectedAt: addDays(at, 7).toISOString(), receivedAt: null, invoiceId: null, note: '', createdAt: at, updatedAt: at }
          t.purchases.unshift(created)
          if (created.status === 'REQUEST') notify(t, { kind: 'APPROVAL_REQUEST', severity: 'INFO', title: 'Xarid talabi', body: `${created.number}: ${created.total.toLocaleString('uz-UZ')} so'm tasdiq kutmoqda.`, audienceRoles: ['OWNER', 'ADMIN', 'DIRECTOR', 'PURCHASING_MANAGER'], link: '/app/purchasing' })
          audit(t, p, 'CREATE', 'Purchase', `Xarid ${created.number}`, 'purchasing.create', created.id)
        })
        return created
      },
      approvePurchase: (id) =>
        set((d) => {
          const { t, p } = guard(d, 'purchasing.approve')
          const po = t.purchases.find((x) => x.id === id)
          if (!po || po.status !== 'REQUEST') return
          po.status = 'ORDERED'
          po.approvedByMemberId = p.memberId
          po.updatedAt = nowIso()
          audit(t, p, 'APPROVE', 'Purchase', `Xarid ${po.number} tasdiqlandi`, 'purchasing.approve', po.id)
        }),
      receivePurchase: (id) =>
        set((d) => {
          const { t, p, ledger } = guard(d, 'stock.create')
          const po = t.purchases.find((x) => x.id === id)
          if (!po || (po.status !== 'ORDERED' && po.status !== 'PARTIALLY_RECEIVED')) return
          const at = nowIso()
          for (const l of po.lines) {
            move(t, p, l.productId, po.warehouseId, 'PURCHASE_RECEIPT', l.qty - l.receivedQty, l.unitPrice, 'PURCHASE', po.id, po.number)
            l.receivedQty = l.qty
          }
          po.status = 'BILLED'
          po.receivedAt = at
          t.journal.push(postPurchase(ledger, jeCtx(t, p, at), po, at))
          const sup = t.counterparties.find((c) => c.id === po.supplierId)
          const inv: Invoice = { id: uid('inv'), tenantId: t.company.tenantId, number: `SUP-${po.number.slice(-5)}`, counterpartyId: po.supplierId, direction: 'IN', status: 'ISSUED', issueDate: isoDate(), dueDate: isoDate(addDays(at, sup?.paymentTermDays || 15)), lines: po.lines.map((l) => ({ id: l.id, description: t.products.find((x) => x.id === l.productId)?.name ?? '', productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, vatRate: l.vatRate, total: Math.round(l.qty * l.unitPrice * (1 + l.vatRate / 100)) })), subtotal: po.subtotal, vatAmount: po.vatAmount, total: po.total, paidAmount: 0, currency: 'UZS', saleId: null, purchaseId: po.id, note: '', createdAt: at, updatedAt: at }
          t.invoices.unshift(inv)
          po.invoiceId = inv.id
          if (sup) sup.balance -= po.total
          audit(t, p, 'UPDATE', 'Purchase', `Xarid ${po.number} qabul qilindi`, 'stock.create', po.id)
        }),

      /* ----------------------------------------------------- accounting */
      postManualEntry: (input) =>
        set((d) => {
          const { t, p } = guard(d, 'journal.create', { feature: 'accounting.full' })
          const debit = sum(input.lines, (l) => l.debit)
          const credit = sum(input.lines, (l) => l.credit)
          if (Math.abs(debit - credit) > 1 || debit === 0) throw new ServiceError('err.balance')
          const at = input.date ? `${input.date}T12:00:00.000Z` : nowIso()
          const lines: JournalLine[] = input.lines.map((l) => ({ id: uid('jl'), accountId: l.accountId, debit: l.debit, credit: l.credit, memo: l.memo ?? input.memo }))
          t.journal.push({ id: uid('je'), tenantId: t.company.tenantId, number: nextNumber(t, 'JE', 'JE'), date: at, periodId: periodFor(t, at), source: 'MANUAL', sourceId: null, memo: input.memo, lines, totalDebit: debit, totalCredit: credit, status: 'POSTED', createdByMemberId: p.memberId!, approvedByMemberId: null, createdAt: nowIso(), updatedAt: nowIso() })
          audit(t, p, 'CREATE', 'JournalEntry', `Qo'lda o'tkazma: ${input.memo}`, 'journal.create')
        }),
      closePeriod: (periodId) =>
        set((d) => {
          const { t, p } = guard(d, 'periodclose.approve', { feature: 'accounting.full' })
          const per = t.periods.find((x) => x.id === periodId)
          if (!per) return
          per.status = 'CLOSED'
          per.closedAt = nowIso()
          per.closedByMemberId = p.memberId
          notify(t, { kind: 'SYSTEM', severity: 'SUCCESS', title: 'Davr yopildi', body: `${per.label} davri yopildi.`, audienceRoles: ['OWNER', 'ADMIN', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'AUDITOR'], link: '/app/accounting/periods' })
          audit(t, p, 'APPROVE', 'FiscalPeriod', `${per.label} davri yopildi`, 'periodclose.approve', per.id)
        }),
      matchBankLine: (lineId, paymentId) =>
        set((d) => {
          const { t, p } = guard(d, 'reconciliation.edit', { feature: 'bank.reconciliation' })
          const l = t.bankLines.find((x) => x.id === lineId)
          if (!l) return
          l.matchedPaymentId = paymentId
          l.matched = !!paymentId
          const pay = t.payments.find((x) => x.id === paymentId)
          if (pay) pay.status = 'RECONCILED'
          audit(t, p, 'UPDATE', 'BankStatementLine', `Bank qatori ${paymentId ? 'moslashtirildi' : 'ajratildi'}`, 'reconciliation.edit', lineId)
        }),
      fileTax: (taxId) =>
        set((d) => {
          const { t, p } = guard(d, 'taxes.create')
          const tx = t.taxes.find((x) => x.id === taxId)
          if (!tx) return
          tx.status = 'FILED'
          tx.filedAt = nowIso()
          audit(t, p, 'UPDATE', 'TaxReturn', `${tx.taxType} deklaratsiyasi belgilandi (ichki)`, 'taxes.create', tx.id)
        }),

      /* -------------------------------------------------- manufacturing */
      createProductionOrder: (input) => {
        let created!: ProductionOrder
        set((d) => {
          const { t, p } = guard(d, 'production.create', { feature: 'manufacturing' })
          const b = t.boms.find((x) => x.id === input.bomId)
          if (!b) throw new ServiceError('err.notFound')
          const q = input.plannedQty
          const mat = sum(b.lines, (l) => l.qty * (1 + l.scrapPct / 100) * (t.products.find((x) => x.id === l.productId)?.purchasePrice ?? 0)) * q
          const labor = (b.laborMinutes / 60) * b.laborRatePerHour * q
          const energy = b.energyKwh * b.energyRatePerKwh * q
          const machine = b.machineHours * b.machineRatePerHour * q
          const oh = (mat + labor) * (b.overheadRate / 100)
          const at = nowIso()
          created = { id: uid('prd'), tenantId: t.company.tenantId, number: nextNumber(t, 'PRD', 'PRD'), bomId: b.id, productId: b.productId, plannedQty: q, producedQty: 0, scrapQty: 0, status: 'PLANNED', warehouseId: t.warehouses.find((w) => w.type === 'PRODUCTION')?.id ?? t.warehouses[0].id, branchId: t.branches[0]?.id ?? null, plannedStart: input.plannedStart, plannedEnd: input.plannedEnd, actualStart: null, actualEnd: null, responsibleMemberId: p.memberId, workOrderIds: [], costs: [
            { component: 'MATERIAL', planned: Math.round(mat), actual: 0 },
            { component: 'LABOR', planned: Math.round(labor), actual: 0 },
            { component: 'ENERGY', planned: Math.round(energy), actual: 0 },
            { component: 'MACHINE', planned: Math.round(machine), actual: 0 },
            { component: 'OVERHEAD', planned: Math.round(oh), actual: 0 },
            { component: 'WASTE', planned: Math.round(mat * 0.02), actual: 0 },
          ], note: '', createdAt: at, updatedAt: at }
          t.productionOrders.unshift(created)
          audit(t, p, 'CREATE', 'ProductionOrder', `Ishlab chiqarish ${created.number} · ${q} dona`, 'production.create', created.id)
        })
        return created
      },
      advanceProductionOrder: (id) =>
        set((d) => {
          const { t, p, ledger } = guard(d, 'production.edit', { feature: 'manufacturing' })
          const o = t.productionOrders.find((x) => x.id === id)
          if (!o) return
          const at = nowIso()
          const rawWh = t.warehouses.find((w) => w.type === 'PRODUCTION')?.id ?? t.warehouses[0].id
          const fgWh = t.warehouses.find((w) => w.code === 'WH-03')?.id ?? t.warehouses[0].id
          const b = t.boms.find((x) => x.id === o.bomId)!
          if (o.status === 'PLANNED') {
            // release: consume materials
            let consumed = 0
            for (const l of b.lines) {
              const need = Math.round(l.qty * (1 + l.scrapPct / 100) * o.plannedQty * 100) / 100
              const s = stockOf(t, l.productId, rawWh)
              if (s.onHand < need) throw new ServiceError('err.stock')
              consumed += need * s.avgCost
              move(t, p, l.productId, rawWh, 'PRODUCTION_CONSUME', -need, s.avgCost, 'PRODUCTION', o.id, o.number)
            }
            o.costs.find((c) => c.component === 'MATERIAL')!.actual = Math.round(consumed)
            t.journal.push(postMaterialIssue(ledger, jeCtx(t, p, at), o, at, Math.round(consumed)))
            o.status = 'RELEASED'
            o.actualStart = at
          } else if (o.status === 'RELEASED') {
            o.status = 'IN_PROGRESS'
            o.producedQty = Math.round(o.plannedQty * 0.5)
          } else if (o.status === 'IN_PROGRESS') {
            o.status = 'QC'
            o.producedQty = o.plannedQty
            for (const c of o.costs) if (c.component !== 'MATERIAL') c.actual = Math.round(c.planned * (0.97 + Math.random() * 0.08))
          } else if (o.status === 'QC') {
            o.status = 'COMPLETED'
            o.actualEnd = at
            const unit = (sum(o.costs, (c) => c.actual) - (o.costs.find((c) => c.component === 'WASTE')?.actual ?? 0)) / Math.max(1, o.producedQty)
            move(t, p, o.productId, fgWh, 'PRODUCTION_OUTPUT', o.producedQty, Math.round(unit), 'PRODUCTION', o.id, o.number)
            t.journal.push(postProductionCompletion(ledger, jeCtx(t, p, at), o, at))
            t.qualityChecks.unshift({ id: uid('qc'), tenantId: t.company.tenantId, productionOrderId: o.id, checkedQty: o.producedQty, passQty: o.producedQty, failQty: 0, result: 'PASS', inspectorMemberId: p.memberId, note: '', checkedAt: at, createdAt: at, updatedAt: at })
          } else if (o.status === 'COMPLETED') {
            o.status = 'CLOSED'
          }
          o.updatedAt = at
          audit(t, p, 'UPDATE', 'ProductionOrder', `${o.number} → ${o.status}`, 'production.edit', o.id)
        }),
      setMachineState: (id, state) =>
        set((d) => {
          const { t, p } = guard(d, 'machines.edit', { feature: 'machines' })
          const m = t.machines.find((x) => x.id === id)
          if (!m) return
          m.state = state
          if (state === 'MAINTENANCE') {
            m.lastMaintenanceAt = nowIso()
            m.nextMaintenanceAt = addDays(new Date(), 90).toISOString()
          }
          audit(t, p, 'UPDATE', 'Machine', `${m.name} → ${state}`, 'machines.edit', id)
        }),

      /* ------------------------------------------------------------- hr */
      decideLeave: (id, approve) =>
        set((d) => {
          const { t, p } = guard(d, 'leave.approve', { feature: 'hr' })
          const l = t.leaves.find((x) => x.id === id)
          if (!l) return
          l.status = approve ? 'APPROVED' : 'REJECTED'
          l.approvedByMemberId = p.memberId
          audit(t, p, approve ? 'APPROVE' : 'REJECT', 'LeaveRequest', `Ta'til ${approve ? 'tasdiqlandi' : 'rad etildi'}`, 'leave.approve', id)
        }),
      approvePayroll: (runId) =>
        set((d) => {
          const { t, p } = guard(d, 'payroll.approve', { feature: 'payroll' })
          const r = t.payrollRuns.find((x) => x.id === runId)
          if (!r) return
          r.status = 'APPROVED'
          r.approvedByMemberId = p.memberId
          audit(t, p, 'APPROVE', 'PayrollRun', `Ish haqi ${r.periodLabel} tasdiqlandi`, 'payroll.approve', runId)
        }),
      payPayroll: (runId) =>
        set((d) => {
          const { t, p, ledger } = guard(d, 'payroll.approve', { feature: 'payroll' })
          const r = t.payrollRuns.find((x) => x.id === runId)
          if (!r || r.status !== 'APPROVED') return
          const at = nowIso()
          r.status = 'PAID'
          r.paidAt = at
          t.journal.push(...postPayroll(ledger, jeCtx(t, p, at), r, true))
          audit(t, p, 'UPDATE', 'PayrollRun', `Ish haqi ${r.periodLabel} to'landi`, 'payroll.approve', runId)
        }),
      createEmployee: (e) =>
        set((d) => {
          const { t, p } = guard(d, 'employees.create', { feature: 'hr' })
          const at = nowIso()
          t.employees.unshift({ id: uid('emp'), tenantId: t.company.tenantId, memberId: null, tin: null, branchId: t.branches[0]?.id ?? null, hiredAt: at, phone: '', email: '', status: 'ACTIVE', bankAccount: null, createdAt: at, updatedAt: at, ...e })
          t.company.employeeCount = t.employees.length
          audit(t, p, 'CREATE', 'Employee', `Xodim: ${e.fullName}`, 'employees.create')
        }),
      clockIn: (employeeId) =>
        set((d) => {
          const { t, p } = guard(d, 'attendance.create')
          const today = isoDate()
          if (t.attendance.some((a) => a.employeeId === employeeId && a.date === today)) return
          const at = nowIso()
          const hh = new Date().getUTCHours() + 5
          t.attendance.unshift({ id: uid('att'), tenantId: t.company.tenantId, employeeId, date: today, state: hh > 9 ? 'LATE' : 'PRESENT', clockIn: `${String(hh).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`, clockOut: null, overtimeHours: 0, createdAt: at, updatedAt: at })
          audit(t, p, 'CREATE', 'Attendance', 'Davomat belgilandi', 'attendance.create')
        }),

      /* --------------------------------------------- team & permissions */
      inviteMember: (m) => {
        let created!: Member
        set((d) => {
          const { t, p, ent } = guard(d, 'members.create')
          const lim = checkLimit(ent, 'users', t.members.filter((x) => x.status !== 'SUSPENDED').length)
          if (!lim.ok) throw new ServiceError('err.limit.users', { limit: lim.limit ?? 0, current: lim.current })
          if (m.role === 'OWNER') throw new ServiceError('err.permission')
          const at = nowIso()
          const userId = uid('u')
          d.users.push({ id: userId, fullName: m.fullName, email: m.email, phone: m.phone, passwordHash: hashPassword('invite-' + userId), avatarTone: ['sky', 'violet', 'gold', 'success'][m.fullName.length % 4], locale: 'uz', theme: 'dark', twoFactorEnabled: false, isSuperAdmin: false, lastLoginAt: null, createdAt: at, updatedAt: at })
          created = { id: uid('m'), tenantId: t.company.tenantId, userId, fullName: m.fullName, email: m.email, phone: m.phone, role: m.role, departmentId: null, branchIds: t.branches.map((b) => b.id), warehouseIds: t.warehouses.map((w) => w.id), permissionOverrides: {}, dataScope: m.dataScope, status: 'INVITED', lastActiveAt: null, avatarTone: 'sky', createdAt: at, updatedAt: at }
          t.members.push(created)
          t.subscription.seatsUsed = t.members.length
          audit(t, p, 'CREATE', 'Member', `Taklif: ${m.fullName} (${m.role})`, 'members.create', created.id)
          syncPlatformRow(d, t.company.tenantId)
        })
        return created
      },
      updateMember: (id, patch) =>
        set((d) => {
          const { t, p } = guard(d, 'members.edit')
          const m = t.members.find((x) => x.id === id)
          if (!m) return
          if (m.role === 'OWNER' && patch.role && patch.role !== 'OWNER' && p.role !== 'OWNER') throw new ServiceError('err.permission')
          const before = m.role
          Object.assign(m, patch, { updatedAt: nowIso() })
          if (patch.role && patch.role !== before) {
            m.permissionOverrides = {}
            audit(t, p, 'PERMISSION_CHANGE', 'Member', `${m.fullName}: rol ${before} → ${patch.role}`, 'roles.edit', id)
          } else audit(t, p, 'UPDATE', 'Member', `${m.fullName} yangilandi`, 'members.edit', id)
        }),
      setPermissionOverride: (memberId, key, value) =>
        set((d) => {
          const { t, p } = guard(d, 'roles.edit')
          const m = t.members.find((x) => x.id === memberId)
          if (!m) return
          if (m.role === 'OWNER') return
          if (value === null) delete m.permissionOverrides[key]
          else m.permissionOverrides[key] = value
          m.updatedAt = nowIso()
          audit(t, p, 'PERMISSION_CHANGE', 'Member', `${m.fullName}: ${key} = ${value === null ? 'standart' : value}`, 'roles.edit', memberId)
        }),
      updateCompany: (patch) =>
        set((d) => {
          const { t, p } = guard(d, 'settings.edit')
          Object.assign(t.company, patch, { updatedAt: nowIso() })
          audit(t, p, 'UPDATE', 'Company', 'Kompaniya rekvizitlari yangilandi', 'settings.edit')
          syncPlatformRow(d, t.company.tenantId)
        }),
      setDashboardHidden: (metric, roles) =>
        set((d) => {
          const { t, p } = guard(d, 'settings.edit', { write: false })
          d.dashboardHidden[t.company.tenantId] = { ...(d.dashboardHidden[t.company.tenantId] ?? {}), [metric]: roles }
          audit(t, p, 'PERMISSION_CHANGE', 'Dashboard', `${metric} ko'rinishi: ${roles.length} ta rol uchun yashirildi`, 'settings.edit')
        }),

      /* ------------------------------------------------ notifications */
      markNotificationsRead: (ids) =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.tenantId || !p.memberId) return
          const t = d.tenants[p.tenantId]
          for (const n of t.notifications) {
            if (ids && !ids.includes(n.id)) continue
            if (!n.readByMemberIds.includes(p.memberId)) n.readByMemberIds.push(p.memberId)
          }
        }),
      appendAIMessage: (conversationId, role, content, extra = {}) => {
        let convId = conversationId ?? ''
        set((d) => {
          const { t, p, ent } = guard(d, 'ai.view', { write: false })
          const at = nowIso()
          let conv = t.aiConversations.find((c) => c.id === conversationId && c.memberId === p.memberId)
          if (!conv) {
            conv = { id: uid('aic'), tenantId: t.company.tenantId, title: content.slice(0, 48), memberId: p.memberId!, messageIds: [], lastMessageAt: at, createdAt: at, updatedAt: at }
            t.aiConversations.unshift(conv)
          }
          convId = conv.id
          if (role === 'user') {
            const lim = checkLimit(ent, 'aiQuestionsPerMonth', t.aiQueriesThisMonth)
            if (!lim.ok) throw new ServiceError('err.limit.ai', { limit: lim.limit ?? 0 })
            t.aiQueriesThisMonth += 1
            audit(t, p, 'AI_QUERY', 'AIConversation', `So'rov: "${content.slice(0, 60)}"${extra.deniedScopes?.length ? ` — ${extra.deniedScopes.length} ko'lam rad etildi` : ''}`, 'ai.view', conv.id)
          }
          const msg = { id: uid('aim'), tenantId: t.company.tenantId, conversationId: conv.id, role, content, claimType: extra.claimType ?? null, insights: extra.insights ?? [], permissionsUsed: extra.permissionsUsed ?? [], deniedScopes: extra.deniedScopes ?? [], tokensUsed: Math.round(content.length / 4), createdAt: at }
          t.aiMessages.push(msg)
          conv.messageIds.push(msg.id)
          conv.lastMessageAt = at
          if (t.aiMessages.length > 400) t.aiMessages.splice(0, t.aiMessages.length - 400)
        })
        return convId
      },
      clearAIHistory: () =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.tenantId) return
          const t = d.tenants[p.tenantId]
          const mine = new Set(t.aiConversations.filter((c) => c.memberId === p.memberId).map((c) => c.id))
          t.aiConversations = t.aiConversations.filter((c) => !mine.has(c.id))
          t.aiMessages = t.aiMessages.filter((m) => !mine.has(m.conversationId))
        }),
      toggle2FA: () =>
        set((d) => {
          const u = d.users.find((x) => x.id === d.session?.userId)
          if (u) u.twoFactorEnabled = !u.twoFactorEnabled
        }),
      revokeSession: () => {
        /* Session registry is per-device; only the current one exists in this demo. */
      },

      /* -------------------------------------------------------- billing */
      simulateCheckout: (planId, cycle, provider) => {
        let invoiceNumber = ''
        set((d) => {
          const { t, p } = guard(d, 'billing.edit', { write: false })
          const at = nowIso()
          const ov = d.planOverrides[planId]
          const price = cycle === 'ANNUAL' ? (ov?.priceAnnual ?? PLANS[planId].priceAnnual) : (ov?.priceMonthly ?? PLANS[planId].priceMonthly)
          const vat = Math.round(price * 0.12)
          const periodEnd = addDays(at, cycle === 'ANNUAL' ? 365 : 30).toISOString()
          invoiceNumber = `BS-${new Date().getFullYear()}-${String((t.subscriptionInvoices.length + 1) * 7 + 100).padStart(5, '0')}`
          t.subscriptionInvoices.unshift({ id: uid('si'), tenantId: t.company.tenantId, number: invoiceNumber, subscriptionId: t.subscription.id, planId, billingCycle: cycle, periodStart: at, periodEnd, amount: price, vatAmount: vat, total: price + vat, currency: 'UZS', status: price === 0 ? 'PAID' : 'PAID', issuedAt: at, dueAt: at, paidAt: at, provider, reference: `SIM-${Date.now().toString(36).toUpperCase()}` })
          t.paymentAttempts.unshift({ id: uid('pa'), tenantId: t.company.tenantId, subscriptionInvoiceId: t.subscriptionInvoices[0].id, provider, providerConnected: false, amount: price + vat, currency: 'UZS', status: 'SIMULATED', reference: t.subscriptionInvoices[0].reference, failureReason: null, initiatedByUserId: p.userId, createdAt: at, updatedAt: at })
          Object.assign(t.subscription, { planId, status: 'ACTIVE', billingCycle: cycle, startedAt: t.subscription.startedAt ?? at, currentPeriodStart: at, currentPeriodEnd: periodEnd, renewalAt: periodEnd, cancelledAt: null, paymentStatus: 'PAID', provider, updatedAt: at } satisfies Partial<Subscription>)
          t.company.status = 'ACTIVE'
          notify(t, { kind: 'SUBSCRIPTION_EXPIRING', severity: 'SUCCESS', title: 'Obuna faollashdi', body: `${PLANS[planId].name} tarifi ${cycle === 'ANNUAL' ? 'yillik' : 'oylik'} rejimda faol.`, audienceRoles: ['OWNER', 'ADMIN'], link: '/app/settings/billing' })
          audit(t, p, 'PLAN_CHANGE', 'Subscription', `Obuna: ${planId} (${cycle}) · ${provider} · SIMULYATSIYA`, 'billing.edit')
          syncPlatformRow(d, t.company.tenantId)
        })
        return { invoiceNumber }
      },
      changePlan: (planId, cycle) =>
        set((d) => {
          const { t, p } = guard(d, 'billing.edit', { write: false })
          const before = t.subscription.planId
          t.subscription.planId = planId
          t.subscription.billingCycle = cycle
          t.subscription.updatedAt = nowIso()
          if (t.subscription.status === 'EXPIRED' || t.subscription.status === 'CANCELLED') {
            t.subscription.status = 'ACTIVE'
            t.subscription.currentPeriodStart = nowIso()
            t.subscription.currentPeriodEnd = addDays(new Date(), 30).toISOString()
            t.subscription.renewalAt = t.subscription.currentPeriodEnd
            t.subscription.paymentStatus = planId === 'FREE' ? 'PAID' : 'UNPAID'
          }
          audit(t, p, 'PLAN_CHANGE', 'Subscription', `Tarif ${before} → ${planId}`, 'billing.edit')
          syncPlatformRow(d, t.company.tenantId)
        }),
      cancelSubscription: () =>
        set((d) => {
          const { t, p } = guard(d, 'billing.delete', { write: false })
          if (p.role !== 'OWNER') throw new ServiceError('err.permission')
          t.subscription.cancelledAt = nowIso()
          t.subscription.status = 'CANCELLED'
          audit(t, p, 'PLAN_CHANGE', 'Subscription', 'Obuna bekor qilindi (davr oxirigacha)', 'billing.delete')
          syncPlatformRow(d, t.company.tenantId)
        }),

      /* ------------------------------------------------ platform admin */
      adminSetCompanyStatus: (tenantId, status) =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.isSuperAdmin) throw new ServiceError('err.permission')
          const t = d.tenants[tenantId]
          if (t) {
            t.subscription.status = status
            t.subscription.updatedAt = nowIso()
            t.company.status = status === 'SUSPENDED' ? 'SUSPENDED' : status === 'TRIAL' ? 'TRIAL' : 'ACTIVE'
            if (status === 'ACTIVE' && !t.subscription.currentPeriodEnd) {
              t.subscription.currentPeriodStart = nowIso()
              t.subscription.currentPeriodEnd = addDays(new Date(), 30).toISOString()
              t.subscription.renewalAt = t.subscription.currentPeriodEnd
            }
            notify(t, { kind: 'SYSTEM', severity: status === 'SUSPENDED' ? 'CRITICAL' : 'INFO', title: status === 'SUSPENDED' ? "Ish maydoni to'xtatildi" : 'Obuna holati yangilandi', body: status === 'SUSPENDED' ? "Platforma administratori ish maydonini vaqtincha to'xtatdi. Ma'lumotlar saqlanadi." : `Yangi holat: ${status}`, audienceRoles: ['OWNER', 'ADMIN'], link: '/app/settings/billing' })
            syncPlatformRow(d, tenantId)
          } else {
            const row = d.platformCompanies.find((r) => r.tenantId === tenantId)
            if (row) row.subscriptionStatus = status
          }
          d.systemLogs.unshift({ id: uid('log'), at: nowIso(), level: 'INFO', service: 'admin', message: `Company ${tenantId} → ${status} by super admin`, tenantId })
        }),
      adminChangePlan: (tenantId, planId) =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.isSuperAdmin) throw new ServiceError('err.permission')
          const t = d.tenants[tenantId]
          if (t) {
            t.subscription.planId = planId
            syncPlatformRow(d, tenantId)
          } else {
            const row = d.platformCompanies.find((r) => r.tenantId === tenantId)
            if (row) row.planId = planId
          }
          d.systemLogs.unshift({ id: uid('log'), at: nowIso(), level: 'INFO', service: 'admin', message: `Plan for ${tenantId} → ${planId}`, tenantId })
        }),
      adminExtendTrial: (tenantId, days) =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.isSuperAdmin) throw new ServiceError('err.permission')
          const t = d.tenants[tenantId]
          if (t) {
            const base = t.subscription.trialEnd && new Date(t.subscription.trialEnd) > new Date() ? t.subscription.trialEnd : nowIso()
            t.subscription.trialEnd = addDays(base, days).toISOString()
            t.subscription.status = 'TRIAL'
            t.subscription.trialExtendedDays += days
            t.company.status = 'TRIAL'
            notify(t, { kind: 'TRIAL_EXPIRING', severity: 'SUCCESS', title: 'Sinov muddati uzaytirildi', body: `Sinov muddatiga ${days} kun qo'shildi.`, audienceRoles: ['OWNER', 'ADMIN'], link: '/app/settings/billing' })
            syncPlatformRow(d, tenantId)
          } else {
            const row = d.platformCompanies.find((r) => r.tenantId === tenantId)
            if (row) {
              row.trialEnd = addDays(row.trialEnd && new Date(row.trialEnd) > new Date() ? row.trialEnd : nowIso(), days).toISOString()
              row.subscriptionStatus = 'TRIAL'
            }
          }
        }),
      adminDeleteCompany: (tenantId) =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.isSuperAdmin) throw new ServiceError('err.permission')
          if (tenantId === DEMO_TENANT_ID) throw new ServiceError('err.permission')
          delete d.tenants[tenantId]
          d.platformCompanies = d.platformCompanies.filter((r) => r.tenantId !== tenantId)
          d.systemLogs.unshift({ id: uid('log'), at: nowIso(), level: 'WARN', service: 'admin', message: `Company ${tenantId} DELETED by super admin`, tenantId })
        }),
      adminUpdatePlan: (planId, o) =>
        set((d) => {
          const p = principalOf(d)
          if (!p?.isSuperAdmin) throw new ServiceError('err.permission')
          const cur = d.planOverrides[planId] ?? { priceMonthly: PLANS[planId].priceMonthly, priceAnnual: PLANS[planId].priceAnnual, isActive: true }
          d.planOverrides[planId] = { ...cur, ...o }
        }),
      adminSetTicketStatus: (id, status) =>
        set((d) => {
          const tk = d.supportTickets.find((x) => x.id === id)
          if (tk) {
            tk.status = status
            tk.lastReplyAt = nowIso()
          }
        }),
      adminSetMaintenance: (v) => set((d) => void (d.maintenanceMode = v)),
      }
    }),
    {
      name: 'balans.app.v1',
      version: SEED_VERSION,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({
        ready: s.ready,
        seedVersion: s.seedVersion,
        users: s.users,
        tenants: s.tenants,
        platformCompanies: s.platformCompanies,
        supportTickets: s.supportTickets,
        systemLogs: s.systemLogs.slice(0, 80),
        planOverrides: s.planOverrides,
        dashboardHidden: s.dashboardHidden,
        session: s.session,
        theme: s.theme,
        maintenanceMode: s.maintenanceMode,
      }),
      migrate: () => ({}) as never,
    },
  ),
)

/** localStorage can overflow (multi-MB demo). Fail soft — the app still works in-memory. */
const safeStorage: Storage = {
  get length() {
    return localStorage.length
  },
  clear: () => localStorage.clear(),
  key: (i) => localStorage.key(i),
  getItem: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  removeItem: (k) => localStorage.removeItem(k),
  setItem: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* quota exceeded — keep in memory only */
    }
  },
}

/* ------------------------------------------------------------- selectors */

/**
 * Pure principal builder from stable store slices. Components must call this
 * inside useMemo (see useSession) — never as a zustand selector, because it
 * allocates a new object/Set per call and would defeat snapshot caching.
 */
export const buildPrincipal = (session: Session | null, user: User | null, tenant: TenantData | null): Principal | null => {
  if (!session || !user) return null
  if (user.isSuperAdmin && !session.tenantId) return { memberId: null, userId: user.id, tenantId: null, role: null, isSuperAdmin: true, permissions: new Set(), dataScope: 'ALL', branchIds: [], warehouseIds: [] }
  const member = tenant?.members.find((m) => m.id === session.memberId)
  if (!tenant || !member) return null
  return { memberId: member.id, userId: user.id, tenantId: tenant.company.tenantId, role: member.role, isSuperAdmin: false, permissions: effectivePermissions(member.role, member.permissionOverrides), dataScope: member.dataScope, branchIds: member.branchIds, warehouseIds: member.warehouseIds }
}
/** Non-hook selector for scripts/tests. */
export const selectPrincipal = (s: AppStore) => principalOf(s)
export const selectSession = (s: AppStore) => s.session
export const selectTenant = (s: AppStore): TenantData | null => (s.session?.tenantId ? (s.tenants[s.session.tenantId] ?? null) : null)
export const selectUser = (s: AppStore) => s.users.find((u) => u.id === s.session?.userId) ?? null
export const selectMember = (s: AppStore) => {
  const t = selectTenant(s)
  return t?.members.find((m) => m.id === s.session?.memberId) ?? null
}
