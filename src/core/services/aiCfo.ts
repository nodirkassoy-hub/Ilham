/**
 * AI CFO engine.
 *
 * Deterministic, rule-based analyst that runs on the caller's PERMITTED slice of
 * tenant data. Three hard rules, enforced in code:
 *
 *   1. Every metric is read through `scoped()` — if the principal lacks the
 *      data scope, the metric is `null` and the answer says so. The AI never
 *      receives the number, so it cannot leak it.
 *   2. Every sentence carries a claim type: FACT (computed from ledger),
 *      ESTIMATE (projection with stated assumption) or RECOMMENDATION.
 *   3. When there is no underlying data, the answer is "insufficient data".
 *      No number is ever fabricated.
 *
 * A real LLM can later be put behind the same `buildContext()` output — the
 * permission filter stays in front of it.
 */
import type { AIInsight } from '../domain/entities'
import type { AIClaimType } from '../domain/enums'
import { can, type DataScope, type PermissionKey, type Principal } from '../rbac/permissions'
import { Ledger, aging, balanceSheet, cashFlow, monthlySeries, profitAndLoss } from './accounting'
import { addDays, isoDate, money, pct, sum } from '../utils/format'
import type { TenantData } from '@/data/types'
import type { Entitlements } from '../billing/plans'

export interface AIAnswer {
  content: string
  claimType: AIClaimType | null
  insights: AIInsight[]
  permissionsUsed: PermissionKey[]
  deniedScopes: DataScope[]
}

export interface AIContext {
  visible: { key: DataScope; label: string }[]
  hidden: { key: DataScope; label: string }[]
  modules: string[]
}

const SCOPE_LABELS: Record<DataScope, string> = {
  'finance.revenue.view': 'Umumiy daromad',
  'finance.expense.view': 'Umumiy xarajatlar',
  'finance.profit.view': 'Sof foyda va marja',
  'finance.cash.view': 'Kassa qoldig‘i',
  'finance.bank.view': 'Bank hisoblari',
  'finance.payroll.view': 'Ish haqi fondi',
  'finance.salary.others.view': 'Boshqa xodimlar maoshi',
  'finance.salary.self.view': 'O‘z ish haqingiz',
  'finance.tax.view': 'Soliq majburiyatlari',
  'finance.cost.view': 'Tannarx va marja',
  'finance.executive.view': 'Boshqaruv hisobotlari',
  'finance.counterparty.balances.view': 'Kontragent balanslari',
}

export function buildContext(p: Principal | null): AIContext {
  const all = Object.keys(SCOPE_LABELS) as DataScope[]
  const visible = all.filter((k) => can(p, k)).map((key) => ({ key, label: SCOPE_LABELS[key] }))
  const hidden = all.filter((k) => !can(p, k)).map((key) => ({ key, label: SCOPE_LABELS[key] }))
  const modules = (['sales', 'stock', 'purchasing', 'accounting', 'production', 'hr', 'reports'] as const).filter((m) => can(p, `${m === 'production' ? 'production' : m}.view` as PermissionKey))
  return { visible, hidden, modules: [...modules] }
}

/* ------------------------------------------------------------- analyzers */

interface Env {
  t: TenantData
  p: Principal
  ent: Entitlements
  ledger: Ledger
  used: Set<PermissionKey>
  denied: Set<DataScope>
  now: Date
}

function scoped<T>(env: Env, scope: DataScope, f: () => T): T | null {
  if (!can(env.p, scope)) {
    env.denied.add(scope)
    return null
  }
  env.used.add(scope)
  return f()
}

function monthsBack(now: Date, n: number): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString().slice(0, 7))
  return out
}

const F = (s: string) => `FAKT · ${s}`
const E = (s: string) => `BAHO · ${s}`
const RCM = (s: string) => `TAVSIYA · ${s}`

type Intent =
  | 'profit'
  | 'revenue'
  | 'expenses'
  | 'cash'
  | 'receivables'
  | 'payables'
  | 'stock'
  | 'production'
  | 'cost'
  | 'payroll'
  | 'tax'
  | 'forecast'
  | 'sales_mine'
  | 'health'
  | 'help'
  | 'unknown'

