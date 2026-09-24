/**
 * Balans ERP — Role Based Access Control core.
 *
 * TWO independent axes, both enforced:
 *
 *  1. `ModulePermission`  → what a member can DO   (view / create / edit / delete / approve / export)
 *  2. `DataScope`         → what FINANCIAL FACTS a member is allowed to SEE
 *
 * The second axis is what implements the product's hardest rule:
 *   "NO EMPLOYEE SHOULD SEE FINANCIAL INFORMATION UNLESS THEIR ROLE ALLOWS IT."
 *
 * Scopes are checked in the *service layer*, not in components. A component that
 * renders a profit card without the scope gets `undefined` back from the service,
 * so hiding a button is never the only line of defence.
 */

/* ------------------------------------------------------------------ actions */

export const ACTIONS = ['view', 'create', 'edit', 'delete', 'approve', 'export'] as const
export type Action = (typeof ACTIONS)[number]

/* ------------------------------------------------------------------ modules */

export const MODULES = [
  'dashboard',
  'sales',
  'pos',
  'invoices',
  'payments',
  'products',
  'stock',
  'warehouses',
  'transfers',
  'stockcounts',
  'purchasing',
  'suppliers',
  'customers',
  'crm',
  'accounting',
  'ledger',
  'journal',
  'chartofaccounts',
  'reconciliation',
  'taxes',
  'periodclose',
  'reports',
  'manufacturing',
  'bom',
  'production',
  'machines',
  'quality',
  'hr',
  'employees',
  'attendance',
  'leave',
  'payroll',
  'departments',
  'projects',
  'fixedassets',
  'budgeting',
  'ai',
  'notifications',
  'settings',
  'members',
  'roles',
  'branches',
  'billing',
  'audit',
  'integrations',
  'documents',
] as const
export type Module = (typeof MODULES)[number]

export type ModulePermission = `${Module}.${Action}`

/* ---------------------------------------------------- sensitive data scopes */

/**
 * Financial facts that are hidden from employees by default. Each one is a
 * separate switch the OWNER can flip per role in the permission matrix.
 */
export const DATA_SCOPES = [
  /** Company-wide revenue totals (not the same as "the sale I just made"). */
  'finance.revenue.view',
  /** Company-wide expense totals & P&L expense lines. */
  'finance.expense.view',
  /** Net profit, gross margin, profitability ratios. */
  'finance.profit.view',
  /** Cash register / till balances. */
  'finance.cash.view',
  /** Bank account balances & statements. */
  'finance.bank.view',
  /** Payroll totals for the company. */
  'finance.payroll.view',
  /** Salaries of employees other than oneself. */
  'finance.salary.others.view',
  /** One's own payslip. Almost always granted. */
  'finance.salary.self.view',
  /** Tax liabilities & returns. */
  'finance.tax.view',
  /** Unit costs, COGS, product margins. */
  'finance.cost.view',
  /** Executive dashboard & board-level reporting. */
  'finance.executive.view',
  /** Full customer/supplier balances beyond the module's own documents. */
  'finance.counterparty.balances.view',
] as const
export type DataScope = (typeof DATA_SCOPES)[number]

export type PermissionKey = ModulePermission | DataScope

/* -------------------------------------------------------------------- roles */

/**
 * Company roles. `SUPER_ADMIN` is intentionally NOT here — it lives in the
 * platform namespace and can never be assigned to a company member.
 */
export const ROLES = [
  'OWNER',
  'ADMIN',
  'DIRECTOR',
  'CHIEF_ACCOUNTANT',
  'ACCOUNTANT',
  'SALES_MANAGER',
  'SALES_EMPLOYEE',
  'WAREHOUSE_MANAGER',
  'WAREHOUSE_EMPLOYEE',
  'PURCHASING_MANAGER',
  'HR_MANAGER',
  'PRODUCTION_MANAGER',
  'FACTORY_WORKER',
  'CASHIER',
  'AUDITOR',
  'CUSTOM',
] as const
export type RoleId = (typeof ROLES)[number]

/** Platform-namespace role. Separate list so the two can never be mixed. */
export const PLATFORM_ROLES = ['SUPER_ADMIN', 'PLATFORM_SUPPORT', 'PLATFORM_FINANCE'] as const
export type PlatformRoleId = (typeof PLATFORM_ROLES)[number]

