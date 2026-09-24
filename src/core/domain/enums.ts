/**
 * Balans ERP — domain vocabulary.
 *
 * Every enum here maps 1:1 to a column that a real backend would persist, so the
 * frontend never has to be rewritten when the API arrives. Values are SCREAMING_SNAKE
 * for the wire and are translated for humans by the i18n layer.
 */

/* ------------------------------------------------------------------ tenancy */

export type TenantId = string
export type EntityId = string

/** Business shape chosen during onboarding step 2. */
export const BUSINESS_TYPES = [
  'TRADING',
  'SERVICE',
  'MANUFACTURING',
  'FACTORY',
  'RETAIL',
  'WHOLESALE',
  'RESTAURANT',
  'CONSTRUCTION',
  'LOGISTICS',
  'OTHER',
] as const
export type BusinessType = (typeof BUSINESS_TYPES)[number]

export const INDUSTRIES = [
  'IT_SOFTWARE',
  'FOOD_BEVERAGE',
  'TEXTILE',
  'CONSTRUCTION_MATERIALS',
  'CHEMICALS',
  'METALLURGY',
  'AGRICULTURE',
  'PHARMACEUTICALS',
  'FURNITURE',
  'AUTOMOTIVE',
  'ELECTRONICS',
  'ENERGY',
  'TRANSPORT',
  'MEDICINE',
  'EDUCATION',
  'OTHER',
] as const
export type Industry = (typeof INDUSTRIES)[number]

export const COMPANY_STATUSES = ['TRIAL', 'ACTIVE', 'SUSPENDED', 'CLOSED'] as const
export type CompanyStatus = (typeof COMPANY_STATUSES)[number]

/* ------------------------------------------------------------ subscription */

export const PLAN_IDS = ['FREE', 'PREMIUM', 'PREMIUM_PLUS'] as const
export type PlanId = (typeof PLAN_IDS)[number]

export const BILLING_CYCLES = ['MONTHLY', 'ANNUAL'] as const
export type BillingCycle = (typeof BILLING_CYCLES)[number]

/**
 * Lifecycle of a company's subscription. Feature access is derived from this —
 * never from a UI flag.
 */
export const SUBSCRIPTION_STATUSES = [
  'TRIAL',
  'ACTIVE',
  'PAST_DUE',
  'EXPIRED',
  'SUSPENDED',
  'CANCELLED',
] as const
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number]

export const PAYMENT_STATUSES = ['UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

/**
 * Uzbek payment rails. These are *integration targets*, not live connections:
 * `connected` is false for every provider until a real API credential exists.
 */
export const PAYMENT_PROVIDERS = ['PAYME', 'CLICK', 'UZUM', 'BANK_TRANSFER'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

/* -------------------------------------------------------------- inventory */

export const PRODUCT_TYPES = ['GOODS', 'SERVICE', 'RAW_MATERIAL', 'FINISHED_GOOD', 'WIP'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const TRACKING_MODES = ['BATCH', 'SERIAL', 'NONE'] as const
export type TrackingMode = (typeof TRACKING_MODES)[number]

export const MOVEMENT_TYPES = [
  'PURCHASE_RECEIPT',
  'SALES_ISSUE',
  'TRANSFER_IN',
  'TRANSFER_OUT',
  'ADJUSTMENT_IN',
  'ADJUSTMENT_OUT',
  'PRODUCTION_CONSUME',
  'PRODUCTION_OUTPUT',
  'SCRAP',
  'RETURN_IN',
  'RETURN_OUT',
  'OPENING',
] as const
export type MovementType = (typeof MOVEMENT_TYPES)[number]

export const WAREHOUSE_TYPES = ['MAIN', 'BRANCH', 'PRODUCTION', 'TRANSIT', 'RETAIL'] as const
export type WarehouseType = (typeof WAREHOUSE_TYPES)[number]

/* ------------------------------------------------------------------ sales */

export const SALE_STATUSES = ['DRAFT', 'CONFIRMED', 'INVOICED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const PAYMENT_METHODS = ['CASH', 'CARD', 'BANK_TRANSFER', 'PAYME', 'CLICK', 'UZUM', 'CREDIT'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const COUNTERPARTY_TYPES = ['CUSTOMER', 'SUPPLIER', 'BOTH'] as const
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number]

/* -------------------------------------------------------------- purchasing */

export const PURCHASE_STATUSES = [
  'REQUEST',
  'APPROVED',
  'ORDERED',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
  'BILLED',
  'PAID',
  'CANCELLED',
] as const
export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number]

/* ------------------------------------------------------------ manufacturing */

export const PRODUCTION_STATUSES = ['PLANNED', 'RELEASED', 'IN_PROGRESS', 'QC', 'COMPLETED', 'CLOSED', 'CANCELLED'] as const
export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number]

export const QC_RESULTS = ['PASS', 'FAIL', 'CONCESSION'] as const
export type QCResult = (typeof QC_RESULTS)[number]

export const MACHINE_STATES = ['RUNNING', 'IDLE', 'MAINTENANCE', 'DOWN'] as const
export type MachineState = (typeof MACHINE_STATES)[number]

export const COST_COMPONENTS = ['MATERIAL', 'LABOR', 'ENERGY', 'MACHINE', 'OVERHEAD', 'WASTE'] as const
export type CostComponent = (typeof COST_COMPONENTS)[number]

/* --------------------------------------------------------------- hr */

export const EMPLOYMENT_TYPES = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'HOURLY', 'INTERN'] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const ATTENDANCE_STATES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE', 'SICK', 'OVERTIME'] as const
export type AttendanceState = (typeof ATTENDANCE_STATES)[number]

