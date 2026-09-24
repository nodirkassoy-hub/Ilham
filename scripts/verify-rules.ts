/**
 * Business-rule verification harness. Runs the real store in Node and asserts
 * the five non-negotiable product rules:
 *   1. employees cannot see finance without permission
 *   2. AI obeys the same permission system
 *   3. tenant data is isolated
 *   4. no fake integrations (payments are marked SIMULATED / providers not connected)
 *   5. plan limits are enforced by logic, not by hidden buttons
 */
import { useAppStore, ServiceError, selectPrincipal, selectTenant, entitlementsOf } from '@/store/appStore'
import { answer } from '@/core/services/aiCfo'
import { can } from '@/core/rbac/permissions'
import { Ledger, balanceSheet } from '@/core/services/accounting'
import { DEMO_TENANT_ID, DEMO_PASSWORD } from '@/data/seed'

// minimal browser shims for zustand/persist
const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 }
;(globalThis as any).document = { documentElement: { lang: 'uz', classList: { toggle() {} } } }

let pass = 0
let fail = 0
const ok = (name: string, cond: boolean, extra = '') => {
  if (cond) pass++
  else fail++
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`)
}
const expectThrow = (name: string, fn: () => unknown, code?: string) => {
  try {
    fn()
    ok(name, false, 'did not throw')
  } catch (e) {
    ok(name, e instanceof ServiceError && (!code || e.code === code), e instanceof ServiceError ? e.code : String(e))
  }
}

const S = useAppStore
S.getState().boot()

/* ---------- 1. RBAC on the store */
console.log('\n# RBAC')
const r1 = S.getState().login('sales@balans.uz', DEMO_PASSWORD)
ok('sales employee logs in', r1.ok)
let p = selectPrincipal(S.getState())!
ok('sales employee lacks finance.profit.view', !can(p, 'finance.profit.view'))
ok('sales employee lacks finance.bank.view', !can(p, 'finance.bank.view'))
ok('sales employee HAS sales.create', can(p, 'sales.create'))
ok('sales employee lacks payroll.view', !can(p, 'payroll.view'))
expectThrow('sales employee cannot post journal entry', () => S.getState().postManualEntry({ date: '2026-09-24', memo: 'x', lines: [] }), 'err.permission')
expectThrow('sales employee cannot invite members', () => S.getState().inviteMember({ fullName: 'X', email: 'x@x.uz', phone: '', role: 'ADMIN', dataScope: 'ALL' }), 'err.permission')
const deniedRow = selectTenant(S.getState())!.audit.find((a) => a.action === 'DENIED_ACCESS' && a.permissionRequired === 'journal.create')
ok('denied attempt is written to audit log', !!deniedRow)

/* ---------- 2. AI obeys permissions */
console.log('\n# AI CFO')
let t = selectTenant(S.getState())!
let a = answer(t, p, entitlementsOf(t), 'Bugungi kompaniya foydasi qancha?')
ok('AI refuses profit for sales employee', a.content.includes("umumiy foyda ko'rsatkichi mavjud emas") && a.deniedScopes.includes('finance.profit.view'))
ok('AI does not leak any number in refusal', !/\d{3}/.test(a.content.split('\n')[0]))
a = answer(t, p, entitlementsOf(t), 'Mening bugungi sotuvlarim')
ok('AI answers own-sales for sales employee', a.claimType === 'FACT' && a.deniedScopes.length === 0)
S.getState().logout()
S.getState().login('chief@balans.uz', DEMO_PASSWORD)
p = selectPrincipal(S.getState())!
t = selectTenant(S.getState())!
a = answer(t, p, entitlementsOf(t), 'Bu oy xarajatlar qancha?')
ok('AI answers expenses for chief accountant with FACT label', a.content.includes('FAKT') && a.permissionsUsed.includes('finance.expense.view'))
a = answer(t, p, entitlementsOf(t), 'Bu oy foyda nima uchun kamaydi?')
ok('AI profit analysis for chief accountant includes FACT+TAVSIYA', a.content.includes('FAKT') && a.content.includes('TAVSIYA'))
S.getState().logout()
S.getState().login('owner@nursavdo.uz', DEMO_PASSWORD)
p = selectPrincipal(S.getState())!
t = selectTenant(S.getState())!
a = answer(t, p, entitlementsOf(t), 'foyda')
ok('AI says insufficient data for company with no sales', a.content.includes("ma'lumot yetarli emas") && a.claimType === null)
S.getState().logout()

/* ---------- 3. Sale → stock → invoice → journal, consistency */
console.log('\n# Sale workflow')
S.getState().login('sales@balans.uz', DEMO_PASSWORD)
t = selectTenant(S.getState())!
const before = { sales: t.sales.length, je: t.journal.length, inv: t.invoices.length }
const stk = t.stock.filter((s) => s.warehouseId === 'wh_fg' && s.onHand - s.reserved >= 5).sort((a, b) => b.onHand - a.onHand)[0]!
const prod = t.products.find((x) => x.id === stk.productId)!
const onHandBefore = stk.onHand
const cust = t.counterparties.find((c) => c.id === 'c_artel')!
const sale = S.getState().createSale({ lines: [{ productId: prod.id, qty: 2, warehouseId: 'wh_fg' }], customerId: cust.id, paymentMethod: 'CREDIT', paidAmount: 0 })
t = selectTenant(S.getState())!
ok('sale created with number', /^S-\d{4}-\d{5}$/.test(sale.number))
ok('stock reduced by 2', t.stock.find((s) => s.id === stk.id)!.onHand === onHandBefore - 2, `${onHandBefore} → ${t.stock.find((s) => s.id === stk.id)!.onHand}`)
ok('invoice created for credit sale', t.invoices.length === before.inv + 1 && t.invoices[0].saleId === sale.id)
const je = t.journal.find((e) => e.sourceId === sale.id)!
ok('journal entry posted and balanced', !!je && je.totalDebit === je.totalCredit && je.lines.length === 6 - 1, `${je?.lines.length} lines`)
ok('journal debits receivables for credit sale', je.lines.some((l) => l.accountId.endsWith('_4010') && l.debit === sale.total))
const bs = balanceSheet(new Ledger(t.accounts), t.journal)
ok('balance sheet still balanced after sale', bs.balanced)
expectThrow('cannot sell more than stock', () => S.getState().createSale({ lines: [{ productId: prod.id, qty: 99999, warehouseId: 'wh_fg' }], customerId: null, paymentMethod: 'CASH', paidAmount: 0 }), 'err.stock')
S.getState().logout()

/* ---------- 4. Tenant isolation */
console.log('\n# Tenant isolation')
S.getState().login('owner@samteks.uz', DEMO_PASSWORD)
p = selectPrincipal(S.getState())!
ok('samteks owner principal bound to t_samteks', p.tenantId === 't_samteks')
expectThrow('cannot switch into a tenant without membership', () => S.getState().selectTenant(DEMO_TENANT_ID), 'err.tenant')
t = selectTenant(S.getState())!
ok('samteks sees only its own products', t.products.every((x) => x.tenantId === 't_samteks') && !t.products.some((x) => x.sku === 'FG-101'))
ok('samteks owner cannot see BALANS audit', !t.audit.some((x) => x.tenantId === DEMO_TENANT_ID))
S.getState().logout()

/* ---------- 5. Plan limits & workspace mode */
console.log('\n# Plan limits')
S.getState().login('owner@nursavdo.uz', DEMO_PASSWORD)
t = selectTenant(S.getState())!
const ent = entitlementsOf(t)
ok('expired trial → READ_ONLY mode', ent.mode === 'READ_ONLY' && !ent.canWrite)
expectThrow('read-only workspace refuses writes', () => S.getState().createSale({ lines: [{ productId: t.products[0].id, qty: 1, warehouseId: t.warehouses[0].id }], customerId: null, paymentMethod: 'CASH', paidAmount: 0 }), 'err.readonly')
ok('data preserved after expiry', t.products.length > 0 && t.journal.length > 0)
S.getState().changePlan('FREE', 'MONTHLY')
t = selectTenant(S.getState())!
ok('choosing FREE reactivates workspace', entitlementsOf(t).canWrite && t.subscription.status === 'ACTIVE')
expectThrow('FREE plan: 3rd user refused by limit', () => { S.getState().inviteMember({ fullName: 'A', email: 'a@n.uz', phone: '', role: 'SALES_EMPLOYEE', dataScope: 'SELF' }); S.getState().inviteMember({ fullName: 'B', email: 'b@n.uz', phone: '', role: 'SALES_EMPLOYEE', dataScope: 'SELF' }) }, 'err.limit.users')
expectThrow('FREE plan: 2nd warehouse refused', () => S.getState().createWarehouse({ name: 'W2', code: 'W2', branchId: t.branches[0].id, type: 'MAIN', address: '' }), 'err.limit.warehouses')
expectThrow('FREE plan: manual journal blocked (feature)', () => S.getState().postManualEntry({ date: '2026-09-24', memo: 'x', lines: [{ accountId: t.accounts[0].id, debit: 1, credit: 0 }, { accountId: t.accounts[1].id, debit: 0, credit: 1 }] }), 'access.plan.body')
const r = S.getState().simulateCheckout('PREMIUM', 'ANNUAL', 'PAYME')
t = selectTenant(S.getState())!
ok('checkout marks payment attempt SIMULATED, provider not connected', t.paymentAttempts[0].status === 'SIMULATED' && t.paymentAttempts[0].providerConnected === false)
ok('subscription ACTIVE on PREMIUM after checkout', t.subscription.status === 'ACTIVE' && t.subscription.planId === 'PREMIUM' && !!r.invoiceNumber)
ok('annual price = 10 × monthly (2 months free)', t.subscriptionInvoices[0].amount === 2_990_000)
S.getState().logout()

/* ---------- 6. Super admin separation */
console.log('\n# Super admin')
const sa = S.getState().login('admin@balans.uz', DEMO_PASSWORD)
ok('super admin login has no tenant', sa.ok && 'superAdmin' in sa && sa.superAdmin && S.getState().session!.tenantId === null)
p = selectPrincipal(S.getState())!
ok('super admin principal cannot read tenant finance scopes', !can(p, 'finance.profit.view') && !can(p, 'sales.view'))
S.getState().adminSetCompanyStatus('t_samteks', 'SUSPENDED')
ok('admin suspend locks workspace', entitlementsOf(S.getState().tenants.t_samteks).mode === 'READ_ONLY')
S.getState().adminExtendTrial('t_samteks', 14)
ok('admin extend trial → TRIAL with trialEnd in future', S.getState().tenants.t_samteks.subscription.status === 'TRIAL' && new Date(S.getState().tenants.t_samteks.subscription.trialEnd!) > new Date())
expectThrow('admin cannot delete demo tenant', () => S.getState().adminDeleteCompany(DEMO_TENANT_ID), 'err.permission')
S.getState().logout()
expectThrow('non-admin cannot call admin actions', () => { S.getState().login('owner@balans.uz', DEMO_PASSWORD); S.getState().adminSetCompanyStatus('t_samteks', 'ACTIVE') }, 'err.permission')

/* ---------- 7. Owner permission override affects AI immediately */
console.log('\n# Permission override → AI')
t = selectTenant(S.getState())!
const aziz = t.members.find((m) => m.email === 'sales@balans.uz')!
S.getState().setPermissionOverride(aziz.id, 'finance.revenue.view', true)
S.getState().logout()
S.getState().login('sales@balans.uz', DEMO_PASSWORD)
p = selectPrincipal(S.getState())!
t = selectTenant(S.getState())!
a = answer(t, p, entitlementsOf(t), 'daromad')
ok('after owner grants revenue scope, AI answers revenue', a.permissionsUsed.includes('finance.revenue.view') && a.content.includes('FAKT'))
a = answer(t, p, entitlementsOf(t), 'foyda')
ok('…but still refuses profit', a.deniedScopes.includes('finance.profit.view'))
ok('override is logged as PERMISSION_CHANGE in audit', t.audit.some((x) => x.action === 'PERMISSION_CHANGE' && x.summary.includes('finance.revenue.view')))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