/* ------------------------------------------------------------ role metadata */

export interface RoleMeta {
  id: RoleId
  tone: string
  /** What this role is for, in plain Uzbek (avoids accounting jargon). */
  summaryKey: string
  /** True when the role may edit the permission matrix itself. */
  canManagePermissions: boolean
  /** True when the role may not be deleted or renamed. */
  isSystem: boolean
}

export const ROLE_META: Record<RoleId, RoleMeta> = {
  OWNER: { id: 'OWNER', tone: 'brand', summaryKey: 'role.owner.summary', canManagePermissions: true, isSystem: true },
  ADMIN: { id: 'ADMIN', tone: 'brand', summaryKey: 'role.admin.summary', canManagePermissions: true, isSystem: true },
  DIRECTOR: { id: 'DIRECTOR', tone: 'violet', summaryKey: 'role.director.summary', canManagePermissions: false, isSystem: true },
  CHIEF_ACCOUNTANT: { id: 'CHIEF_ACCOUNTANT', tone: 'sky', summaryKey: 'role.chiefAccountant.summary', canManagePermissions: false, isSystem: true },
  ACCOUNTANT: { id: 'ACCOUNTANT', tone: 'sky', summaryKey: 'role.accountant.summary', canManagePermissions: false, isSystem: true },
  SALES_MANAGER: { id: 'SALES_MANAGER', tone: 'gold', summaryKey: 'role.salesManager.summary', canManagePermissions: false, isSystem: true },
  SALES_EMPLOYEE: { id: 'SALES_EMPLOYEE', tone: 'gold', summaryKey: 'role.salesEmployee.summary', canManagePermissions: false, isSystem: true },
  WAREHOUSE_MANAGER: { id: 'WAREHOUSE_MANAGER', tone: 'warning', summaryKey: 'role.warehouseManager.summary', canManagePermissions: false, isSystem: true },
  WAREHOUSE_EMPLOYEE: { id: 'WAREHOUSE_EMPLOYEE', tone: 'warning', summaryKey: 'role.warehouseEmployee.summary', canManagePermissions: false, isSystem: true },
  PURCHASING_MANAGER: { id: 'PURCHASING_MANAGER', tone: 'violet', summaryKey: 'role.purchasingManager.summary', canManagePermissions: false, isSystem: true },
  HR_MANAGER: { id: 'HR_MANAGER', tone: 'danger', summaryKey: 'role.hrManager.summary', canManagePermissions: false, isSystem: true },
  PRODUCTION_MANAGER: { id: 'PRODUCTION_MANAGER', tone: 'brand', summaryKey: 'role.productionManager.summary', canManagePermissions: false, isSystem: true },
  FACTORY_WORKER: { id: 'FACTORY_WORKER', tone: 'faint', summaryKey: 'role.factoryWorker.summary', canManagePermissions: false, isSystem: true },
  CASHIER: { id: 'CASHIER', tone: 'success', summaryKey: 'role.cashier.summary', canManagePermissions: false, isSystem: true },
  AUDITOR: { id: 'AUDITOR', tone: 'muted', summaryKey: 'role.auditor.summary', canManagePermissions: false, isSystem: true },
  CUSTOM: { id: 'CUSTOM', tone: 'faint', summaryKey: 'role.custom.summary', canManagePermissions: false, isSystem: false },
}

/* ------------------------------------------------------- default permission */

const p = (m: Module, ...a: Action[]): ModulePermission[] => a.map((x) => `${m}.${x}` as ModulePermission)

/**
 * Default permission sets per role. Owners can override any single key per member
 * via `Member.permissionOverrides` — the effective set is computed by
 * `effectivePermissions()`.
 */
