import type {
  Account,
  AIConversation,
  AIMessage,
  AttendanceRecord,
  AuditLog,
  BankAccount,
  BankStatementLine,
  BillOfMaterials,
  Branch,
  Company,
  Counterparty,
  Department,
  Employee,
  FiscalPeriod,
  FixedAsset,
  InventoryMovement,
  Invoice,
  JournalEntry,
  LeaveRequest,
  Machine,
  Member,
  Notification,
  PaymentAttempt,
  Payment,
  PayrollRun,
  Payslip,
  Product,
  ProductCategory,
  ProductionOrder,
  Purchase,
  QualityCheck,
  Sale,
  StockBalance,
  StockCount,
  StockTransfer,
  Subscription,
  SubscriptionInvoice,
  TaxReturn,
  Unit,
  Warehouse,
  WorkOrder,
} from '@/core/domain/entities'

/**
 * Everything that belongs to ONE tenant. The store keeps a map
 * `tenants[tenantId] → TenantData`, and every service receives exactly one of
 * these — it is physically impossible for a query to span two tenants.
 */
export interface TenantData {
  company: Company
  subscription: Subscription
  subscriptionInvoices: SubscriptionInvoice[]
  paymentAttempts: PaymentAttempt[]
  branches: Branch[]
  warehouses: Warehouse[]
  members: Member[]
  departments: Department[]
  employees: Employee[]
  categories: ProductCategory[]
  units: Unit[]
  products: Product[]
  stock: StockBalance[]
  movements: InventoryMovement[]
  transfers: StockTransfer[]
  stockCounts: StockCount[]
  counterparties: Counterparty[]
  sales: Sale[]
  invoices: Invoice[]
  payments: Payment[]
  purchases: Purchase[]
  accounts: Account[]
  journal: JournalEntry[]
  periods: FiscalPeriod[]
  bankAccounts: BankAccount[]
  bankLines: BankStatementLine[]
  taxes: TaxReturn[]
  boms: BillOfMaterials[]
  machines: Machine[]
  productionOrders: ProductionOrder[]
  workOrders: WorkOrder[]
  qualityChecks: QualityCheck[]
  attendance: AttendanceRecord[]
  leaves: LeaveRequest[]
  payrollRuns: PayrollRun[]
  payslips: Payslip[]
  fixedAssets: FixedAsset[]
  notifications: Notification[]
  audit: AuditLog[]
  aiConversations: AIConversation[]
  aiMessages: AIMessage[]
  aiQueriesThisMonth: number
  counters: Record<string, number>
}

export function emptyTenantData(company: Company, subscription: Subscription): TenantData {
  return {
    company,
    subscription,
    subscriptionInvoices: [],
    paymentAttempts: [],
    branches: [],
    warehouses: [],
    members: [],
    departments: [],
    employees: [],
    categories: [],
    units: [],
    products: [],
    stock: [],
    movements: [],
    transfers: [],
    stockCounts: [],
    counterparties: [],
    sales: [],
    invoices: [],
    payments: [],
    purchases: [],
    accounts: [],
    journal: [],
    periods: [],
    bankAccounts: [],
    bankLines: [],
    taxes: [],
    boms: [],
    machines: [],
    productionOrders: [],
    workOrders: [],
    qualityChecks: [],
    attendance: [],
    leaves: [],
    payrollRuns: [],
    payslips: [],
    fixedAssets: [],
    notifications: [],
    audit: [],
    aiConversations: [],
    aiMessages: [],
    aiQueriesThisMonth: 0,
    counters: {},
  }
}
