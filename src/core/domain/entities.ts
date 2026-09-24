import type {
  AccountSubtype,
  AccountType,
  AttendanceState,
  AuditAction,
  AIClaimType,
  AIInsightKind,
  BillingCycle,
  BusinessType,
  CompanyStatus,
  CostComponent,
  CounterpartyType,
  Currency,
  EmploymentType,
  EntityId,
  Industry,
  InvoiceStatus,
  JournalSource,
  Language,
  MachineState,
  MovementType,
  NotificationKind,
  NotificationSeverity,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  PayrollStatus,
  PeriodStatus,
  PlanId,
  ProductType,
  ProductionStatus,
  PurchaseStatus,
  QCResult,
  SaleStatus,
  SubscriptionStatus,
  TaxType,
  TenantId,
  Theme,
  TrackingMode,
  WarehouseType,
} from './enums'
import type { PermissionKey, RoleId } from '../rbac/permissions'

/** Base shape of every tenant-owned row. `tenantId` is never optional. */
export interface TenantEntity {
  id: EntityId
  tenantId: TenantId
  createdAt: string
  updatedAt: string
}

/* ============================== IDENTITY & TENANCY ======================== */

/**
 * A platform-level login identity. Deliberately NOT tied to any company —
 * one user may be a member of several tenants (Premium Plus multi-company).
 */
export interface User {
  id: EntityId
  fullName: string
  email: string
  phone: string
  /** bcrypt/argon hash on the server; never sent to the client. */
  passwordHash: string
  avatarTone: string
  locale: Language
  theme: Theme
  twoFactorEnabled: boolean
  isSuperAdmin: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ActiveSession {
  id: EntityId
  userId: EntityId
  deviceId: string
  deviceLabel: string
  ipLabel: string
  startedAt: string
  lastSeenAt: string
  current: boolean
}

/** Company = tenant. Everything else hangs off this. */
export interface Company extends TenantEntity {
  tenantId: TenantId
  name: string
  legalName: string
  /** STIR / INN */
  tin: string
  vatCertificate: string | null
  industry: Industry
  businessType: BusinessType
  ownerUserId: EntityId
  directorName: string
  chiefAccountantName: string | null
  phone: string
  email: string
  address: string
  bankName: string | null
  bankAccount: string | null
  bankMfo: string | null
  baseCurrency: Currency
  fiscalYearStartMonth: number
  vatRate: number
  turnoverTaxRate: number
  isDemo: boolean
  status: CompanyStatus
  employeeCount: number
  logoTone: string
}

export interface Branch extends TenantEntity {
  name: string
  code: string
  city: string
  address: string
  phone: string
  managerMemberId: EntityId | null
  isActive: boolean
}

export interface Warehouse extends TenantEntity {
  name: string
  code: string
  branchId: EntityId
  type: WarehouseType
  address: string
  managerMemberId: EntityId | null
  /** Set when the plan allows fewer warehouses than the company has. */
  isActive: boolean
}

/**
 * The link between a platform User and a Company. Roles & permission overrides
 * live here — the same person can be OWNER of company A and AUDITOR of company B.
 */
export interface Member extends TenantEntity {
  userId: EntityId
  fullName: string
  email: string
  phone: string
  role: RoleId
  departmentId: EntityId | null
  branchIds: EntityId[]
  warehouseIds: EntityId[]
  /** Explicit grants/revocations on top of the role's default permission set. */
  permissionOverrides: Partial<Record<PermissionKey, boolean>>
  /** Restricted to a subset of the tenant's data (e.g. only their own sales). */
  dataScope: 'ALL' | 'BRANCH' | 'WAREHOUSE' | 'SELF'
  status: 'INVITED' | 'ACTIVE' | 'SUSPENDED'
  lastActiveAt: string | null
  avatarTone: string
}

/* ============================== SUBSCRIPTION ============================== */

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  badge: string | null
  priceMonthly: number
  /** Annual is stored explicitly so the discount is never "inconsistent". */
  priceAnnual: number
  currency: Currency
  limits: PlanLimits
  features: PlanFeatureRow[]
  isPublic: boolean
  sortOrder: number
}

