/**
 * Accounting engine.
 *
 * Every business document (sale, purchase, payment, payroll, production) becomes a
 * double-entry JournalEntry through the `post*` functions below. Every report
 * (P&L, balance sheet, trial balance, cash flow, aging) is DERIVED from those
 * entries. There is no second copy of "revenue" anywhere — which is what keeps
 * demo and live numbers internally consistent.
 */
import type {
  Account,
  Invoice,
  JournalEntry,
  JournalLine,
  Payment,
  PayrollRun,
  ProductionOrder,
  Purchase,
  Sale,
} from '../domain/entities'
import type { AccountSubtype, AccountType, JournalSource } from '../domain/enums'
import { sum, uid } from '../utils/format'

/* ------------------------------------------------------------ chart of accounts */

type SysKey = NonNullable<Account['systemKey']>

interface CoaSeed {
  code: string
  name: string
  type: AccountType
  subtype: AccountSubtype
  systemKey?: SysKey
}

/** Uzbek national chart (NSBU 21) — compact but structurally faithful. */
export const COA_TEMPLATE: CoaSeed[] = [
  // Assets
  { code: '0100', name: 'Asosiy vositalar', type: 'ASSET', subtype: 'FIXED_ASSET', systemKey: 'FIXED_ASSETS' },
  { code: '0200', name: 'Asosiy vositalar eskirishi', type: 'ASSET', subtype: 'FIXED_ASSET' },
  { code: '1000', name: 'Xomashyo va materiallar', type: 'ASSET', subtype: 'INVENTORY' },
  { code: '2010', name: 'Asosiy ishlab chiqarish (WIP)', type: 'ASSET', subtype: 'INVENTORY', systemKey: 'WIP' },
  { code: '2800', name: 'Tayyor mahsulot', type: 'ASSET', subtype: 'INVENTORY' },
  { code: '2900', name: 'Tovarlar', type: 'ASSET', subtype: 'INVENTORY', systemKey: 'INVENTORY' },
  { code: '4010', name: 'Xaridorlardan olinadigan schyotlar', type: 'ASSET', subtype: 'RECEIVABLE', systemKey: 'RECEIVABLES' },
  { code: '4410', name: "QQS bo'yicha bo'nak (kirish QQS)", type: 'ASSET', subtype: 'CURRENT_ASSET', systemKey: 'VAT_INPUT' },
  { code: '5010', name: 'Kassa (milliy valyuta)', type: 'ASSET', subtype: 'CASH', systemKey: 'CASH' },
  { code: '5110', name: 'Hisob-kitob schyoti (asosiy bank)', type: 'ASSET', subtype: 'BANK', systemKey: 'BANK_MAIN' },
  { code: '5210', name: 'Valyuta schyoti', type: 'ASSET', subtype: 'BANK' },
  // Liabilities
  { code: '6010', name: "Ta'minotchilarga to'lanadigan schyotlar", type: 'LIABILITY', subtype: 'PAYABLE', systemKey: 'PAYABLES' },
  { code: '6410', name: "Byudjetga to'lovlar bo'yicha qarz (QQS)", type: 'LIABILITY', subtype: 'TAX_PAYABLE', systemKey: 'VAT_PAYABLE' },
  { code: '6411', name: 'Chiqish QQS', type: 'LIABILITY', subtype: 'TAX_PAYABLE', systemKey: 'VAT_OUTPUT' },
  { code: '6420', name: "Foyda solig'i bo'yicha qarz", type: 'LIABILITY', subtype: 'TAX_PAYABLE' },
  { code: '6520', name: "Ijtimoiy sug'urta bo'yicha qarz", type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },
  { code: '6710', name: "Mehnat haqi bo'yicha qarz", type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', systemKey: 'PAYROLL_PAYABLE' },
  { code: '6810', name: 'Qisqa muddatli kreditlar', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },
  { code: '7810', name: 'Uzoq muddatli kreditlar', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY' },
  // Equity
  { code: '8330', name: 'Ustav kapitali', type: 'EQUITY', subtype: 'EQUITY', systemKey: 'EQUITY' },
  { code: '8710', name: 'Taqsimlanmagan foyda', type: 'EQUITY', subtype: 'RETAINED_EARNINGS', systemKey: 'RETAINED_EARNINGS' },
  // Revenue
  { code: '9010', name: 'Tovarlarni sotishdan daromad', type: 'REVENUE', subtype: 'OPERATING_REVENUE', systemKey: 'REVENUE_SALES' },
  { code: '9030', name: 'Xizmatlardan daromad', type: 'REVENUE', subtype: 'OPERATING_REVENUE' },
  { code: '9390', name: 'Boshqa operatsion daromadlar', type: 'OTHER_INCOME', subtype: 'OTHER_REVENUE' },
  // COGS
  { code: '9110', name: 'Sotilgan tovarlar tannarxi', type: 'COGS', subtype: 'COGS', systemKey: 'COGS' },
  // Expenses
  { code: '9410', name: 'Sotish xarajatlari (marketing)', type: 'EXPENSE', subtype: 'OPEX', systemKey: 'MARKETING' },
  { code: '9420', name: "Ma'muriy xarajatlar — ijara", type: 'EXPENSE', subtype: 'OPEX', systemKey: 'RENT' },
  { code: '9421', name: "Ma'muriy xarajatlar — kommunal", type: 'EXPENSE', subtype: 'OPEX', systemKey: 'UTILITIES' },
  { code: '9422', name: 'Logistika va transport', type: 'EXPENSE', subtype: 'OPEX', systemKey: 'LOGISTICS' },
  { code: '9430', name: 'Mehnat haqi xarajatlari', type: 'EXPENSE', subtype: 'PAYROLL_EXPENSE', systemKey: 'PAYROLL_EXPENSE' },
  { code: '9440', name: 'Ishlab chiqarish umumiy xarajatlari', type: 'EXPENSE', subtype: 'OPEX', systemKey: 'PRODUCTION_OVERHEAD' },
  { code: '9450', name: 'Amortizatsiya', type: 'EXPENSE', subtype: 'DEPRECIATION', systemKey: 'DEPRECIATION' },
  { code: '9810', name: "Foyda solig'i xarajati", type: 'EXPENSE', subtype: 'TAX_EXPENSE', systemKey: 'INCOME_TAX' },
  { code: '9820', name: "Aylanma solig'i", type: 'EXPENSE', subtype: 'TAX_EXPENSE', systemKey: 'TURNOVER_TAX' },
]

export function buildChartOfAccounts(tenantId: string, now: string): Account[] {
  return COA_TEMPLATE.map((c) => ({
    id: `acc_${tenantId}_${c.code}`,
    tenantId,
    code: c.code,
    name: c.name,
    type: c.type,
    subtype: c.subtype,
    parentId: null,
    currency: 'UZS',
    isActive: true,
    isSystem: !!c.systemKey,
    systemKey: c.systemKey ?? null,
    createdAt: now,
    updatedAt: now,
  }))
}

export class Ledger {
  private byKey = new Map<SysKey, Account>()
  private byId = new Map<string, Account>()
  constructor(public accounts: Account[]) {
    for (const a of accounts) {
      this.byId.set(a.id, a)
      if (a.systemKey) this.byKey.set(a.systemKey, a)
    }
  }
  sys(key: SysKey): Account {
    const a = this.byKey.get(key)
    if (!a) throw new Error(`System account missing: ${key}`)
    return a
  }
  get(id: string): Account | undefined {
    return this.byId.get(id)
  }
}

/* ------------------------------------------------------------------- posting */

const line = (accountId: string, debit: number, credit: number, memo: string, dims: Partial<JournalLine> = {}): JournalLine => ({
  id: uid('jl'),
  accountId,
  debit: Math.round(debit),
  credit: Math.round(credit),
  memo,
  ...dims,
})

interface PostCtx {
  tenantId: string
  periodId: string
  memberId: string
  number: string
  now: string
}

function assemble(ctx: PostCtx, date: string, source: JournalSource, sourceId: string | null, memo: string, lines: JournalLine[]): JournalEntry {
  const clean = lines.filter((l) => l.debit !== 0 || l.credit !== 0)
  const totalDebit = sum(clean, (l) => l.debit)
  const totalCredit = sum(clean, (l) => l.credit)
  if (Math.abs(totalDebit - totalCredit) > 1) {
    throw new Error(`Unbalanced entry ${memo}: D ${totalDebit} ≠ C ${totalCredit}`)
  }
  return {
    id: uid('je'),
    tenantId: ctx.tenantId,
    number: ctx.number,
    date,
    periodId: ctx.periodId,
    source,
    sourceId,
    memo,
    lines: clean,
    totalDebit,
    totalCredit,
    status: 'POSTED',
    createdByMemberId: ctx.memberId,
    approvedByMemberId: null,
    createdAt: ctx.now,
    updatedAt: ctx.now,
  }
}

/**
 * Sale posting:
 *   Dr Cash/Bank/Receivable   total
 *     Cr Revenue                net of VAT
 *     Cr VAT output             vat
 *   Dr COGS                    cogs
 *     Cr Inventory               cogs
 */
export function postSale(ledger: Ledger, ctx: PostCtx, sale: Sale): JournalEntry {
  const net = sale.total - sale.vatAmount
  const cashPart = Math.min(sale.paidAmount, sale.total)
  const creditPart = sale.total - cashPart
  const debitAcc =
    sale.paymentMethod === 'CASH' ? ledger.sys('CASH') : ledger.sys('BANK_MAIN')
  const dims = { counterpartyId: sale.customerId, warehouseId: sale.warehouseId, branchId: sale.branchId }
  const lines: JournalLine[] = [
    line(debitAcc.id, cashPart, 0, `Savdo ${sale.number} — to'lov`, dims),
    line(ledger.sys('RECEIVABLES').id, creditPart, 0, `Savdo ${sale.number} — debitorlik`, dims),
    line(ledger.sys('REVENUE_SALES').id, 0, net, `Savdo ${sale.number} — daromad`, dims),
    line(ledger.sys('VAT_OUTPUT').id, 0, sale.vatAmount, `Savdo ${sale.number} — QQS`, dims),
    line(ledger.sys('COGS').id, sale.cogs, 0, `Savdo ${sale.number} — tannarx`, dims),
    line(ledger.sys('INVENTORY').id, 0, sale.cogs, `Savdo ${sale.number} — ombor chiqimi`, dims),
  ]
  return assemble(ctx, sale.occurredAt, 'SALES', sale.id, `Savdo ${sale.number}`, lines)
}

/**
 * Purchase receipt + bill:
 *   Dr Inventory        net
 *   Dr VAT input        vat
 *     Cr Payables          total
 */
export function postPurchase(ledger: Ledger, ctx: PostCtx, purchase: Purchase, date: string): JournalEntry {
  const dims = { counterpartyId: purchase.supplierId, warehouseId: purchase.warehouseId }
  const lines = [
    line(ledger.sys('INVENTORY').id, purchase.subtotal, 0, `Xarid ${purchase.number} — kirim`, dims),
    line(ledger.sys('VAT_INPUT').id, purchase.vatAmount, 0, `Xarid ${purchase.number} — kirish QQS`, dims),
    line(ledger.sys('PAYABLES').id, 0, purchase.total, `Xarid ${purchase.number} — kreditorlik`, dims),
  ]
  return assemble(ctx, date, 'PURCHASES', purchase.id, `Xarid ${purchase.number}`, lines)
}

/**
 * Payment received against an invoice / receivable:
 *   Dr Cash/Bank   amount
 *     Cr Receivables amount
 * Payment sent to supplier:
 *   Dr Payables    amount
 *     Cr Cash/Bank   amount
 */
export function postPayment(ledger: Ledger, ctx: PostCtx, payment: Payment): JournalEntry {
  const moneyAcc = payment.method === 'CASH' ? ledger.sys('CASH') : ledger.sys('BANK_MAIN')
  const dims = { counterpartyId: payment.counterpartyId }
  const lines =
    payment.direction === 'IN'
      ? [
          line(moneyAcc.id, payment.amount, 0, `To'lov ${payment.number} — kirim`, dims),
          line(ledger.sys('RECEIVABLES').id, 0, payment.amount, `To'lov ${payment.number} — debitorlik yopildi`, dims),
        ]
      : [
          line(ledger.sys('PAYABLES').id, payment.amount, 0, `To'lov ${payment.number} — kreditorlik yopildi`, dims),
          line(moneyAcc.id, 0, payment.amount, `To'lov ${payment.number} — chiqim`, dims),
        ]
  return assemble(ctx, payment.paidAt, 'BANK', payment.id, `To'lov ${payment.number}`, lines)
}

/** Generic operating expense paid from bank (rent, utilities, marketing…). */
export function postExpense(
  ledger: Ledger,
  ctx: PostCtx,
  date: string,
  expenseKey: SysKey,
  amount: number,
  memo: string,
  fromCash = false,
  dims: Partial<JournalLine> = {},
): JournalEntry {
  const moneyAcc = fromCash ? ledger.sys('CASH') : ledger.sys('BANK_MAIN')
  return assemble(ctx, date, 'MANUAL', null, memo, [
    line(ledger.sys(expenseKey).id, amount, 0, memo, dims),
    line(moneyAcc.id, 0, amount, memo, dims),
  ])
}

/**
 * Payroll run:
 *   Dr Payroll expense    gross
 *     Cr Payroll payable     net
 *     Cr Tax payable (PIT+social) taxes
 * Payment of payroll:
 *   Dr Payroll payable  net
 *     Cr Bank             net
 */
export function postPayroll(ledger: Ledger, ctx: PostCtx, run: PayrollRun, paid: boolean): JournalEntry[] {
  // Expense = net pay + all taxes (employee PIT withheld + employer social) so the entry balances by construction.
  const accrual = assemble(ctx, run.periodEnd, 'PAYROLL', run.id, `Ish haqi ${run.periodLabel} — hisoblash`, [
    line(ledger.sys('PAYROLL_EXPENSE').id, run.netTotal + run.taxTotal, 0, 'Ish haqi xarajati (soliqlar bilan)'),
    line(ledger.sys('PAYROLL_PAYABLE').id, 0, run.netTotal, "Xodimlarga to'lanadigan"),
    line(ledger.sys('VAT_PAYABLE').id, 0, run.taxTotal, 'Ish haqi soliqlari (budjet)'),
  ])
  if (!paid) return [accrual]
  const pay = assemble({ ...ctx, number: ctx.number + 'P' }, run.paidAt ?? run.periodEnd, 'PAYROLL', run.id, `Ish haqi ${run.periodLabel} — to'lov`, [
    line(ledger.sys('PAYROLL_PAYABLE').id, run.netTotal, 0, "Ish haqi to'landi"),
    line(ledger.sys('BANK_MAIN').id, 0, run.netTotal, "Ish haqi to'landi"),
  ])
  return [accrual, pay]
}

/**
 * Production completion: moves consumed material + conversion cost into finished goods.
 *   Dr Finished goods (inventory) actual total
 *     Cr Raw materials (inventory)  material
 *     Cr Payroll payable            labor   (accrued separately in payroll run — here overhead pool)
 *     Cr Production overhead        energy + machine + overhead
 * Simplified: material & conversion both flow through INVENTORY & PRODUCTION_OVERHEAD.
 */
/** Material issue at release: raw materials move into work-in-progress. */
export function postMaterialIssue(ledger: Ledger, ctx: PostCtx, order: ProductionOrder, date: string, value: number): JournalEntry {
  const dims = { productId: order.productId, warehouseId: order.warehouseId }
  return assemble(ctx, date, 'PRODUCTION', order.id, `Ishlab chiqarish ${order.number} — xomashyo sarfi`, [
    line(ledger.sys('WIP').id, value, 0, 'Tugallanmagan ishlab chiqarish', dims),
    line(ledger.sys('INVENTORY').id, 0, value, 'Xomashyo sarfi', dims),
  ])
}

/**
 * Completion: WIP material + conversion cost become finished goods.
 * WASTE is informational (already inside material consumed) — excluded so the
 * ledger value of finished goods equals the stock card value exactly.
 */
export function postProductionCompletion(ledger: Ledger, ctx: PostCtx, order: ProductionOrder, date: string): JournalEntry {
  const material = order.costs.find((c) => c.component === 'MATERIAL')?.actual ?? 0
  const conversion = sum(
    order.costs.filter((c) => c.component !== 'MATERIAL' && c.component !== 'WASTE'),
    (c) => c.actual,
  )
  const dims = { productId: order.productId, warehouseId: order.warehouseId }
  return assemble(ctx, date, 'PRODUCTION', order.id, `Ishlab chiqarish ${order.number} — yakun`, [
    line(ledger.sys('INVENTORY').id, material + conversion, 0, 'Tayyor mahsulot kirimi', dims),
    line(ledger.sys('WIP').id, 0, material, 'WIP dan chiqarildi', dims),
    line(ledger.sys('PRODUCTION_OVERHEAD').id, 0, conversion, 'Konversiya xarajatlari kapitallashtirildi', dims),
  ])
}

export function postOpening(ledger: Ledger, ctx: PostCtx, date: string, opening: { cash: number; bank: number; inventory: number; fixedAssets: number; equity: number; loans: number }): JournalEntry {
  const lines = [
    line(ledger.sys('CASH').id, opening.cash, 0, "Boshlang'ich qoldiq — kassa"),
    line(ledger.sys('BANK_MAIN').id, opening.bank, 0, "Boshlang'ich qoldiq — bank"),
    line(ledger.sys('INVENTORY').id, opening.inventory, 0, "Boshlang'ich qoldiq — ombor"),
    line(ledger.sys('FIXED_ASSETS').id, opening.fixedAssets, 0, "Boshlang'ich qoldiq — asosiy vositalar"),
    line(ledger.sys('EQUITY').id, 0, opening.equity, 'Ustav kapitali'),
  ]
  const loansAcc = ledger.accounts.find((a) => a.code === '7810')!
  lines.push(line(loansAcc.id, 0, opening.loans, 'Uzoq muddatli kredit'))
  return assemble(ctx, date, 'OPENING', null, "Boshlang'ich balans", lines)
}

export function postDepreciation(ledger: Ledger, ctx: PostCtx, date: string, amount: number): JournalEntry {
  const accum = ledger.accounts.find((a) => a.code === '0200')!
  return assemble(ctx, date, 'FIXED_ASSET', null, 'Oylik amortizatsiya', [
    line(ledger.sys('DEPRECIATION').id, amount, 0, 'Amortizatsiya'),
    line(accum.id, 0, amount, "To'plangan eskirish"),
  ])
}

/* ------------------------------------------------------------------- reports */

export interface AccountBalance {
  account: Account
  debit: number
  credit: number
  /** Natural-sign balance: assets/expenses positive on debit, others on credit. */
  balance: number
}

const DEBIT_NATURE: AccountType[] = ['ASSET', 'COGS', 'EXPENSE']

export function inRange(date: string, from?: string, to?: string): boolean {
  if (from && date < from) return false
  if (to && date > to + 'T23:59:59') return false
  return true
}

export function trialBalance(ledger: Ledger, entries: JournalEntry[], from?: string, to?: string): AccountBalance[] {
  const map = new Map<string, { debit: number; credit: number }>()
  for (const e of entries) {
    if (e.status !== 'POSTED' || !inRange(e.date, from, to)) continue
    for (const l of e.lines) {
      const cur = map.get(l.accountId) ?? { debit: 0, credit: 0 }
      cur.debit += l.debit
      cur.credit += l.credit
      map.set(l.accountId, cur)
    }
  }
  return ledger.accounts
    .map((account) => {
      const { debit, credit } = map.get(account.id) ?? { debit: 0, credit: 0 }
      const balance = DEBIT_NATURE.includes(account.type) ? debit - credit : credit - debit
      return { account, debit, credit, balance }
    })
    .filter((b) => b.debit !== 0 || b.credit !== 0)
    .sort((a, b) => a.account.code.localeCompare(b.account.code))
}

export interface PnL {
  revenue: number
  otherIncome: number
  cogs: number
  grossProfit: number
  grossMarginPct: number
  opex: number
  opexByAccount: { account: Account; amount: number }[]
  operatingProfit: number
  taxes: number
  netProfit: number
  netMarginPct: number
}

export function profitAndLoss(ledger: Ledger, entries: JournalEntry[], from?: string, to?: string): PnL {
  const tb = trialBalance(ledger, entries, from, to)
  const by = (t: AccountType) => tb.filter((b) => b.account.type === t)
  const revenue = sum(by('REVENUE'), (b) => b.balance)
  const otherIncome = sum(by('OTHER_INCOME'), (b) => b.balance)
  const cogs = sum(by('COGS'), (b) => b.balance)
  const expenseRows = by('EXPENSE')
  const taxes = sum(
    expenseRows.filter((b) => b.account.subtype === 'TAX_EXPENSE'),
    (b) => b.balance,
  )
  const opexRows = expenseRows.filter((b) => b.account.subtype !== 'TAX_EXPENSE')
  const opex = sum(opexRows, (b) => b.balance)
  const grossProfit = revenue - cogs
  const operatingProfit = grossProfit + otherIncome - opex
  const netProfit = operatingProfit - taxes
  return {
    revenue,
    otherIncome,
    cogs,
    grossProfit,
    grossMarginPct: revenue ? (grossProfit / revenue) * 100 : 0,
    opex,
    opexByAccount: opexRows.map((b) => ({ account: b.account, amount: b.balance })).sort((a, b) => b.amount - a.amount),
    operatingProfit,
    taxes,
    netProfit,
    netMarginPct: revenue ? (netProfit / revenue) * 100 : 0,
  }
}

export interface BalanceSheet {
  assets: { account: Account; amount: number }[]
  liabilities: { account: Account; amount: number }[]
  equity: { account: Account; amount: number }[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  currentPeriodProfit: number
  balanced: boolean
  cash: number
  bank: number
  receivables: number
  payables: number
  inventory: number
}

export function balanceSheet(ledger: Ledger, entries: JournalEntry[], asOf?: string): BalanceSheet {
  const tb = trialBalance(ledger, entries, undefined, asOf)
  const rows = (t: AccountType) => tb.filter((b) => b.account.type === t).map((b) => ({ account: b.account, amount: b.balance }))
  const assets = rows('ASSET')
  const liabilities = rows('LIABILITY')
  const equityRows = rows('EQUITY')
  const pnl = profitAndLoss(ledger, entries, undefined, asOf)
  const totalAssets = sum(assets, (r) => r.amount)
  const totalLiabilities = sum(liabilities, (r) => r.amount)
  const totalEquity = sum(equityRows, (r) => r.amount) + pnl.netProfit
  const find = (k: SysKey) => tb.find((b) => b.account.id === ledger.sys(k).id)?.balance ?? 0
  return {
    assets,
    liabilities,
    equity: equityRows,
    totalAssets,
    totalLiabilities,
    totalEquity,
    currentPeriodProfit: pnl.netProfit,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 2,
    cash: find('CASH'),
    bank: find('BANK_MAIN'),
    receivables: find('RECEIVABLES'),
    payables: find('PAYABLES'),
    inventory: tb.filter((b) => b.account.subtype === 'INVENTORY').reduce((a, b) => a + b.balance, 0),
  }
}

export interface CashFlow {
  operating: number
  investing: number
  financing: number
  net: number
  opening: number
  closing: number
  inflows: number
  outflows: number
  byMonth: { month: string; inflow: number; outflow: number; net: number }[]
}

export function cashFlow(ledger: Ledger, entries: JournalEntry[], from?: string, to?: string): CashFlow {
  const moneyIds = new Set([ledger.sys('CASH').id, ledger.sys('BANK_MAIN').id])
  let operating = 0
  let investing = 0
  let financing = 0
  let inflows = 0
  let outflows = 0
  let opening = 0
  const months = new Map<string, { inflow: number; outflow: number }>()
  for (const e of entries) {
    if (e.status !== 'POSTED') continue
    const delta = sum(
      e.lines.filter((l) => moneyIds.has(l.accountId)),
      (l) => l.debit - l.credit,
    )
    if (delta === 0) continue
    if (from && e.date < from) {
      opening += delta
      continue
    }
    if (!inRange(e.date, from, to)) continue
    const m = e.date.slice(0, 7)
    const cur = months.get(m) ?? { inflow: 0, outflow: 0 }
    if (delta > 0) {
      inflows += delta
      cur.inflow += delta
    } else {
      outflows += -delta
      cur.outflow += -delta
    }
    months.set(m, cur)
    if (e.source === 'FIXED_ASSET') investing += delta
    else if (e.source === 'OPENING') financing += delta
    else operating += delta
  }
  const net = operating + investing + financing
  return {
    operating,
    investing,
    financing,
    net,
    opening,
    closing: opening + net,
    inflows,
    outflows,
    byMonth: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v, net: v.inflow - v.outflow })),
  }
}

