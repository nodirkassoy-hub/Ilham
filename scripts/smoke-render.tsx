/**
 * Server-render smoke test: mounts every route for several roles through the
 * real router/store and fails on any thrown render error. Catches the class of
 * bugs a type-checker cannot (undefined lookups, bad hooks, missing keys).
 */
import React from 'react'
import { renderToPipeableStream } from 'react-dom/server'
import { Writable } from 'node:stream'

function renderFull(el: React.ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let out = ''
    const sink = new Writable({ write(chunk, _e, cb) { out += chunk.toString(); cb() }, final(cb) { cb(); resolve(out) } })
    const stream = renderToPipeableStream(el, { onAllReady() { stream.pipe(sink) }, onShellError(e) { reject(e) }, onError(e) { reject(e) } })
    setTimeout(() => reject(new Error('render timeout')), 8000)
  })
}
import { MemoryRouter } from 'react-router-dom'

const mem = new Map<string, string>()
;(globalThis as any).localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 }
;(globalThis as any).window = { scrollTo() {}, addEventListener() {}, removeEventListener() {}, location: { pathname: '/', href: '' }, matchMedia: () => ({ matches: false }) }
;(globalThis as any).document = { documentElement: { lang: 'uz', classList: { toggle() {} } }, body: { style: {} }, addEventListener() {}, removeEventListener() {}, createElement: () => ({}), dispatchEvent() {} }
Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'node' }, configurable: true })

const { useAppStore } = await import('@/store/appStore')
const { default: App } = await import('@/app/App')
const { DEMO_PASSWORD } = await import('@/data/seed')
useAppStore.getState().boot()

// preload lazy chunks so Suspense doesn't short-circuit the render
await Promise.all([
  import('@/pages/public/Landing'), import('@/pages/public/Login'), import('@/pages/public/Onboarding'), import('@/pages/public/PricingPage'),
  import('@/pages/app/Dashboard'), import('@/pages/app/Sales'), import('@/pages/app/Inventory'), import('@/pages/app/Purchasing'), import('@/pages/app/Counterparties'),
  import('@/pages/app/Accounting'), import('@/pages/app/Reports'), import('@/pages/app/Manufacturing'), import('@/pages/app/Hr'), import('@/pages/app/AiCfo'),
  import('@/pages/app/Notifications'), import('@/pages/app/Settings'), import('@/pages/app/Checkout'), import('@/pages/admin/Admin'),
])

const publicRoutes = ['/', '/pricing', '/login', '/register', '/login?admin=1']
const appRoutes = ['/app', '/app/sales', '/app/sales/new', '/app/invoices', '/app/payments', '/app/customers', '/app/suppliers', '/app/inventory/products', '/app/inventory/stock', '/app/inventory/warehouses', '/app/inventory/transfers', '/app/inventory/counts', '/app/purchasing', '/app/accounting/journal', '/app/accounting/coa', '/app/accounting/ledger', '/app/accounting/reconciliation', '/app/accounting/taxes', '/app/accounting/periods', '/app/reports', '/app/reports/pnl', '/app/reports/balance', '/app/reports/cashflow', '/app/reports/trial', '/app/reports/sales', '/app/reports/stock', '/app/reports/receivables', '/app/reports/production', '/app/reports/payroll', '/app/manufacturing/orders', '/app/manufacturing/bom', '/app/manufacturing/machines', '/app/manufacturing/quality', '/app/hr/employees', '/app/hr/attendance', '/app/hr/leave', '/app/hr/payroll', '/app/ai', '/app/notifications', '/app/settings', '/app/settings/company', '/app/settings/members', '/app/settings/permissions', '/app/settings/branches', '/app/settings/billing', '/app/settings/billing?upgrade=1', '/app/settings/integrations', '/app/settings/security', '/app/settings/audit', '/app/checkout?plan=PREMIUM_PLUS&cycle=ANNUAL']
const adminRoutes = ['/admin', '/admin/companies', '/admin/users', '/admin/subscriptions', '/admin/plans', '/admin/payments', '/admin/trials', '/admin/ai', '/admin/logs', '/admin/support', '/admin/settings']

let fails = 0
let count = 0
const origErr = console.error
const render = async (route: string, who: string) => {
  ;(globalThis as any).window.location.pathname = route.split('?')[0]
  const errs: string[] = []
  console.error = (...a: unknown[]) => { const s = a.map(String).join(' '); if (!/useLayoutEffect|act\(|not wrapped|Suspense/.test(s)) errs.push(s.slice(0, 160)) }
  try {
    // SSR reads zustand's *initial* snapshot (useSyncExternalStore server path) — mirror live state into it.
    Object.assign(useAppStore.getInitialState(), useAppStore.getState())
    const html = await renderFull(<MemoryRouter initialEntries={[route]}><App /></MemoryRouter>)
    count++
    if (process.env.SNIP && route === process.env.SNIP) console.log(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 900))
    if (html.includes('Yuklanmoqda…') && !route.startsWith('/login')) { fails++; console.log(`✗ ${who} ${route} — rendered Suspense fallback`) }
    else if (html.length < 200) { fails++; console.log(`✗ ${who} ${route} — empty (${html.length}b)`) }
    else if (errs.length) { fails++; console.log(`✗ ${who} ${route} — ${errs[0]}`) }
  } catch (e) {
    fails++
    console.log(`✗ ${who} ${route} — ${(e as Error).message.slice(0, 200)}`)
  } finally { console.error = origErr }
}

for (const r of publicRoutes) await render(r, 'public')
const roles: [string, string[]][] = [['owner@balans.uz', appRoutes], ['chief@balans.uz', appRoutes], ['sales@balans.uz', appRoutes], ['storekeeper@balans.uz', appRoutes], ['production@balans.uz', appRoutes], ['hr@balans.uz', appRoutes], ['worker@balans.uz', appRoutes], ['auditor@balans.uz', appRoutes], ['owner@nursavdo.uz', appRoutes], ['owner@samteks.uz', appRoutes]]
for (const [email, routes] of roles) {
  useAppStore.getState().logout()
  const r = useAppStore.getState().login(email, DEMO_PASSWORD)
  if (!r.ok) { console.log('login failed', email); fails++; continue }
  for (const route of routes) await render(route, email.split('@')[0])
}
useAppStore.getState().logout()
useAppStore.getState().login('admin@balans.uz', DEMO_PASSWORD)
for (const r of adminRoutes) await render(r, 'admin')

console.log(`\n${count} renders, ${fails} failures`)
process.exit(fails ? 1 : 0)