export interface PlanLimits {
  users: number | null // null = unlimited
  warehouses: number | null
  branches: number | null
  companies: number | null
  products: number | null
  monthlyTransactions: number | null
  aiQuestionsPerMonth: number | null
  storageMb: number
  apiAccess: boolean
}

export interface PlanFeatureRow {
  labelKey: string
  /** `true` included, `false` not included, string = "Limited (…)" */
  value: boolean | string
}

export interface Subscription extends TenantEntity {
  planId: PlanId
  status: SubscriptionStatus
  billingCycle: BillingCycle
  trialStart: string | null
  trialEnd: string | null
  startedAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  renewalAt: string | null
  cancelledAt: string | null
  paymentStatus: PaymentStatus
  seatsUsed: number
  /** Granted manually by the platform admin (support gesture). */
  trialExtendedDays: number
  provider: PaymentProvider | null
}

export interface SubscriptionInvoice extends Omit<TenantEntity, 'createdAt' | 'updatedAt'> {
  number: string
  subscriptionId: EntityId
  planId: PlanId
  billingCycle: BillingCycle
  periodStart: string
  periodEnd: string
  amount: number
  vatAmount: number
  total: number
  currency: Currency
  status: 'ISSUED' | 'PAID' | 'VOID' | 'OVERDUE'
  issuedAt: string
  dueAt: string
  paidAt: string | null
  provider: PaymentProvider | null
  reference: string | null
}

/**
 * Payment attempt. `providerConnected` mirrors the real integration state so the
 * UI can never pretend Payme/Click/Uzum are live when they are not.
 */
export interface PaymentAttempt extends TenantEntity {
  subscriptionInvoiceId: EntityId | null
  provider: PaymentProvider
  providerConnected: boolean
  amount: number
  currency: Currency
  status: 'INITIATED' | 'REDIRECTED' | 'CONFIRMED' | 'FAILED' | 'SIMULATED'
  reference: string | null
  failureReason: string | null
  initiatedByUserId: EntityId
}

/* ============================== CATALOGUE ================================= */

export interface ProductCategory extends TenantEntity {
  name: string
  parentId: EntityId | null
  code: string
}

export interface Unit extends TenantEntity {
  name: string
  symbol: string
  /** 1 unit = factor * baseUnit */
  factor: number
  baseUnitId: EntityId | null
}

export interface Product extends TenantEntity {
  sku: string
  barcode: string | null
  name: string
  description: string
  categoryId: EntityId | null
  type: ProductType
  unitId: EntityId
  salePrice: number
  purchasePrice: number
  vatRate: number
  trackingMode: TrackingMode
  isActive: boolean
  reorderLevel: number
  reorderQty: number
  leadTimeDays: number
  imageTone: string
  /** Derived by the inventory service, not stored blindly. */
  defaultWarehouseId: EntityId | null
}

export interface ProductVariant extends TenantEntity {
  productId: EntityId
  name: string
  sku: string
  attributes: Record<string, string>
  priceDelta: number
}

/** Stock is per product per warehouse — the single source of truth for quantity. */
export interface StockBalance extends TenantEntity {
  productId: EntityId
  warehouseId: EntityId
  onHand: number
  reserved: number
  inTransit: number
  /** Weighted-average cost, maintained by every inventory movement. */
  avgCost: number
  lastCountedAt: string | null
}

export interface InventoryMovement extends TenantEntity {
  productId: EntityId
  warehouseId: EntityId
  type: MovementType
  qty: number // signed
  unitCost: number
  value: number // qty * unitCost, signed
  referenceType: string
  referenceId: EntityId | null
  note: string
  performedByMemberId: EntityId
  occurredAt: string
}