function detectIntent(q: string): Intent {
  const s = q.toLowerCase()
  const has = (...w: string[]) => w.some((x) => s.includes(x))
  if (has('foyda', 'profit', 'прибыл', 'margin', 'marja', 'rentabel')) return 'profit'
  if (has('prognoz', 'forecast', 'прогноз', '3 oy', 'kelasi', 'keyingi oy')) return 'forecast'
  if (has('xarajat', 'expense', 'расход', 'tejash', 'marketing', 'ijara')) return 'expenses'
  if (has('daromad', 'tushum', 'revenue', 'выручк', 'sotuv hajmi', 'oborot', 'aylanma')) return 'revenue'
  if (has('kassa', 'pul oqimi', 'cash', 'naqd', 'bank', 'qoldiq pul', 'денег', 'runway')) return 'cash'
  if (has('debitor', 'kechik', 'qarzdor', 'to‘lamagan', "to'lamagan", 'overdue', 'receivable', 'дебитор')) return 'receivables'
  if (has('kreditor', "ta'minotchiga", 'ta‘minotchiga', 'payable', 'кредитор', 'qarzimiz')) return 'payables'
  if (has('tannarx', 'cost', 'себестоим')) return 'cost'
  if (has('ombor', 'zaxira', 'qoldiq', 'stock', 'xomashyo', 'склад', 'inventory')) return 'stock'
  if (has('ishlab chiqar', 'production', 'uskuna', 'brak', 'производств', 'sex')) return 'production'
  if (has('ish haqi', 'maosh', 'oylik', 'payroll', 'зарплат', 'salary')) return 'payroll'
  if (has('soliq', 'qqs', 'tax', 'налог')) return 'tax'
  if (has('mening sotuv', 'men sot', 'bugungi sotuv', 'my sales', 'мои продаж')) return 'sales_mine'
  if (has('holat', 'umumiy', 'health', 'ahvol', 'barqaror', 'summary', 'xulosa')) return 'health'
  if (has('yordam', 'help', 'nima qila olasan', 'помощь')) return 'help'
  return 'unknown'
}

/* ------------------------------------------------------------------ main */