export const ROLE_PERMISSIONS: Record<RoleId, PermissionKey[]> = {
  /* ---------------------------------------------------------- OWNER / ADMIN */
  OWNER: ['*'] as unknown as PermissionKey[],
  ADMIN: ['*'] as unknown as PermissionKey[],

  /* --------------------------------------------------------------- DIRECTOR */
  DIRECTOR: [
    ...p('dashboard', 'view'),
    ...p('sales', 'view', 'edit', 'approve', 'export'),
    ...p('invoices', 'view', 'approve', 'export'),
    ...p('payments', 'view', 'approve', 'export'),
    ...p('products', 'view', 'export'),
    ...p('stock', 'view', 'export'),
    ...p('warehouses', 'view'),
    ...p('transfers', 'view', 'approve'),
    ...p('stockcounts', 'view', 'approve'),
    ...p('purchasing', 'view', 'approve', 'export'),
    ...p('suppliers', 'view', 'export'),
    ...p('customers', 'view', 'export'),
    ...p('crm', 'view', 'export'),
    ...p('accounting', 'view', 'export'),
    ...p('ledger', 'view', 'export'),
    ...p('journal', 'view', 'approve'),
    ...p('chartofaccounts', 'view'),
    ...p('reconciliation', 'view', 'approve'),
    ...p('taxes', 'view', 'export'),
    ...p('reports', 'view', 'export'),
    ...p('manufacturing', 'view', 'approve', 'export'),
    ...p('production', 'view', 'approve', 'export'),
    ...p('bom', 'view'),
    ...p('machines', 'view'),
    ...p('quality', 'view', 'approve'),
    ...p('hr', 'view', 'export'),
    ...p('employees', 'view', 'export'),
    ...p('payroll', 'view', 'approve', 'export'),
    ...p('attendance', 'view'),
    ...p('departments', 'view'),
    ...p('projects', 'view', 'edit', 'export'),
    ...p('fixedassets', 'view', 'export'),
    ...p('budgeting', 'view', 'edit', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('members', 'view', 'edit'),
    ...p('branches', 'view'),
    ...p('settings', 'view'),
    ...p('audit', 'view'),
    ...p('documents', 'view'),
    'finance.revenue.view',
    'finance.expense.view',
    'finance.profit.view',
    'finance.cash.view',
    'finance.bank.view',
    'finance.payroll.view',
    'finance.salary.others.view',
    'finance.salary.self.view',
    'finance.tax.view',
    'finance.cost.view',
    'finance.executive.view',
    'finance.counterparty.balances.view',
  ],

  /* ------------------------------------------------------ CHIEF ACCOUNTANT */
  CHIEF_ACCOUNTANT: [
    ...p('dashboard', 'view'),
    ...p('accounting', 'view', 'create', 'edit', 'export'),
    ...p('ledger', 'view', 'export'),
    ...p('journal', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('chartofaccounts', 'view', 'create', 'edit'),
    ...p('reconciliation', 'view', 'create', 'edit', 'export'),
    ...p('taxes', 'view', 'create', 'edit', 'export'),
    ...p('periodclose', 'view', 'create', 'approve'),
    ...p('reports', 'view', 'export'),
    ...p('invoices', 'view', 'create', 'edit', 'export'),
    ...p('payments', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('sales', 'view', 'export'),
    ...p('purchasing', 'view', 'export'),
    ...p('suppliers', 'view', 'create', 'edit', 'export'),
    ...p('customers', 'view', 'create', 'edit', 'export'),
    ...p('stock', 'view', 'export'),
    ...p('products', 'view', 'export'),
    ...p('warehouses', 'view'),
    ...p('fixedassets', 'view', 'create', 'edit', 'export'),
    ...p('payroll', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('hr', 'view'),
    ...p('employees', 'view'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create', 'delete'),
    ...p('audit', 'view', 'export'),
    ...p('settings', 'view'),
    'finance.revenue.view',
    'finance.expense.view',
    'finance.profit.view',
    'finance.cash.view',
    'finance.bank.view',
    'finance.payroll.view',
    'finance.salary.others.view',
    'finance.salary.self.view',
    'finance.tax.view',
    'finance.cost.view',
    'finance.counterparty.balances.view',
  ],

  /* ------------------------------------------------------------- ACCOUNTANT */
  // Deliberately narrower than CHIEF_ACCOUNTANT: no company profit, no payroll
  // totals, no executive reporting. All grantable by the owner.
  ACCOUNTANT: [
    ...p('dashboard', 'view'),
    ...p('accounting', 'view', 'create', 'edit'),
    ...p('ledger', 'view'),
    ...p('journal', 'view', 'create', 'edit'),
    ...p('chartofaccounts', 'view'),
    ...p('reconciliation', 'view', 'create', 'edit'),
    ...p('taxes', 'view', 'create'),
    ...p('reports', 'view', 'export'),
    ...p('invoices', 'view', 'create', 'edit', 'export'),
    ...p('payments', 'view', 'create', 'edit'),
    ...p('sales', 'view'),
    ...p('purchasing', 'view'),
    ...p('customers', 'view', 'create', 'edit'),
    ...p('suppliers', 'view', 'create', 'edit'),
    ...p('stock', 'view'),
    ...p('products', 'view'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create'),
    'finance.revenue.view',
    'finance.expense.view',
    'finance.cash.view',
    'finance.bank.view',
    'finance.tax.view',
    'finance.cost.view',
    'finance.salary.self.view',
    'finance.counterparty.balances.view',
  ],

  /* --------------------------------------------------------- SALES MANAGER */
  SALES_MANAGER: [
    ...p('dashboard', 'view'),
    ...p('sales', 'view', 'create', 'edit', 'delete', 'approve', 'export'),
    ...p('pos', 'view', 'create'),
    ...p('invoices', 'view', 'create', 'edit', 'export'),
    ...p('payments', 'view', 'create'),
    ...p('customers', 'view', 'create', 'edit', 'delete', 'export'),
    ...p('crm', 'view', 'create', 'edit', 'export'),
    ...p('products', 'view'),
    ...p('stock', 'view'),
    ...p('warehouses', 'view'),
    ...p('reports', 'view', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create'),
    ...p('members', 'view'),
    'finance.revenue.view',
    'finance.salary.self.view',
  ],

  /* ------------------------------------------------------- SALES EMPLOYEE */
  // The reference design's biggest flaw: this role could see company profit.
  // Here it cannot — not through the UI, not through the API, not through AI.
  SALES_EMPLOYEE: [
    ...p('dashboard', 'view'),
    ...p('sales', 'view', 'create'),
    ...p('pos', 'view', 'create'),
    ...p('invoices', 'view', 'create'),
    ...p('payments', 'view', 'create'),
    ...p('customers', 'view', 'create'),
    ...p('crm', 'view', 'create'),
    ...p('products', 'view'),
    ...p('stock', 'view'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    'finance.salary.self.view',
  ],

  /* ---------------------------------------------------- WAREHOUSE MANAGER */
  WAREHOUSE_MANAGER: [
    ...p('dashboard', 'view'),
    ...p('products', 'view', 'create', 'edit', 'export'),
    ...p('stock', 'view', 'create', 'edit', 'export'),
    ...p('warehouses', 'view', 'create', 'edit'),
    ...p('transfers', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('stockcounts', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('purchasing', 'view', 'create', 'edit'),
    ...p('suppliers', 'view'),
    ...p('sales', 'view'),
    ...p('reports', 'view', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create'),
    ...p('members', 'view'),
    'finance.salary.self.view',
  ],

  /* --------------------------------------------------- WAREHOUSE EMPLOYEE */
  WAREHOUSE_EMPLOYEE: [
    ...p('dashboard', 'view'),
    ...p('products', 'view'),
    ...p('stock', 'view', 'create'),
    ...p('transfers', 'view', 'create'),
    ...p('purchasing', 'view'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    'finance.salary.self.view',
  ],

  /* --------------------------------------------------- PURCHASING MANAGER */
  PURCHASING_MANAGER: [
    ...p('dashboard', 'view'),
    ...p('purchasing', 'view', 'create', 'edit', 'delete', 'approve', 'export'),
    ...p('suppliers', 'view', 'create', 'edit', 'delete', 'export'),
    ...p('invoices', 'view', 'create'),
    ...p('payments', 'view', 'create'),
    ...p('products', 'view', 'create', 'edit'),
    ...p('stock', 'view'),
    ...p('warehouses', 'view'),
    ...p('crm', 'view', 'create', 'edit'),
    ...p('reports', 'view', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create'),
    'finance.cost.view',
    'finance.salary.self.view',
  ],

  /* ----------------------------------------------------------- HR MANAGER */
  HR_MANAGER: [
    ...p('dashboard', 'view'),
    ...p('hr', 'view', 'create', 'edit', 'export'),
    ...p('employees', 'view', 'create', 'edit', 'delete', 'export'),
    ...p('attendance', 'view', 'create', 'edit', 'export'),
    ...p('leave', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('payroll', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('departments', 'view', 'create', 'edit'),
    ...p('members', 'view', 'edit'),
    ...p('reports', 'view', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create'),
    'finance.payroll.view',
    'finance.salary.others.view',
    'finance.salary.self.view',
  ],

  /* ------------------------------------------------- PRODUCTION MANAGER */
  PRODUCTION_MANAGER: [
    ...p('dashboard', 'view'),
    ...p('manufacturing', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('production', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('bom', 'view', 'create', 'edit', 'export'),
    ...p('machines', 'view', 'create', 'edit'),
    ...p('quality', 'view', 'create', 'edit', 'approve', 'export'),
    ...p('stock', 'view', 'create', 'edit'),
    ...p('products', 'view', 'create', 'edit'),
    ...p('warehouses', 'view'),
    ...p('transfers', 'view', 'create'),
    ...p('purchasing', 'view', 'create'),
    ...p('attendance', 'view', 'create'),
    ...p('employees', 'view'),
    ...p('reports', 'view', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('documents', 'view', 'create'),
    'finance.cost.view',
    'finance.salary.self.view',
  ],

  /* ------------------------------------------------------- FACTORY WORKER */
  FACTORY_WORKER: [
    ...p('dashboard', 'view'),
    ...p('production', 'view'),
    ...p('manufacturing', 'view'),
    ...p('attendance', 'view', 'create'),
    ...p('notifications', 'view'),
    'finance.salary.self.view',
  ],

  /* ---------------------------------------------------------------- CASHIER */
  CASHIER: [
    ...p('dashboard', 'view'),
    ...p('sales', 'view', 'create'),
    ...p('pos', 'view', 'create'),
    ...p('payments', 'view', 'create'),
    ...p('invoices', 'view', 'create'),
    ...p('products', 'view'),
    ...p('stock', 'view'),
    ...p('customers', 'view', 'create'),
    ...p('notifications', 'view'),
    'finance.cash.view',
    'finance.salary.self.view',
  ],

  /* ---------------------------------------------------------------- AUDITOR */
  // Read + export across the board, but zero write access anywhere.
  AUDITOR: [
    ...p('dashboard', 'view'),
    ...p('sales', 'view', 'export'),
    ...p('invoices', 'view', 'export'),
    ...p('payments', 'view', 'export'),
    ...p('products', 'view', 'export'),
    ...p('stock', 'view', 'export'),
    ...p('warehouses', 'view'),
    ...p('transfers', 'view', 'export'),
    ...p('stockcounts', 'view', 'export'),
    ...p('purchasing', 'view', 'export'),
    ...p('suppliers', 'view', 'export'),
    ...p('customers', 'view', 'export'),
    ...p('crm', 'view', 'export'),
    ...p('accounting', 'view', 'export'),
    ...p('ledger', 'view', 'export'),
    ...p('journal', 'view', 'export'),
    ...p('chartofaccounts', 'view', 'export'),
    ...p('reconciliation', 'view', 'export'),
    ...p('taxes', 'view', 'export'),
    ...p('periodclose', 'view'),
    ...p('reports', 'view', 'export'),
    ...p('manufacturing', 'view', 'export'),
    ...p('production', 'view', 'export'),
    ...p('bom', 'view', 'export'),
    ...p('machines', 'view'),
    ...p('quality', 'view', 'export'),
    ...p('hr', 'view', 'export'),
    ...p('employees', 'view', 'export'),
    ...p('attendance', 'view', 'export'),
    ...p('leave', 'view', 'export'),
    ...p('payroll', 'view', 'export'),
    ...p('departments', 'view'),
    ...p('projects', 'view', 'export'),
    ...p('fixedassets', 'view', 'export'),
    ...p('budgeting', 'view', 'export'),
    ...p('ai', 'view'),
    ...p('notifications', 'view'),
    ...p('settings', 'view'),
    ...p('members', 'view'),
    ...p('branches', 'view'),
    ...p('billing', 'view'),
    ...p('audit', 'view', 'export'),
    ...p('integrations', 'view'),
    ...p('documents', 'view'),
    'finance.revenue.view',
    'finance.expense.view',
    'finance.profit.view',
    'finance.cash.view',
    'finance.bank.view',
    'finance.payroll.view',
    'finance.salary.others.view',
    'finance.salary.self.view',
    'finance.tax.view',
    'finance.cost.view',
    'finance.executive.view',
    'finance.counterparty.balances.view',
  ],

  /* ----------------------------------------------------------------- CUSTOM */
  CUSTOM: ['finance.salary.self.view'],
}

/** Roles whose member list is itself restricted (only owners/admins manage them). */
export const ELEVATED_ROLES: RoleId[] = ['OWNER', 'ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT', 'AUDITOR']

/* ---------------------------------------------------------------- helpers */

const isModulePermission = (k: string): k is ModulePermission =>
  MODULES.some((m) => k.startsWith(`${m}.`))

export const isDataScope = (k: string): k is DataScope => (DATA_SCOPES as readonly string[]).includes(k)

/** Effective permission set for a member = role defaults ⊕ owner overrides. */
export function effectivePermissions(
  role: RoleId,
  overrides: Partial<Record<PermissionKey, boolean>> = {},
): Set<PermissionKey> {
  const base = ROLE_PERMISSIONS[role] ?? []
  const set = new Set<PermissionKey>()
  const wildcard = (base as string[]).includes('*')

  if (wildcard) {
    for (const m of MODULES) for (const a of ACTIONS) set.add(`${m}.${a}` as ModulePermission)
    for (const s of DATA_SCOPES) set.add(s)
  } else {
    for (const k of base) set.add(k)
  }
  for (const [k, v] of Object.entries(overrides)) {
    const key = k as PermissionKey
    if (v) set.add(key)
    else set.delete(key)
    // An override can never escalate a non-privileged role to wildcard.
  }
  return set
}

export interface Principal {
  memberId: string | null
  userId: string
  tenantId: string | null
  role: RoleId | null
  isSuperAdmin: boolean
  permissions: Set<PermissionKey>
  dataScope: 'ALL' | 'BRANCH' | 'WAREHOUSE' | 'SELF'
  branchIds: string[]
  warehouseIds: string[]
}

/**
 * The ONLY function the rest of the app should use for authorisation.
 * Super admins get platform rights but NOT company rights — see
 * `adminCannotSeeTenantFinance` test expectations: /admin never grants
 * `finance.*` inside a customer workspace.
 */
export function can(principal: Principal | null, key: PermissionKey): boolean {
  if (!principal) return false
  if (principal.isSuperAdmin) {
    // Platform operators may read operational metadata, never private financials.
    if (isDataScope(key)) return false
    return false
  }
  return principal.permissions.has(key)
}

/** Convenience: does this principal hold *any* of the given keys? */
export function canAny(principal: Principal | null, keys: PermissionKey[]): boolean {
  return keys.some((k) => can(principal, k))
}

export function canAll(principal: Principal | null, keys: PermissionKey[]): boolean {
  return keys.every((k) => can(principal, k))
}

/** All finance scopes the principal is missing — surfaced to users & to the AI. */
export function deniedScopes(principal: Principal | null): DataScope[] {
  return DATA_SCOPES.filter((s) => !can(principal, s))
}

export function grantedScopes(principal: Principal | null): DataScope[] {
  return DATA_SCOPES.filter((s) => can(principal, s))
}

export function permissionModule(key: PermissionKey): Module | 'finance' {
  if (isDataScope(key)) return 'finance'
  const idx = key.lastIndexOf('.')
  return (isModulePermission(key) ? key.slice(0, idx) : 'finance') as Module | 'finance'
}

/** Human-facing label for a permission key (used by the matrix UI). */
export function permissionLabelParts(key: PermissionKey): { module: Module | 'finance'; action: Action | 'view' } {
  if (isDataScope(key)) return { module: 'finance', action: 'view' }
  const idx = key.lastIndexOf('.')
  return { module: key.slice(0, idx) as Module, action: key.slice(idx + 1) as Action }
}

export const ROLE_ORDER: RoleId[] = [
  'OWNER',
  'ADMIN',
  'DIRECTOR',
  'CHIEF_ACCOUNTANT',
  'ACCOUNTANT',
  'SALES_MANAGER',
  'SALES_EMPLOYEE',
  'PURCHASING_MANAGER',
  'WAREHOUSE_MANAGER',
  'WAREHOUSE_EMPLOYEE',
  'PRODUCTION_MANAGER',
  'FACTORY_WORKER',
  'HR_MANAGER',
  'CASHIER',
  'AUDITOR',
  'CUSTOM',
]