export interface StockTransfer extends TenantEntity {
  number: string
  fromWarehouseId: EntityId
  toWarehouseId: EntityId
  status: 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED'
  lines: StockTransferLine[]
  shippedAt: string | null
  receivedAt: string | null
}

export interface StockTransferLine {
  productId: EntityId
  qty: number
  receivedQty: number
}

export interface StockCount extends TenantEntity {
  number: string
  warehouseId: EntityId
  status: 'IN_PROGRESS' | 'POSTED'
  lines: { productId: EntityId; systemQty: number; countedQty: number }[]
  postedAt: string | null
}

/* ============================== COUNTERPARTIES ============================ */

export interface Counterparty extends TenantEntity {
  type: CounterpartyType
  name: string
  tin: string | null
  contactName: string
  phone: string
  email: string
  address: string
  bankAccount: string | null
  /** Receivable (positive) or payable (negative) — recomputed from documents. */
  balance: number
  creditLimit: number
  paymentTermDays: number
  segment: string
  ownerMemberId: EntityId | null
  isActive: boolean
  riskScore: number | null
}

/* ============================== SALES ===================================== */

export interface SaleLine {
  id: EntityId
  productId: EntityId
  warehouseId: EntityId
  qty: number
  unitPrice: number
  discountPct: number
  vatRate: number
  /** Weighted-average cost at the moment of sale — makes margin real. */
  unitCost: number
}

export interface Sale extends TenantEntity {
  number: string
  customerId: EntityId | null
  branchId: EntityId
  warehouseId: EntityId
  status: SaleStatus
  lines: SaleLine[]
  discountPct: number
  vatAmount: number
  total: number
  cogs: number
  paymentMethod: PaymentMethod
  paidAmount: number
  dueAt: string | null
  channel: 'RETAIL' | 'WHOLESALE' | 'ONLINE' | 'B2B'
  soldByMemberId: EntityId
  invoiceId: EntityId | null
  note: string
  occurredAt: string
}

export interface InvoiceLine {
  id: EntityId
  description: string
  productId: EntityId | null
  qty: number
  unitPrice: number
  vatRate: number
  total: number
}

export interface Invoice extends TenantEntity {
  number: string
  counterpartyId: EntityId
  direction: 'OUT' | 'IN'
  status: InvoiceStatus
  issueDate: string
  dueDate: string
  lines: InvoiceLine[]
  subtotal: number
  vatAmount: number
  total: number
  paidAmount: number
  currency: Currency
  saleId: EntityId | null
  purchaseId: EntityId | null
  note: string
}

export interface Payment extends TenantEntity {
  number: string
  direction: 'IN' | 'OUT'
  invoiceId: EntityId | null
  counterpartyId: EntityId | null
  method: PaymentMethod
  amount: number
  accountId: EntityId
  bankAccountId: EntityId | null
  status: 'PENDING' | 'POSTED' | 'RECONCILED' | 'CANCELLED'
  requiresApproval: boolean
  approvedByMemberId: EntityId | null
  paidAt: string
  reference: string
  note: string
  recordedByMemberId: EntityId
}

/* ============================== PURCHASING ================================ */

export interface PurchaseLine {
  id: EntityId
  productId: EntityId
  qty: number
  unitPrice: number
  vatRate: number
  receivedQty: number
}

export interface Purchase extends TenantEntity {
  number: string
  supplierId: EntityId
  warehouseId: EntityId
  status: PurchaseStatus
  lines: PurchaseLine[]
  subtotal: number
  vatAmount: number
  total: number
  paidAmount: number
  requestedByMemberId: EntityId
  approvedByMemberId: EntityId | null
  expectedAt: string | null
  receivedAt: string | null
  invoiceId: EntityId | null
  note: string
}

/* ============================== ACCOUNTING ================================ */