export function answer(t: TenantData, p: Principal, ent: Entitlements, question: string, now = new Date()): AIAnswer {
  const env: Env = { t, p, ent, ledger: new Ledger(t.accounts), used: new Set(['ai.view']), denied: new Set(), now }
  const intent = detectIntent(question)
  const insights: AIInsight[] = []
  const parts: string[] = []
  let claim: AIClaimType | null = 'FACT'

  const months = monthsBack(now, 6)
  const cur = months.at(-1)!
  const prev = months.at(-2)!
  const mRange = (m: string) => [`${m}-01`, `${m}-31`] as const
  const hasHistory = t.journal.filter((e) => e.source === 'SALES').length > 0

  const noData = () => {
    parts.push("Aniq javob berish uchun ma'lumot yetarli emas. Bu bo'yicha haqiqiy o'tkazmalar topilmadi — raqam o'ylab topilmaydi.")
    claim = null
  }

  const deniedLine = (scope: DataScope, msg: string) => {
    env.denied.add(scope)
    parts.push(msg)
    parts.push("Kerak bo'lsa, kompaniya administratoridan ruxsat so'rang.")
    claim = null
  }

  switch (intent) {
    case 'profit': {
      const r = scoped(env, 'finance.profit.view', () => ({
        cur: profitAndLoss(env.ledger, t.journal, ...mRange(cur)),
        prev: profitAndLoss(env.ledger, t.journal, ...mRange(prev)),
      }))
      if (!r) {
        deniedLine('finance.profit.view', "Sizning rolingiz uchun kompaniyaning umumiy foyda ko'rsatkichi mavjud emas.")
        break
      }
      if (!hasHistory || (r.cur.revenue === 0 && r.prev.revenue === 0)) {
        noData()
        break
      }
      const delta = r.prev.netProfit ? ((r.cur.netProfit - r.prev.netProfit) / Math.abs(r.prev.netProfit)) * 100 : 0
      parts.push(F(`Joriy oyda sof foyda ${money(r.cur.netProfit)} (rentabellik ${pct(r.cur.netMarginPct)}). O'tgan oy: ${money(r.prev.netProfit)}.`))
      parts.push(F(`Yalpi marja ${pct(r.cur.grossMarginPct)} (o'tgan oy ${pct(r.prev.grossMarginPct)}).`))
      insights.push({ kind: delta < 0 ? 'RISK' : 'INSIGHT', claimType: 'FACT', title: delta < 0 ? 'Foyda kamaydi' : 'Foyda o‘sdi', body: `O'tgan oyga nisbatan ${pct(delta, 1, true)}. Joriy oy hali yakunlanmagan — taqqoslash to'liq emas.`, metric: { label: 'Sof foyda', value: money(r.cur.netProfit, { compact: true }) } })
      const opexDelta = r.prev.opex ? ((r.cur.opex - r.prev.opex) / r.prev.opex) * 100 : 0
      const cogsRatioCur = r.cur.revenue ? r.cur.cogs / r.cur.revenue : 0
      const cogsRatioPrev = r.prev.revenue ? r.prev.cogs / r.prev.revenue : 0
      const reasons: string[] = []
      if (r.cur.revenue < r.prev.revenue) reasons.push(`daromad ${pct(((r.cur.revenue - r.prev.revenue) / r.prev.revenue) * 100, 1, true)} (oy tugamagan)`)
      if (cogsRatioCur > cogsRatioPrev + 0.005) reasons.push(`tannarx ulushi ${pct(cogsRatioPrev * 100)} → ${pct(cogsRatioCur * 100)}`)
      if (opexDelta > 3) reasons.push(`operatsion xarajatlar ${pct(opexDelta, 1, true)}`)
      if (reasons.length) parts.push(E(`Foyda dinamikasiga asosiy ta'sir: ${reasons.join('; ')}.`))
      const top = r.cur.opexByAccount[0]
      if (top) parts.push(RCM(`Eng katta xarajat moddasi — «${top.account.name}» (${money(top.amount, { compact: true })}). Uni o'tgan 3 oy o'rtachasi bilan solishtiring va limit belgilang.`))
      insights.push({ kind: 'RECOMMENDATION', claimType: 'RECOMMENDATION', title: 'Marjani himoya qilish', body: 'Tannarx ulushi oshgan mahsulotlar uchun narxni qayta ko‘rib chiqing yoki chegirma siyosatini toraytiring.' })
      claim = 'FACT'
      break
    }

    case 'revenue': {
      const r = scoped(env, 'finance.revenue.view', () => monthlySeries(env.ledger, t.journal, months))
      if (!r) {
        deniedLine('finance.revenue.view', "Sizning rolingiz uchun kompaniyaning umumiy daromadi mavjud emas.")
        if (can(p, 'sales.view')) parts.push("O'z sotuvlaringiz bo'yicha so'rashingiz mumkin: «Mening bugungi sotuvlarim».")
        break
      }
      if (!hasHistory) {
        noData()
        break
      }
      const c = r.at(-1)!
      const pv = r.at(-2)!
      const avg3 = sum(r.slice(-4, -1), (x) => x.revenue) / 3
      parts.push(F(`Joriy oy daromadi ${money(c.revenue)} (QQSsiz). O'tgan oy: ${money(pv.revenue)}. So'nggi 3 oy o'rtachasi: ${money(avg3, { compact: true })}.`))
      const byChannel = t.sales.filter((s) => s.occurredAt.startsWith(cur)).reduce<Record<string, number>>((a, s) => ((a[s.channel] = (a[s.channel] ?? 0) + s.total), a), {})
      const chan = Object.entries(byChannel).sort((a, b) => b[1] - a[1])
      if (chan.length) parts.push(F(`Kanallar bo'yicha: ${chan.map(([k, v]) => `${k} ${money(v, { compact: true })}`).join(', ')}.`))
      const daysPassed = now.getDate()
      const daysIn = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
      parts.push(E(`Joriy sur'atda oy yakuni taxminan ${money((c.revenue / daysPassed) * daysIn, { compact: true })} bo'lishi mumkin (chiziqli ekstrapolyatsiya, mavsumiylik hisobga olinmagan).`))
      insights.push({ kind: 'ANALYSIS', claimType: 'ESTIMATE', title: 'Oy yakuni prognozi', body: `${daysPassed}/${daysIn} kun o'tdi. Prognoz faqat joriy sur'atga asoslangan.`, metric: { label: 'Prognoz', value: money((c.revenue / daysPassed) * daysIn, { compact: true }) } })
      break
    }

    case 'expenses': {
      const r = scoped(env, 'finance.expense.view', () => ({ cur: profitAndLoss(env.ledger, t.journal, ...mRange(cur)), prev: profitAndLoss(env.ledger, t.journal, ...mRange(prev)), prev2: profitAndLoss(env.ledger, t.journal, ...mRange(months.at(-3)!)) }))
      if (!r) {
        deniedLine('finance.expense.view', "Sizning rolingiz uchun kompaniya xarajatlari mavjud emas.")
        break
      }
      if (!hasHistory) {
        noData()
        break
      }
      parts.push(F(`Joriy oy operatsion xarajatlari ${money(r.cur.opex)}; o'tgan oy ${money(r.prev.opex)}.`))
      const lines = r.cur.opexByAccount.map((x) => {
        const before = r.prev.opexByAccount.find((y) => y.account.id === x.account.id)?.amount ?? 0
        const d = before ? ((x.amount - before) / before) * 100 : 0
        return { name: x.account.name, amount: x.amount, delta: d }
      })
      const grown = lines.filter((l) => l.delta > 8).sort((a, b) => b.delta - a.delta)
      for (const g of grown.slice(0, 2)) {
        parts.push(F(`«${g.name}» o'tgan oyga nisbatan ${pct(g.delta, 0, true)} oshgan (${money(g.amount, { compact: true })}).`))
        insights.push({ kind: 'RISK', claimType: 'FACT', title: `${g.name} oshdi`, body: `O'tgan oyga nisbatan ${pct(g.delta, 0, true)}.`, metric: { label: 'Joriy oy', value: money(g.amount, { compact: true }) } })
      }
      const payroll = scoped(env, 'finance.payroll.view', () => r.cur.opexByAccount.find((x) => x.account.systemKey === 'PAYROLL_EXPENSE')?.amount ?? 0)
      if (payroll !== null && payroll > 0) parts.push(F(`Ish haqi xarajati: ${money(payroll, { compact: true })} (${pct((payroll / r.cur.opex) * 100)} xarajatlardan).`))
      parts.push(RCM(`Har bir xarajat moddasi uchun oylik limit belgilang; limitning 80% ga yetganda AI ogohlantiradi.`))
      insights.push({ kind: 'RECOMMENDATION', claimType: 'RECOMMENDATION', title: 'Byudjet limitlari', body: 'Marketing va logistika uchun 3 oylik o‘rtacha asosida limit qo‘ying.' })
      break
    }

    case 'cash': {
      const bs = scoped(env, 'finance.cash.view', () => balanceSheet(env.ledger, t.journal))
      const bank = scoped(env, 'finance.bank.view', () => bs?.bank ?? 0)
      if (!bs) {
        deniedLine('finance.cash.view', "Kassa va bank qoldiqlari sizning rolingiz uchun yopiq.")
        break
      }
      const cf = cashFlow(env.ledger, t.journal, `${months.at(-4)}-01`, isoDate(now))
      parts.push(F(`Kassa: ${money(bs.cash)}.${bank !== null ? ` Bank: ${money(bank)}.` : ' Bank hisobi — ruxsat yo‘q.'}`))
      const burn3 = cf.byMonth.slice(-4, -1)
      const avgOut = burn3.length ? sum(burn3, (m) => m.outflow) / burn3.length : 0
      const avgIn = burn3.length ? sum(burn3, (m) => m.inflow) / burn3.length : 0
      if (avgOut > 0) {
        const liquid = bs.cash + (bank ?? 0)
        const netBurn = avgOut - avgIn
        parts.push(F(`So'nggi 3 oy o'rtacha chiqim ${money(avgOut, { compact: true })}/oy, kirim ${money(avgIn, { compact: true })}/oy.`))
        if (netBurn > 0) parts.push(E(`Kirim to'xtasa, mavjud likvid mablag' ~${(liquid / avgOut).toFixed(1)} oyga yetadi. Sof chiqim davom etsa — ~${(liquid / netBurn).toFixed(1)} oy.`))
        else parts.push(E(`Kirim chiqimdan yuqori: pul qoldig'i o'rtacha ${money(-netBurn, { compact: true })}/oy ga o'smoqda.`))
        insights.push({ kind: netBurn > 0 ? 'RISK' : 'INSIGHT', claimType: 'ESTIMATE', title: 'Pul zaxirasi', body: netBurn > 0 ? 'Sof pul chiqimi kuzatilmoqda. Debitorlik undirishni tezlashtiring.' : 'Pul oqimi ijobiy.', metric: { label: 'Likvid', value: money(liquid, { compact: true }) } })
      } else noData()
      const ag = scoped(env, 'finance.counterparty.balances.view', () => aging(t.invoices, 'OUT', now))
      if (ag && ag.overdue > 0) parts.push(RCM(`Muddati o'tgan debitorlik ${money(ag.overdue, { compact: true })} — undirilsa, likvidlik sezilarli yaxshilanadi.`))
      break
    }

    case 'receivables': {
      const ag = scoped(env, 'finance.counterparty.balances.view', () => aging(t.invoices, 'OUT', now))
      if (!ag) {
        deniedLine('finance.counterparty.balances.view', "Kontragent balanslari sizning rolingiz uchun yopiq.")
        break
      }
      const overdueInv = t.invoices.filter((i) => i.direction === 'OUT' && i.status === 'OVERDUE')
      const byCust = new Map<string, { amount: number; maxDays: number }>()
      for (const i of overdueInv) {
        const d = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / 86_400_000)
        const c = byCust.get(i.counterpartyId) ?? { amount: 0, maxDays: 0 }
        c.amount += i.total - i.paidAmount
        c.maxDays = Math.max(c.maxDays, d)
        byCust.set(i.counterpartyId, c)
      }
      const over30 = [...byCust.entries()].filter(([, v]) => v.maxDays > 30)
      parts.push(F(`Jami debitorlik ${money(ag.total)}, shundan muddati o'tgani ${money(ag.overdue)} (${ag.buckets.slice(1).reduce((a, b) => a + b.count, 0)} ta faktura).`))
      if (over30.length) parts.push(F(`${over30.length} ta mijozning to'lovi 30 kundan ortiq kechikkan: ${over30.slice(0, 3).map(([id, v]) => `${t.counterparties.find((c) => c.id === id)?.name ?? id} (${money(v.amount, { compact: true })}, ${v.maxDays} kun)`).join('; ')}.`))
      else if (overdueInv.length === 0) parts.push(F('Muddati o‘tgan faktura yo‘q.'))
      insights.push({ kind: 'RISK', claimType: 'FACT', title: 'Kechikkan to‘lovlar', body: `${over30.length} ta mijoz 30+ kun.`, metric: { label: 'Muddati o‘tgan', value: money(ag.overdue, { compact: true }) } })
      parts.push(RCM(`60+ kun kechikkan mijozlar uchun yangi kredit savdoni to'xtatib turing va eslatma yuboring.`))
      break
    }

    case 'payables': {
      const ag = scoped(env, 'finance.counterparty.balances.view', () => aging(t.invoices, 'IN', now))
      if (!ag) {
        deniedLine('finance.counterparty.balances.view', "Kreditorlik ma'lumoti sizning rolingiz uchun yopiq.")
        break
      }
      const soon = t.invoices.filter((i) => i.direction === 'IN' && i.status !== 'PAID' && i.dueDate <= isoDate(addDays(now, 7)))
      parts.push(F(`Ta'minotchilarga jami qarz ${money(ag.total)}; muddati o'tgani ${money(ag.overdue)}.`))
      parts.push(F(`7 kun ichida to'lanishi kerak: ${soon.length} ta faktura, ${money(sum(soon, (i) => i.total - i.paidAmount), { compact: true })}.`))
      parts.push(RCM(`To'lov kalendarini kassa prognozi bilan solishtiring; katta to'lovlarni debitorlik kirimidan keyinga rejalashtiring.`))
      break
    }

    case 'stock': {
      if (!can(p, 'stock.view')) {
        deniedLine('finance.cost.view', "Ombor ma'lumotlari sizning rolingiz uchun ochiq emas.")
        break
      }
      env.used.add('stock.view')
      const whIds = p.dataScope === 'WAREHOUSE' ? new Set(p.warehouseIds) : null
      const rows = t.stock.filter((s) => !whIds || whIds.has(s.warehouseId))
      const low = rows.filter((s) => {
        const pr = t.products.find((x) => x.id === s.productId)
        return pr && pr.reorderLevel > 0 && s.onHand - s.reserved <= pr.reorderLevel
      })
      parts.push(F(`${low.length} ta pozitsiya minimal zaxira darajasidan past: ${low.slice(0, 4).map((s) => `${t.products.find((x) => x.id === s.productId)!.name} (${s.onHand})`).join(', ')}${low.length > 4 ? '…' : ''}.`))
      // raw material coverage for factories
      const raw = t.products.filter((x) => x.type === 'RAW_MATERIAL')
      if (raw.length && t.boms.length) {
        const active = t.productionOrders.filter((o) => ['RELEASED', 'IN_PROGRESS', 'PLANNED'].includes(o.status))
        const dailyUse = new Map<string, number>()
        for (const o of active) {
          const b = t.boms.find((x) => x.id === o.bomId)
          if (!b) continue
          const days = Math.max(3, Math.round((new Date(o.plannedEnd).getTime() - new Date(o.plannedStart).getTime()) / 86_400_000))
          for (const l of b.lines) dailyUse.set(l.productId, (dailyUse.get(l.productId) ?? 0) + (l.qty * (1 + l.scrapPct / 100) * (o.plannedQty - o.producedQty)) / days)
        }
        const cov = raw.map((r) => {
          const on = sum(rows.filter((s) => s.productId === r.id), (s) => s.onHand)
          const use = dailyUse.get(r.id) ?? 0
          return { name: r.name, days: use > 0 ? on / use : Infinity }
        }).filter((x) => Number.isFinite(x.days)).sort((a, b) => a.days - b.days)
        if (cov.length) {
          parts.push(E(`Xomashyo qoldig'i «${cov[0].name}» bo'yicha ~${Math.floor(cov[0].days)} kunlik ishlab chiqarishga yetadi (faol buyurtmalar sur'ati bo'yicha).`))
          insights.push({ kind: cov[0].days < 10 ? 'RISK' : 'INSIGHT', claimType: 'ESTIMATE', title: 'Xomashyo yetarliligi', body: `${cov[0].name}: ~${Math.floor(cov[0].days)} kun.` })
        }
      }
      const val = scoped(env, 'finance.cost.view', () => sum(rows, (s) => s.onHand * s.avgCost))
      if (val !== null) parts.push(F(`Ombor qiymati (o'rtacha tannarxda): ${money(val)}.`))
      parts.push(RCM(`Minimal zaxiradan past pozitsiyalar uchun xarid talabini shakllantiring; yetkazib berish muddati 7–14 kun.`))
      break
    }

    case 'production': {
      if (!can(p, 'production.view')) {
        deniedLine('finance.cost.view', "Ishlab chiqarish ma'lumotlari sizning rolingiz uchun ochiq emas.")
        break
      }
      env.used.add('production.view')
      const active = t.productionOrders.filter((o) => !['CLOSED', 'CANCELLED', 'COMPLETED'].includes(o.status))
      const done30 = t.productionOrders.filter((o) => o.status === 'COMPLETED' && o.actualEnd && o.actualEnd > addDays(now, -30).toISOString())
      const scrapPct = done30.length ? (sum(done30, (o) => o.scrapQty) / Math.max(1, sum(done30, (o) => o.producedQty + o.scrapQty))) * 100 : 0
      const running = t.machines.filter((m) => m.state === 'RUNNING').length
      parts.push(F(`Faol buyurtmalar: ${active.length} ta (${active.filter((o) => o.status === 'QC').length} tasi sifat nazoratida). So'nggi 30 kunda yakunlangan: ${done30.length} ta, brak ulushi ${pct(scrapPct)}.`))
      parts.push(F(`Uskunalar: ${running}/${t.machines.length} ishlamoqda; ${t.machines.filter((m) => m.nextMaintenanceAt < now.toISOString()).length} tasining texnik xizmat muddati o'tgan.`))
      const cost = scoped(env, 'finance.cost.view', () => done30.map((o) => ({ o, plan: sum(o.costs, (c) => c.planned), act: sum(o.costs, (c) => c.actual) })).filter((x) => x.plan > 0))
      if (cost && cost.length) {
        const worst = cost.map((x) => ({ ...x, v: ((x.act - x.plan) / x.plan) * 100 })).sort((a, b) => b.v - a.v)[0]
        const prod = t.products.find((x) => x.id === worst.o.productId)
        parts.push(F(`Eng katta tannarx og'ishi: ${worst.o.number} (${prod?.name}) — reja ${money(worst.plan, { compact: true })}, fakt ${money(worst.act, { compact: true })} (${pct(worst.v, 1, true)}).`))
        if (worst.v > 3) insights.push({ kind: 'RISK', claimType: 'FACT', title: `${prod?.name} tannarxi oshgan`, body: `Rejadan ${pct(worst.v, 1, true)}. Material sarfi va energiya tarkibini tekshiring.` })
      }
      parts.push(RCM(`Texnik xizmat muddati o'tgan uskunalarni navbatdagi smena oldidan ko'rikdan o'tkazing — to'xtash xavfi brakdan qimmatga tushadi.`))
      break
    }

    case 'cost': {
      const r = scoped(env, 'finance.cost.view', () => {
        const byProd = new Map<string, { rev: number; cogs: number; qty: number }>()
        for (const s of t.sales.filter((s) => s.occurredAt > addDays(now, -60).toISOString())) for (const l of s.lines) {
          const c = byProd.get(l.productId) ?? { rev: 0, cogs: 0, qty: 0 }
          c.rev += l.qty * l.unitPrice * (1 - l.discountPct / 100)
          c.cogs += l.qty * l.unitCost
          c.qty += l.qty
          byProd.set(l.productId, c)
        }
        return [...byProd.entries()].map(([id, v]) => ({ name: t.products.find((x) => x.id === id)?.name ?? id, margin: v.rev ? ((v.rev - v.cogs) / v.rev) * 100 : 0, rev: v.rev })).sort((a, b) => a.margin - b.margin)
      })
      if (!r) {
        deniedLine('finance.cost.view', "Tannarx va marja ma'lumoti sizning rolingiz uchun yopiq.")
        break
      }
      if (!r.length) {
        noData()
        break
      }
      parts.push(F(`So'nggi 60 kunda eng past marjali mahsulotlar: ${r.slice(0, 3).map((x) => `${x.name} (${pct(x.margin)})`).join(', ')}.`))
      parts.push(F(`Eng yuqori marja: ${r.at(-1)!.name} (${pct(r.at(-1)!.margin)}).`))
      insights.push({ kind: 'ANALYSIS', claimType: 'FACT', title: 'Marja tahlili', body: `${r.length} ta mahsulot bo'yicha. QQS-inklyuziv narxlarda hisoblangan.` })
      parts.push(RCM(`${pct(r[0].margin)} dan past marjali mahsulotlar uchun chegirmani cheklang yoki ta'minotchi bilan narxni qayta kelishing.`))
      break
    }

    case 'payroll': {
      const r = scoped(env, 'finance.payroll.view', () => t.payrollRuns.slice(-2))
      if (!r) {
        const self = scoped(env, 'finance.salary.self.view', () => {
          const emp = t.employees.find((e) => e.memberId === p.memberId)
          const slip = emp ? t.payslips.filter((s) => s.employeeId === emp.id).at(-1) : null
          return slip ?? null
        })
        env.denied.add('finance.payroll.view')
        parts.push("Ish haqi fondi ma'lumoti sizning rolingiz uchun yopiq.")
        if (self) parts.push(F(`O'z oxirgi ish haqingiz (${self.periodLabel}): hisoblangan ${money(self.gross)}, qo'lga ${money(self.net)}.`))
        claim = self ? 'FACT' : null
        break
      }
      const last = r.at(-1)
      if (!last) {
        noData()
        break
      }
      parts.push(F(`${last.periodLabel} ish haqi fondi: hisoblangan ${money(last.grossTotal)}, soliqlar ${money(last.taxTotal)}, qo'lga ${money(last.netTotal)}. Holati: ${last.status}.`))
      if (r.length > 1) parts.push(F(`O'tgan oyga nisbatan ${pct(((last.grossTotal - r[0].grossTotal) / r[0].grossTotal) * 100, 1, true)}.`))
      parts.push(RCM(`Ish haqi to'lovini debitorlik kirimi bilan bir haftaga moslashtiring — kassa uzilishi xavfi kamayadi.`))
      break
    }

    case 'tax': {
      const r = scoped(env, 'finance.tax.view', () => t.taxes)
      if (!r) {
        deniedLine('finance.tax.view', "Soliq ma'lumotlari sizning rolingiz uchun yopiq.")
        break
      }
      if (!r.length) {
        noData()
        break
      }
      for (const x of r.slice(0, 3)) parts.push(F(`${x.taxType} (${x.periodLabel}): ${money(x.amount)}, muddat ${x.dueDate}, holat ${x.status}.`))
      parts.push(E(`Bu hisob platforma ichidagi o'tkazmalar asosida. Rasmiy soliq tizimiga ulanish yo'q — yakuniy summani buxgalter tasdiqlashi kerak.`))
      claim = 'FACT'
      break
    }

    case 'forecast': {
      const r = scoped(env, 'finance.executive.view', () => monthlySeries(env.ledger, t.journal, monthsBack(now, 7).slice(0, 6)))
      if (!r) {
        deniedLine('finance.executive.view', "Bu boshqaruv darajasidagi hisobot — sizning rolingiz uchun yopiq.")
        break
      }
      if (!ent.features.has('forecast.cashflow')) {
        parts.push('Pul oqimi prognozi Premium Plus tarifida mavjud. Joriy tarifda faqat tarixiy ma‘lumot ko‘rsatiladi.')
        parts.push(F(`So'nggi 3 oy daromadi: ${r.slice(-3).map((m) => money(m.revenue, { compact: true })).join(' → ')}.`))
        claim = 'FACT'
        break
      }
      const revs = r.map((m) => m.revenue)
      const n = revs.length
      const xs = revs.map((_, i) => i)
      const xm = sum(xs, (x) => x) / n
      const ym = sum(revs, (y) => y) / n
      const slope = xs.reduce((a, x, i) => a + (x - xm) * (revs[i] - ym), 0) / Math.max(1, sum(xs, (x) => (x - xm) ** 2))
      const proj = [1, 2, 3].map((k) => Math.max(0, ym + slope * (n - 1 + k - xm)))
      const avgProfitMargin = sum(r, (m) => m.profit) / Math.max(1, sum(r, (m) => m.revenue))
      parts.push(F(`So'nggi 6 to'liq oy daromadi: ${revs.map((v) => money(v, { compact: true })).join(', ')}.`))
      parts.push(E(`Chiziqli trend bo'yicha keyingi 3 oy: ${proj.map((v) => money(v, { compact: true })).join(', ')}. Sof foyda o'rtacha marja (${pct(avgProfitMargin * 100)}) saqlansa: ${proj.map((v) => money(v * avgProfitMargin, { compact: true })).join(', ')}.`))
      parts.push(E(`Farazlar: mavsumiylik yo'q, narxlar o'zgarmaydi, yirik mijozlar saqlanadi. Ishonch oralig'i keng — bu qaror uchun yo'nalish, aniq reja emas.`))
      insights.push({ kind: 'ANALYSIS', claimType: 'ESTIMATE', title: '3 oylik prognoz', body: 'Chiziqli regressiya, 6 oylik tarix asosida.', metric: { label: 'Keyingi oy', value: money(proj[0], { compact: true }) } })
      parts.push(RCM(`Prognozni oylik byudjet bilan taqqoslang va 10% dan ortiq og'ishda sabab tahlilini ishga tushiring.`))
      claim = 'ESTIMATE'
      break
    }

    case 'sales_mine': {
      if (!can(p, 'sales.view')) {
        deniedLine('finance.revenue.view', "Savdo moduli sizning rolingiz uchun ochiq emas.")
        break
      }
      env.used.add('sales.view')
      const mine = t.sales.filter((s) => (p.dataScope === 'SELF' ? s.soldByMemberId === p.memberId : true) && s.occurredAt.startsWith(isoDate(now)))
      const total = sum(mine, (s) => s.total)
      const unpaid = mine.filter((s) => s.paidAmount < s.total)
      if (!mine.length) parts.push(F('Bugun sizda qayd etilgan savdo yo‘q.'))
      else parts.push(F(`Bugun ${mine.length} ta savdo, jami ${money(total)}. ${unpaid.length} tasi to'liq to'lanmagan.`))
      const monthMine = t.sales.filter((s) => (p.dataScope === 'SELF' ? s.soldByMemberId === p.memberId : true) && s.occurredAt.startsWith(cur))
      parts.push(F(`Joriy oyda: ${monthMine.length} ta savdo, ${money(sum(monthMine, (s) => s.total))}.`))
      parts.push(RCM(`To'lanmagan savdolar bo'yicha mijozga eslatma yuboring — to'lov holati «To'langan» bo'lgach, savdo yopiladi.`))
      break
    }

    case 'health': {
      const pl = scoped(env, 'finance.profit.view', () => profitAndLoss(env.ledger, t.journal, ...mRange(prev)))
      const bs = scoped(env, 'finance.cash.view', () => balanceSheet(env.ledger, t.journal))
      const ag = scoped(env, 'finance.counterparty.balances.view', () => aging(t.invoices, 'OUT', now))
      if (!pl && !bs && !ag) {
        parts.push("Umumiy moliyaviy holat sizning rolingiz uchun yopiq. O'z bo'limingiz bo'yicha so'rashingiz mumkin (savdo, ombor yoki ishlab chiqarish).")
        claim = null
        break
      }
      if (pl) parts.push(F(`O'tgan to'liq oy: daromad ${money(pl.revenue, { compact: true })}, sof foyda ${money(pl.netProfit, { compact: true })} (${pct(pl.netMarginPct)}).`))
      if (bs) parts.push(F(`Likvid mablag': ${money(bs.cash + bs.bank, { compact: true })}. Debitorlik ${money(bs.receivables, { compact: true })}, kreditorlik ${money(bs.payables, { compact: true })}.`))
      if (ag) parts.push(F(`Muddati o'tgan debitorlik: ${money(ag.overdue, { compact: true })}.`))
      let score = 70
      if (pl && pl.netMarginPct > 15) score += 10
      if (pl && pl.netMarginPct < 5) score -= 15
      if (bs && ag && ag.overdue > bs.receivables * 0.35) score -= 10
      if (bs && bs.cash + bs.bank > (pl?.opex ?? 0) * 3) score += 8
      insights.push({ kind: 'ANALYSIS', claimType: 'ESTIMATE', title: 'Barqarorlik indeksi', body: 'Marja, likvidlik va debitorlik sifatidan hisoblangan ichki ball (0–100).', metric: { label: 'Indeks', value: `${Math.max(0, Math.min(100, score))}/100` } })
      parts.push(E(`Ichki barqarorlik indeksi: ${Math.max(0, Math.min(100, score))}/100 (marja, likvidlik, debitorlik sifati).`))
      break
    }

    case 'help':
    default: {
      claim = null
      const ctx = buildContext(p)
      parts.push('Men kompaniyangiz ma‘lumotlari asosida tahlil qilaman — faqat sizga ruxsat etilgan doirada.')
      parts.push(`Sizga ochiq: ${ctx.visible.map((v) => v.label).join(', ') || 'moliyaviy ko‘lam yo‘q'}.`)
      if (ctx.hidden.length) parts.push(`Yopiq: ${ctx.hidden.map((v) => v.label).join(', ')}.`)
      parts.push('Misol savollar: «Bu oy foyda nima uchun kamaydi?», «Kechikkan to‘lovlar», «Xomashyo qoldig‘i necha kunga yetadi?», «3 oylik prognoz».')
      if (intent === 'unknown') parts.unshift("Savolni to'liq tushunmadim. Quyidagi yo'nalishlardan birini tanlang yoki aniqroq yozing.")
    }
  }

  return {
    content: parts.join('\n\n'),
    claimType: claim,
    insights,
    permissionsUsed: [...env.used],
    deniedScopes: [...env.denied],
  }
}

