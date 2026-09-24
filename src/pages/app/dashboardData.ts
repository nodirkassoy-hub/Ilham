import { useMemo } from 'react'
import { useSession } from '@/app/useSession'
import { Ledger, aging, balanceSheet, cashFlow, monthlySeries, profitAndLoss } from '@/core/services/accounting'
import { addDays, isoDate, sum } from '@/core/utils/format'

/** All dashboard figures come from the ledger and documents — computed once per render of the tenant. */
export function useDashboardData() {
  const { tenant, principal } = useSession()
  return useMemo(() => {
    if (!tenant) return null
    const ledger = new Ledger(tenant.accounts)
    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7))
    const cur = months.at(-1)!
    const prev = months.at(-2)!
    const series = monthlySeries(ledger, tenant.journal, months)
    const plCur = profitAndLoss(ledger, tenant.journal, `${cur}-01`, `${cur}-31`)
    const plPrev = profitAndLoss(ledger, tenant.journal, `${prev}-01`, `${prev}-31`)
    const bs = balanceSheet(ledger, tenant.journal)
    const cf = cashFlow(ledger, tenant.journal, `${months[0]}-01`, isoDate(now))
    const ar = aging(tenant.invoices, 'OUT', now)
    const ap = aging(tenant.invoices, 'IN', now)
    const today = isoDate(now)
    const mine = principal?.dataScope === 'SELF' ? tenant.sales.filter((s) => s.soldByMemberId === principal.memberId) : tenant.sales
    const salesToday = mine.filter((s) => s.occurredAt.startsWith(today))
    const salesMonth = mine.filter((s) => s.occurredAt.startsWith(cur))
    const salesPrevMonth = mine.filter((s) => s.occurredAt.startsWith(prev))
    const whIds = principal?.dataScope === 'WAREHOUSE' ? new Set(principal.warehouseIds) : null
    const stock = tenant.stock.filter((s) => !whIds || whIds.has(s.warehouseId))
    const low = stock.filter((s) => {
      const p = tenant.products.find((x) => x.id === s.productId)
      return p && p.reorderLevel > 0 && s.onHand - s.reserved <= p.reorderLevel
    })
    const stockValue = sum(stock, (s) => (s.onHand + s.inTransit) * s.avgCost)
    const activeProd = tenant.productionOrders.filter((o) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(o.status))
    const done30 = tenant.productionOrders.filter((o) => o.status === 'COMPLETED' && o.actualEnd && o.actualEnd > addDays(now, -30).toISOString())
    const scrapPct = done30.length ? (sum(done30, (o) => o.scrapQty) / Math.max(1, sum(done30, (o) => o.producedQty + o.scrapQty))) * 100 : 0
    const machinesRunning = tenant.machines.filter((m) => m.state === 'RUNNING').length
    const attendanceToday = tenant.attendance.filter((a) => a.date === today)
    const topProducts = Object.entries(
      salesMonth.flatMap((s) => s.lines).reduce<Record<string, { qty: number; rev: number }>>((acc, l) => {
        const k = l.productId
        acc[k] ??= { qty: 0, rev: 0 }
        acc[k].qty += l.qty
        acc[k].rev += l.qty * l.unitPrice * (1 - l.discountPct / 100)
        return acc
      }, {}),
    )
      .map(([id, v]) => ({ product: tenant.products.find((p) => p.id === id)!, ...v }))
      .filter((x) => x.product)
      .sort((a, b) => b.rev - a.rev)
      .slice(0, 5)
    const topCustomers = Object.entries(
      salesMonth.reduce<Record<string, number>>((acc, s) => {
        if (!s.customerId) return acc
        acc[s.customerId] = (acc[s.customerId] ?? 0) + s.total
        return acc
      }, {}),
    )
      .map(([id, v]) => ({ customer: tenant.counterparties.find((c) => c.id === id)!, total: v }))
      .filter((x) => x.customer && x.customer.segment !== 'Chakana')
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
    const pendingPayments = tenant.payments.filter((p) => p.status === 'PENDING')
    const openInvoices = tenant.invoices.filter((i) => i.direction === 'OUT' && !['PAID', 'VOID', 'DRAFT'].includes(i.status))
    const pendingLeaves = tenant.leaves.filter((l) => l.status === 'PENDING')
    const purchasesPendingApproval = tenant.purchases.filter((p) => p.status === 'REQUEST')
    const purchasesToReceive = tenant.purchases.filter((p) => p.status === 'ORDERED')
    const transfersInTransit = tenant.transfers.filter((x) => x.status === 'IN_TRANSIT')
    const overdueMachines = tenant.machines.filter((m) => m.nextMaintenanceAt < now.toISOString())
    const payrollLast = tenant.payrollRuns.at(-1) ?? null
    const delta = (a: number, b: number) => (b ? ((a - b) / Math.abs(b)) * 100 : 0)
    return {
      ledger,
      months,
      cur,
      series,
      plCur,
      plPrev,
      bs,
      cf,
      ar,
      ap,
      salesToday,
      salesMonth,
      salesPrevMonth,
      stock,
      low,
      stockValue,
      activeProd,
      done30,
      scrapPct,
      machinesRunning,
      attendanceToday,
      topProducts,
      topCustomers,
      pendingPayments,
      openInvoices,
      pendingLeaves,
      purchasesPendingApproval,
      purchasesToReceive,
      transfersInTransit,
      overdueMachines,
      payrollLast,
      delta,
      revenueDelta: delta(plCur.revenue, plPrev.revenue),
      profitDelta: delta(plCur.netProfit, plPrev.netProfit),
      expenseDelta: delta(plCur.opex, plPrev.opex),
      salesDelta: delta(sum(salesMonth, (s) => s.total), sum(salesPrevMonth, (s) => s.total)),
    }
  }, [tenant, principal])
}

export type DashboardData = NonNullable<ReturnType<typeof useDashboardData>>