export interface Account extends TenantEntity {
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  parentId: EntityId | null
  currency: Currency
  isActive: boolean
  isSystem: boolean
  /** System accounts cannot be deleted; they anchor automated postings. */
  systemKey:
    | 'CASH'
    | 'BANK_MAIN'
    | 'RECEIVABLES'
    | 'PAYABLES'
    | 'INVENTORY'
    | 'WIP'
    | 'REVENUE_SALES'
    | 'COGS'
    | 'VAT_OUTPUT'
    | 'VAT_INPUT'
    | 'VAT_PAYABLE'
    | 'PAYROLL_EXPENSE'
    | 'PAYROLL_PAYABLE'
    | 'RENT'
    | 'UTILITIES'
    | 'MARKETING'
    | 'LOGISTICS'
    | 'PRODUCTION_OVERHEAD'
    | 'DEPRECIATION'
    | 'FIXED_ASSETS'
    | 'EQUITY'
    | 'RETAINED_EARNINGS'
    | 'INCOME_TAX'
    | 'TURNOVER_TAX'
    | null
}

export interface JournalLine {
  id: EntityId
  accountId: EntityId
  debit: number
  credit: number
  memo: string
  /** Optional dimensions — what makes the ledger analyzable, not just balanced. */
  counterpartyId?: EntityId | null
  productId?: EntityId | null
  warehouseId?: EntityId | null
  branchId?: EntityId | null
  departmentId?: EntityId | null
  projectId?: EntityId | null
}

export interface JournalEntry extends TenantEntity {
  number: string
  date: string
  periodId: EntityId
  source: JournalSource
  sourceId: EntityId | null
  memo: string
  lines: JournalLine[]
  totalDebit: number
  totalCredit: number
  status: 'POSTED' | 'DRAFT' | 'REVERSED'
  createdByMemberId: EntityId
  approvedByMemberId: EntityId | null
}

export interface FiscalPeriod extends TenantEntity {
  label: string
  startDate: string
  endDate: string
  status: PeriodStatus
  closedAt: string | null
  closedByMemberId: EntityId | null
}

export interface BankAccount extends TenantEntity {
  name: string
  bankName: string
  accountNumber: string
  mfo: string
  currency: Currency
  balance: number
  openingBalance: number
  isActive: boolean
  accountId: EntityId
  /** Bank feeds are NOT connected — reconciliation is manual/import-based. */
  feedConnected: boolean
}

export interface BankStatementLine extends TenantEntity {
  bankAccountId: EntityId
  date: string
  description: string
  amount: number
  matchedPaymentId: EntityId | null
  matched: boolean
}

export interface TaxReturn extends TenantEntity {
  taxType: TaxType
  periodLabel: string
  periodStart: string
  periodEnd: string
  base: number
  rate: number
  amount: number
  dueDate: string
  status: 'DRAFT' | 'FILED' | 'PAID'
  filedAt: string | null
}

/* ============================== MANUFACTURING ============================= */

export interface BomLine {
  productId: EntityId
  qty: number
  scrapPct: number
  operationId: EntityId | null
}

export interface BillOfMaterials extends TenantEntity {
  productId: EntityId
  version: string
  name: string
  outputQty: number
  lines: BomLine[]
  laborMinutes: number
  laborRatePerHour: number
  energyKwh: number
  energyRatePerKwh: number
  machineHours: number
  machineRatePerHour: number
  overheadRate: number
  isActive: boolean
  /** Standard cost recomputed whenever inputs change. */
  standardCost: number
}

export interface Operation extends TenantEntity {
  name: string
  code: string
  sequence: number
  machineId: EntityId | null
  standardMinutes: number
  laborRatePerHour: number
}

export interface Machine extends TenantEntity {
  name: string
  code: string
  model: string
  state: MachineState
  capacityPerHour: number
  hourlyCost: number
  workshopBranchId: EntityId | null
  lastMaintenanceAt: string
  nextMaintenanceAt: string
  totalRuntimeHours: number
}

export interface ProductionCostLine {
  component: CostComponent
  planned: number
  actual: number
}