export interface AgingBucket {
  label: 'current' | 'd30' | 'd60' | 'd90' | 'over'
  amount: number
  count: number
}

export function aging(invoices: Invoice[], direction: 'OUT' | 'IN', asOf: Date = new Date()): { buckets: AgingBucket[]; total: number; overdue: number } {
  const buckets: AgingBucket[] = [
    { label: 'current', amount: 0, count: 0 },
    { label: 'd30', amount: 0, count: 0 },
    { label: 'd60', amount: 0, count: 0 },
    { label: 'd90', amount: 0, count: 0 },
    { label: 'over', amount: 0, count: 0 },
  ]
  let total = 0
  let overdue = 0
  for (const inv of invoices) {
    if (inv.direction !== direction || inv.status === 'PAID' || inv.status === 'VOID' || inv.status === 'DRAFT') continue
    const open = inv.total - inv.paidAmount
    if (open <= 0) continue
    total += open
    const days = Math.floor((asOf.getTime() - new Date(inv.dueDate).getTime()) / 86_400_000)
    const idx = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4
    if (idx > 0) overdue += open
    buckets[idx].amount += open
    buckets[idx].count += 1
  }
  return { buckets, total, overdue }
}

export function monthlySeries(ledger: Ledger, entries: JournalEntry[], months: string[]): { month: string; revenue: number; expenses: number; profit: number; cogs: number }[] {
  return months.map((m) => {
    const from = `${m}-01`
    const to = `${m}-31`
    const p = profitAndLoss(ledger, entries, from, to)
    return { month: m, revenue: p.revenue, expenses: p.opex + p.taxes, cogs: p.cogs, profit: p.netProfit }
  })
}

export function accountLedger(entries: JournalEntry[], accountId: string, from?: string, to?: string) {
  const rows: { entry: JournalEntry; line: JournalLine; running: number }[] = []
  let running = 0
  const sorted = [...entries].filter((e) => e.status === 'POSTED').sort((a, b) => a.date.localeCompare(b.date))
  for (const e of sorted) {
    for (const l of e.lines) {
      if (l.accountId !== accountId) continue
      running += l.debit - l.credit
      if (inRange(e.date, from, to)) rows.push({ entry: e, line: l, running })
    }
  }
  return rows
}
