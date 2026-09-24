import type { LucideIcon } from 'lucide-react'
import { Activity, BadgeDollarSign, BarChart3, Bell, BookOpen, Boxes, Building2, ClipboardCheck, ClipboardList, Cog, CreditCard, Factory, FileSpreadsheet, FileText, Gauge, HandCoins, Landmark, Layers, PackageCheck, PackageSearch, Receipt, ScrollText, Settings, ShieldCheck, ShoppingCart, Sparkles, Store, Truck, UserCog, Users, Wallet, Wrench } from 'lucide-react'
import type { PermissionKey } from '@/core/rbac/permissions'
import type { FeatureId } from '@/core/billing/plans'
import type { DictKey } from '@/core/i18n/uz'

export interface NavItem {
  to: string
  labelKey: DictKey
  icon: LucideIcon
  perm: PermissionKey | PermissionKey[]
  feature?: FeatureId | FeatureId[]
  end?: boolean
}
export interface NavSection {
  labelKey: DictKey | null
  items: NavItem[]
}

/**
 * Navigation is derived from permissions AND plan features. An item that fails
 * the permission check disappears; one that fails only the plan check is shown
 * with a lock and routes to the upgrade explanation — progressive disclosure.
 */
export const WORKSPACE_NAV: NavSection[] = [
  {
    labelKey: null,
    items: [
      { to: '/app', labelKey: 'nav.overview', icon: Gauge, perm: 'dashboard.view', end: true },
      { to: '/app/notifications', labelKey: 'nav.notifications', icon: Bell, perm: 'notifications.view' },
      { to: '/app/ai', labelKey: 'nav.ai', icon: Sparkles, perm: 'ai.view' },
    ],
  },
  {
    labelKey: 'nav.section.sell',
    items: [
      { to: '/app/sales/new', labelKey: 'nav.pos', icon: Store, perm: ['pos.create', 'sales.create'] },
      { to: '/app/sales', labelKey: 'nav.sales', icon: ShoppingCart, perm: 'sales.view', end: true },
      { to: '/app/invoices', labelKey: 'nav.invoices', icon: FileText, perm: 'invoices.view', feature: 'invoices' },
      { to: '/app/payments', labelKey: 'nav.payments', icon: HandCoins, perm: 'payments.view' },
      { to: '/app/customers', labelKey: 'nav.customers', icon: Users, perm: 'customers.view' },
    ],
  },
  {
    labelKey: 'nav.section.stock',
    items: [
      { to: '/app/inventory/products', labelKey: 'nav.products', icon: Boxes, perm: 'products.view' },
      { to: '/app/inventory/stock', labelKey: 'nav.stock', icon: PackageSearch, perm: 'stock.view' },
      { to: '/app/inventory/transfers', labelKey: 'nav.transfers', icon: Truck, perm: 'transfers.view', feature: 'accounting.full' },
      { to: '/app/inventory/counts', labelKey: 'nav.stockcounts', icon: ClipboardCheck, perm: 'stockcounts.view', feature: 'accounting.full' },
      { to: '/app/purchasing', labelKey: 'nav.purchasing', icon: PackageCheck, perm: 'purchasing.view', feature: 'purchasing.basic' },
      { to: '/app/suppliers', labelKey: 'nav.suppliers', icon: Building2, perm: 'suppliers.view', feature: 'purchasing.basic' },
    ],
  },
  {
    labelKey: 'nav.section.finance',
    items: [
      { to: '/app/accounting/journal', labelKey: 'nav.accounting', icon: BookOpen, perm: 'accounting.view', feature: 'accounting.full' },
      { to: '/app/accounting/reconciliation', labelKey: 'nav.reconciliation', icon: Landmark, perm: 'reconciliation.view', feature: 'bank.reconciliation' },
      { to: '/app/accounting/taxes', labelKey: 'nav.taxes', icon: Receipt, perm: 'taxes.view', feature: 'accounting.full' },
      { to: '/app/reports', labelKey: 'nav.reports', icon: BarChart3, perm: 'reports.view' },
    ],
  },
  {
    labelKey: 'nav.section.production',
    items: [
      { to: '/app/manufacturing/orders', labelKey: 'nav.production', icon: Factory, perm: 'production.view', feature: 'manufacturing' },
      { to: '/app/manufacturing/bom', labelKey: 'nav.bom', icon: Layers, perm: 'bom.view', feature: 'bom' },
      { to: '/app/manufacturing/machines', labelKey: 'nav.machines', icon: Wrench, perm: 'machines.view', feature: 'machines' },
      { to: '/app/manufacturing/quality', labelKey: 'nav.quality', icon: ClipboardList, perm: 'quality.view', feature: 'manufacturing' },
    ],
  },
  {
    labelKey: 'nav.section.people',
    items: [
      { to: '/app/hr/employees', labelKey: 'nav.employees', icon: Users, perm: ['employees.view', 'attendance.create'], feature: 'hr' },
      { to: '/app/hr/attendance', labelKey: 'nav.attendance', icon: Activity, perm: 'attendance.view', feature: 'hr' },
      { to: '/app/hr/leave', labelKey: 'nav.leave', icon: FileSpreadsheet, perm: 'leave.view', feature: 'hr' },
      { to: '/app/hr/payroll', labelKey: 'nav.payroll', icon: Wallet, perm: ['payroll.view', 'finance.salary.self.view'], feature: 'payroll' },
    ],
  },
  {
    labelKey: 'nav.section.manage',
    items: [
      { to: '/app/settings/members', labelKey: 'nav.members', icon: UserCog, perm: 'members.view' },
      { to: '/app/settings/permissions', labelKey: 'nav.permissions', icon: ShieldCheck, perm: 'roles.view' },
      { to: '/app/settings/billing', labelKey: 'nav.billing', icon: CreditCard, perm: 'billing.view' },
      { to: '/app/settings/audit', labelKey: 'nav.audit', icon: ScrollText, perm: 'audit.view', feature: 'audit.history' },
      { to: '/app/settings', labelKey: 'nav.settings', icon: Settings, perm: 'settings.view', end: true },
    ],
  },
]

export const ADMIN_NAV: { to: string; labelKey: DictKey; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', labelKey: 'adm.nav.overview', icon: Gauge, end: true },
  { to: '/admin/companies', labelKey: 'adm.nav.companies', icon: Building2 },
  { to: '/admin/users', labelKey: 'adm.nav.users', icon: Users },
  { to: '/admin/subscriptions', labelKey: 'adm.nav.subscriptions', icon: BadgeDollarSign },
  { to: '/admin/plans', labelKey: 'adm.nav.plans', icon: Layers },
  { to: '/admin/payments', labelKey: 'adm.nav.payments', icon: CreditCard },
  { to: '/admin/trials', labelKey: 'adm.nav.trials', icon: ClipboardCheck },
  { to: '/admin/ai', labelKey: 'adm.nav.ai', icon: Sparkles },
  { to: '/admin/logs', labelKey: 'adm.nav.logs', icon: ScrollText },
  { to: '/admin/support', labelKey: 'adm.nav.support', icon: Bell },
  { to: '/admin/settings', labelKey: 'adm.nav.settings', icon: Cog },
]