export interface ProductionOrder extends TenantEntity {
  number: string
  bomId: EntityId
  productId: EntityId
  plannedQty: number
  producedQty: number
  scrapQty: number
  status: ProductionStatus
  warehouseId: EntityId
  branchId: EntityId | null
  plannedStart: string
  plannedEnd: string
  actualStart: string | null
  actualEnd: string | null
  responsibleMemberId: EntityId | null
  workOrderIds: EntityId[]
  costs: ProductionCostLine[]
  note: string
}

export interface WorkOrder extends TenantEntity {
  number: string
  productionOrderId: EntityId
  operationId: EntityId
  machineId: EntityId | null
  plannedQty: number
  completedQty: number
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'BLOCKED'
  startedAt: string | null
  finishedAt: string | null
  workerMemberId: EntityId | null
  laborMinutes: number
}

export interface MaterialIssue extends TenantEntity {
  productionOrderId: EntityId
  productId: EntityId
  warehouseId: EntityId
  plannedQty: number
  issuedQty: number
  unitCost: number
  issuedAt: string
}

export interface QualityCheck extends TenantEntity {
  productionOrderId: EntityId
  checkedQty: number
  passQty: number
  failQty: number
  result: QCResult
  inspectorMemberId: EntityId | null
  note: string
  checkedAt: string
}

/* ============================== HR & PAYROLL ============================== */

export interface Department extends TenantEntity {
  name: string
  code: string
  headMemberId: EntityId | null
  parentId: EntityId | null
  costCenterAccountId: EntityId | null
}

export interface Employee extends TenantEntity {
  memberId: EntityId | null
  fullName: string
  tin: string | null
  position: string
  departmentId: EntityId | null
  branchId: EntityId | null
  employmentType: EmploymentType
  hiredAt: string
  baseSalary: number
  /** Highly restricted — gated by `hr.payroll.view` and `hr.salary.*`. */
  phone: string
  email: string
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED'
  bankAccount: string | null
}

export interface AttendanceRecord extends TenantEntity {
  employeeId: EntityId
  date: string
  state: AttendanceState
  clockIn: string | null
  clockOut: string | null
  overtimeHours: number
}

export interface LeaveRequest extends TenantEntity {
  employeeId: EntityId
  type: 'ANNUAL' | 'SICK' | 'UNPAID' | 'MATERNITY'
  startDate: string
  endDate: string
  days: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedByMemberId: EntityId | null
  note: string
}

export interface PayslipLine {
  label: string
  kind: 'EARNING' | 'DEDUCTION' | 'TAX'
  amount: number
}

export interface Payslip extends TenantEntity {
  payrollRunId: EntityId
  employeeId: EntityId
  periodLabel: string
  lines: PayslipLine[]
  gross: number
  deductions: number
  net: number
}

export interface PayrollRun extends TenantEntity {
  number: string
  periodLabel: string
  periodStart: string
  periodEnd: string
  status: PayrollStatus
  headcount: number
  grossTotal: number
  taxTotal: number
  netTotal: number
  payslips: EntityId[]
  approvedByMemberId: EntityId | null
  paidAt: string | null
}

/* ============================== OTHER MODULES ============================= */

export interface FixedAsset extends TenantEntity {
  name: string
  code: string
  category: string
  acquiredAt: string
  cost: number
  accumulatedDepreciation: number
  netBookValue: number
  usefulLifeMonths: number
  monthlyDepreciation: number
  branchId: EntityId | null
  status: 'IN_USE' | 'IDLE' | 'DISPOSED'
}

export interface Project extends TenantEntity {
  name: string
  code: string
  status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'DONE'
  managerMemberId: EntityId | null
  budget: number
  startDate: string
  endDate: string | null
  customerId: EntityId | null
}

export interface Budget extends TenantEntity {
  label: string
  periodStart: string
  periodEnd: string
  lines: { accountId: EntityId; planned: number }[]
}