/** Proactive insights for dashboards / notification centre — same permission gate. */
export function proactiveInsights(t: TenantData, p: Principal, ent: Entitlements, now = new Date()): AIInsight[] {
  const out: AIInsight[] = []
  const tryQ = (q: string) => {
    const a = answer(t, p, ent, q, now)
    for (const i of a.insights) if (i.kind === 'RISK' || i.kind === 'OPPORTUNITY') out.push(i)
  }
  tryQ('xarajatlar')
  tryQ('kechikkan to‘lovlar')
  tryQ('ombor')
  tryQ('ishlab chiqarish')
  return out.slice(0, 4)
}

export const QUICK_PROMPTS: { key: string; q: string; scope: DataScope | null }[] = [
  { key: 'ai.quick.profit', q: 'Bu oy foyda nima uchun o‘zgardi?', scope: 'finance.profit.view' },
  { key: 'ai.quick.expenses', q: 'Xarajatlarni qayerda tejash mumkin?', scope: 'finance.expense.view' },
  { key: 'ai.quick.cash', q: 'Pul oqimi va kassa holati qanday?', scope: 'finance.cash.view' },
  { key: 'ai.quick.receivables', q: 'Qaysi mijozlar to‘lovni kechiktirgan?', scope: 'finance.counterparty.balances.view' },
  { key: 'ai.quick.stock', q: 'Ombor va xomashyo xavflari bormi?', scope: null },
  { key: 'ai.quick.cost', q: 'Tannarx va marja tahlili', scope: 'finance.cost.view' },
  { key: 'ai.quick.tax', q: 'Soliq majburiyatlari qancha?', scope: 'finance.tax.view' },
  { key: 'ai.quick.forecast', q: '3 oylik prognoz bering', scope: 'finance.executive.view' },
]
