/** Demo-data consistency assertions: the books must balance and stock cards must reconcile to the ledger. */
import { buildSeed } from '@/data/seed'
import { Ledger, aging, balanceSheet, profitAndLoss, trialBalance } from '@/core/services/accounting'

const s = buildSeed()
const t = s.tenants.t_balans
const L = new Ledger(t.accounts)
const bs = balanceSheet(L, t.journal)
const tb = trialBalance(L, t.journal)
const prev = new Date(); prev.setMonth(prev.getMonth() - 1)
const m = prev.toISOString().slice(0, 7)
const pl = profitAndLoss(L, t.journal, `${m}-01`, `${m}-31`)
const ar = aging(t.invoices, 'OUT')
const arInv = t.invoices.filter((i) => i.direction === 'OUT').reduce((a, i) => a + i.total - i.paidAmount, 0)
const stockVal = t.stock.reduce((a, x) => a + (x.onHand + x.inTransit) * x.avgCost, 0)
const wip = tb.find((b) => b.account.code === '2010')?.balance ?? 0
// chronological negative-stock scan
const bal = new Map<string, number>(); let negatives = 0
for (const mv of [...t.movements].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))) { const k = `${mv.productId}|${mv.warehouseId}`; const v = (bal.get(k) ?? 0) + mv.qty; bal.set(k, v); if (v < -0.01) negatives++ }

const checks: [string, boolean, string][] = [
  ['balance sheet balances', bs.balanced, `A ${bs.totalAssets} = L+E ${bs.totalLiabilities + bs.totalEquity}`],
  ['trial balance D = C', Math.abs(tb.reduce((a, b) => a + b.debit, 0) - tb.reduce((a, b) => a + b.credit, 0)) < 2, ''],
  ['AR from invoices equals ledger AR', Math.abs(arInv - bs.receivables) < 2, `${arInv} vs ${bs.receivables}`],
  ['ledger inventory = stock cards + WIP (±0.05%)', Math.abs(bs.inventory - stockVal - wip) < bs.inventory * 0.0005, `${bs.inventory} vs ${Math.round(stockVal + wip)}`],
  ['no negative stock at any point in time', negatives === 0, `${negatives} negative snapshots`],
  ['last full month is profitable with realistic margin (5–35%)', pl.netMarginPct > 5 && pl.netMarginPct < 35, `${pl.netMarginPct.toFixed(1)}%`],
  ['overdue AR is a minority of AR', ar.overdue < ar.total * 0.6, `${ar.overdue} / ${ar.total}`],
  ['every journal entry is balanced', t.journal.every((e) => Math.abs(e.totalDebit - e.totalCredit) < 2), ''],
  ['every row carries the tenant id', [...t.sales, ...t.invoices, ...t.journal, ...t.stock].every((r) => r.tenantId === 't_balans'), ''],
  ['seed serialises under 4.5 MB', JSON.stringify(s).length < 4.5 * 1024 * 1024, `${(JSON.stringify(s).length / 1024 / 1024).toFixed(2)} MB`],
]
let fail = 0
for (const [name, ok, extra] of checks) { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${name}${extra ? ' — ' + extra : ''}`) }
console.log(`\nledger: ${t.journal.length} entries · ${t.sales.length} sales · ${t.invoices.length} invoices · ${t.movements.length} movements · ${t.productionOrders.length} production orders`)
console.log(`${m}: revenue ${Math.round(pl.revenue / 1e6)} mln · gross margin ${pl.grossMarginPct.toFixed(1)}% · net ${Math.round(pl.netProfit / 1e6)} mln (${pl.netMarginPct.toFixed(1)}%)`)
process.exit(fail ? 1 : 0)