/** CRM activity — used by Premium Plus advanced CRM. */
export interface CrmActivity extends TenantEntity {
  counterpartyId: EntityId
  kind: 'CALL' | 'MEETING' | 'EMAIL' | 'TASK' | 'NOTE'
  subject: string
  body: string
  dueAt: string | null
  done: boolean
  ownerMemberId: EntityId
}

export interface Document extends TenantEntity {
  name: string
  kind: 'CONTRACT' | 'INVOICE_PDF' | 'REPORT' | 'EXPORT' | 'OTHER'
  entityType: string
  entityId: EntityId
  sizeKb: number
  uploadedByMemberId: EntityId
  mimeType: string
}

/* ============================== AI & AUDIT ================================ */

export interface AIMessage extends Omit<TenantEntity, 'updatedAt'> {
  conversationId: EntityId
  role: 'user' | 'assistant'
  content: string
  claimType: AIClaimType | null
  insights: AIInsight[]
  /** The exact permission set used to build the answer — proves the gate. */
  permissionsUsed: PermissionKey[]
  deniedScopes: string[]
  tokensUsed: number
  createdAt: string
}

export interface AIInsight {
  kind: AIInsightKind
  claimType: AIClaimType
  title: string
  body: string
  metric?: { label: string; value: string }
}

export interface AIConversation extends TenantEntity {
  title: string
  memberId: EntityId
  messageIds: EntityId[]
  lastMessageAt: string
}

export interface AuditLog extends Omit<TenantEntity, 'updatedAt' | 'createdAt'> {
  action: AuditAction
  actorMemberId: EntityId | null
  actorUserId: EntityId | null
  actorLabel: string
  entityType: string
  entityId: EntityId | null
  summary: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  permissionRequired: PermissionKey | null
  ipLabel: string
  createdAt: string
}

export interface Notification extends TenantEntity {
  kind: NotificationKind
  severity: NotificationSeverity
  title: string
  body: string
  /** Roles that should receive it — implements role-relevant notifications. */
  audienceRoles: RoleId[]
  audienceMemberId: EntityId | null
  link: string | null
  readAt: string | null
  readByMemberIds: EntityId[]
  createdAt: string
}

/* ============================== PLATFORM ADMIN ============================ */

/** Platform-level (cross-tenant) rows. Kept in a separate namespace on purpose. */
export interface PlatformCompanyRow {
  tenantId: TenantId
  name: string
  industry: Industry
  businessType: BusinessType
  planId: PlanId
  subscriptionStatus: SubscriptionStatus
  users: number
  warehouses: number
  trialEnd: string | null
  createdAt: string
  lastActivityAt: string
  mrr: number
  isDemo: boolean
}

export interface PlatformMetrics {
  totalCompanies: number
  activeSubscriptions: number
  trialCompanies: number
  freePlanCompanies: number
  premiumSubscribers: number
  premiumPlusSubscribers: number
  expiredSubscriptions: number
  suspendedSubscriptions: number
  mrr: number
  arr: number
  newRegistrations30d: number
  churnedLast90d: number
  churnRatePct: number
  trialConversionPct: number
  activeUsers: number
  totalUsers: number
  aiQueries30d: number
  aiQueriesPerCompanyAvg: number
  storageUsedGb: number
  storageCapacityGb: number
  systemHealth: { apiLatencyMs: number; dbLoadPct: number; queueDepth: number; uptimePct: number; incidents: number }
  revenueSeries: { month: string; mrr: number; newCompanies: number; churned: number }[]
}

export interface SupportTicket {
  id: EntityId
  tenantId: TenantId | null
  company: string
  subject: string
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'PENDING' | 'RESOLVED'
  planId: PlanId
  createdAt: string
  lastReplyAt: string
}

export interface SystemLogEntry {
  id: EntityId
  at: string
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  service: string
  message: string
  tenantId: TenantId | null
}