export const PAYROLL_STATUSES = ['DRAFT', 'CALCULATED', 'APPROVED', 'PAID'] as const
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number]

/* --------------------------------------------------------------- accounting */

/** Uzbek chart-of-accounts classes, aligned with the national accounting plan. */
export const ACCOUNT_TYPES = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'COGS',
  'EXPENSE',
  'OTHER_INCOME',
] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_SUBTYPES = [
  'CURRENT_ASSET',
  'FIXED_ASSET',
  'BANK',
  'CASH',
  'RECEIVABLE',
  'INVENTORY',
  'CURRENT_LIABILITY',
  'LONG_TERM_LIABILITY',
  'PAYABLE',
  'TAX_PAYABLE',
  'EQUITY',
  'RETAINED_EARNINGS',
  'OPERATING_REVENUE',
  'OTHER_REVENUE',
  'COGS',
  'OPEX',
  'PAYROLL_EXPENSE',
  'DEPRECIATION',
  'TAX_EXPENSE',
] as const
export type AccountSubtype = (typeof ACCOUNT_SUBTYPES)[number]

export const JOURNAL_SOURCES = [
  'MANUAL',
  'SALES',
  'PURCHASES',
  'INVENTORY',
  'PAYROLL',
  'PRODUCTION',
  'BANK',
  'TAX',
  'FIXED_ASSET',
  'OPENING',
  'PERIOD_CLOSE',
] as const
export type JournalSource = (typeof JOURNAL_SOURCES)[number]

export const PERIOD_STATUSES = ['OPEN', 'SOFT_CLOSE', 'CLOSED'] as const
export type PeriodStatus = (typeof PERIOD_STATUSES)[number]

export const TAX_TYPES = ['VAT', 'TURNOVER', 'INCOME', 'PAYROLL', 'PROPERTY', 'EXCISE'] as const
export type TaxType = (typeof TAX_TYPES)[number]

/* ------------------------------------------------------------------ shared */

export const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'] as const
export type Currency = (typeof CURRENCIES)[number]

export const LANGUAGES = ['uz', 'ru', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

export const THEMES = ['dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const NOTIFICATION_KINDS = [
  'LOW_STOCK',
  'OVERDUE_PAYMENT',
  'INVOICE_DUE',
  'APPROVAL_REQUEST',
  'TRIAL_EXPIRING',
  'SUBSCRIPTION_EXPIRING',
  'PRODUCTION_WARNING',
  'AI_INSIGHT',
  'SYSTEM',
] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

export const NOTIFICATION_SEVERITIES = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number]

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'APPROVE',
  'REJECT',
  'LOGIN',
  'LOGOUT',
  'EXPORT',
  'PERMISSION_CHANGE',
  'PLAN_CHANGE',
  'SUSPEND',
  'ACTIVATE',
  'AI_QUERY',
  'DENIED_ACCESS',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AI_INSIGHT_KINDS = ['INSIGHT', 'RISK', 'OPPORTUNITY', 'ANALYSIS', 'RECOMMENDATION'] as const
export type AIInsightKind = (typeof AI_INSIGHT_KINDS)[number]

/**
 * AI must always label how it arrived at a number. This is a hard product rule,
 * not decoration — see `AIAnswer.evidence`.
 */
export const AI_CLAIM_TYPES = ['FACT', 'ESTIMATE', 'RECOMMENDATION'] as const
export type AIClaimType = (typeof AI_CLAIM_TYPES)[number]
