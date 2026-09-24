# Balans ERP

> **Har bir kompaniya o‘z biznesini bitta aqlli platformada boshqaradi.**

Multi-tenant Accounting + ERP + CRM + Inventory + Manufacturing + HR + AI CFO SaaS for Uzbek businesses — from a single shop to a factory. Primary language Uzbek (Latin), with Russian and English.

This repository contains the complete **frontend + application architecture** (domain model, RBAC, plan entitlements, double-entry accounting engine, permission-gated AI CFO, platform admin) running against an in-browser store that mirrors the future backend contract.

```
npm install
npm run dev        # http://localhost:5173
npm test           # typecheck + business-rule harness + SSR smoke (516 routes×roles) + ledger consistency
npm run build
```

---

## Demo accounts

Password for every demo account: **`demo1234`**

| Role | Email | What you'll see |
|---|---|---|
| Owner | `owner@balans.uz` | Full executive dashboard, permission matrix, billing |
| Director | `director@balans.uz` | All finance, approvals, no billing changes |
| Chief accountant | `chief@balans.uz` | Ledger, taxes, period close, P&L |
| Accountant | `accountant@balans.uz` | Daily accounting — **no company profit / payroll totals** |
| Sales manager | `salesmanager@balans.uz` | Team sales, customers, revenue — no profit/expenses |
| **Sales employee** | `sales@balans.uz` | Only own sales, prices, stock. **AI refuses profit questions.** |
| Cashier | `cashier@balans.uz` | POS, cash register |
| Warehouse manager | `warehouse@balans.uz` | Stock, transfers, counts |
| Warehouse employee | `storekeeper@balans.uz` | One warehouse, receive/ship |
| Purchasing manager | `purchasing@balans.uz` | Purchase orders, suppliers, unit costs |
| Production manager | `production@balans.uz` | Orders, BOM, machines, costing |
| Factory worker | `worker@balans.uz` | Own work orders, attendance, own payslip |
| HR manager | `hr@balans.uz` | Employees, attendance, leave, payroll |
| Auditor | `auditor@balans.uz` | Read + export everything, write nothing |
| **Platform super admin** | `admin@balans.uz` | `/admin` — SaaS operations, never company financials |

Other tenants: `owner@samteks.uz` (active Premium factory), `owner@nursavdo.uz` (expired trial → read-only workspace).

Use **Rolni almashtirish** in the user menu to hop between BALANS GROUP roles and watch cards, navigation and AI answers change.

---

## The five rules, and where they're enforced

| Rule | Enforcement |
|---|---|
| **1. No employee sees financial data without permission** | `core/rbac/permissions.ts` — two axes: module actions (`sales.create`) and 12 **data scopes** (`finance.profit.view`, `finance.salary.others.view`, …). Checked in the store (`guard()`), in components (`<Scoped>` renders a lock, never the value), and in the AI. Denied attempts are written to the tenant audit log — even when the transaction is rolled back. |
| **2. AI obeys the same permissions** | `core/services/aiCfo.ts` reads every metric through `scoped()`; without the scope the number is `null` and the answer says *"Sizning rolingiz uchun … mavjud emas"*. Each message stores `permissionsUsed` and `deniedScopes`. Every sentence is tagged **FAKT / BAHO / TAVSIYA**; with no data it says so instead of inventing numbers. |
| **3. Tenant isolation** | State is `tenants[tenantId] → TenantData`; every service receives exactly one tenant. `selectTenant()` refuses tenants where the user has no membership. Super admin has **no** tenant principal and `can()` returns `false` for every `finance.*` scope. |
| **4. No fake integrations** | Payme / Click / Uzum / bank are `PaymentProvider` targets with `connected: false`; checkout writes a `PaymentAttempt` with `status: 'SIMULATED'` and says so in the UI. Bank feeds: `feedConnected: false`. 2FA: architecture present, provider not connected — labelled. |
| **5. Plan limits are logic, not hidden buttons** | `core/billing/plans.ts` → `resolveEntitlements()`; `checkLimit()` is called by the store **before** a write (`err.limit.users`, `err.limit.warehouses`, …). Expired / suspended → `mode: 'READ_ONLY'`: data preserved, writes refused. |

`npm run test:rules` drives the real store through all five (44 assertions).

---

## Architecture

```
src/
  core/
    domain/        enums.ts, entities.ts        ← 40+ entities, every row carries tenantId
    rbac/          permissions.ts               ← roles, actions, data scopes, effectivePermissions(), can()
    billing/       plans.ts                     ← plans, limits, feature flags, entitlements, trial banner state machine
    services/
      accounting.ts                             ← double-entry engine: postSale/postPurchase/postPayment/postPayroll/
                                                   postMaterialIssue/postProductionCompletion + P&L, balance sheet,
                                                   trial balance, cash flow, aging — all DERIVED from journal entries
      aiCfo.ts                                  ← permission-gated analyst, FACT/ESTIMATE/RECOMMENDATION
    i18n/          uz.ts (source of truth), ru.ts, en.ts
  data/
    seed.ts        BALANS GROUP: 12 months of documents run THROUGH the engine → internally consistent
    types.ts       TenantData = everything one tenant owns
  store/appStore.ts   "backend in the browser": guard → limit check → mutate ONE tenant → post journal → audit
  app/             router, layouts (Public / Workspace / Admin), navigation, useSession()
  ui/              primitives, SVG charts, DataTable (pagination, debounced search, sort), gates
  pages/
    public/        Landing, Pricing, Login, Onboarding (6 steps → 30-day trial)
    app/           role-based Dashboard, Sales (POS wizard), Inventory, Purchasing, Counterparties,
                   Accounting, Reports, Manufacturing, HR, AI CFO, Notifications, Settings, Checkout
    admin/         /admin — Overview, Companies, Users, Subscriptions, Plans, Payments, Trials, AI, Logs, Support
scripts/           verify-rules.ts · smoke-render.tsx · check-seed.ts
```

### Accounting core

Every business document becomes a balanced journal entry (Uzbek chart of accounts, NSBU-style codes). Reports are never stored — they are computed from the ledger, so a sale made in the POS immediately moves revenue, VAT, COGS, inventory, receivables, the P&L, the balance sheet and the AI's answers together. The seed proves it: AR from open invoices equals ledger account 4010 to the so‘m; ledger inventory equals stock cards + WIP; no stock card is ever negative at any point in time.

### Subscription model

* **Tekin** — 0 so‘m · **Premium** — 299 000 so‘m/oy · **Premium Plus** — 699 000 so‘m/oy
* Annual = 10 × monthly (2 990 000 / 6 990 000) → *"Yillik to‘lovda 2 oy tejang"* = 16.7 %, stored explicitly so it can never drift.
* Statuses: `TRIAL → ACTIVE → PAST_DUE → EXPIRED / CANCELLED / SUSPENDED`. Trial banner: normal → D-7 → D-3 → D-1 → expired.
* Super admin can change plan/price, extend trials, suspend/activate — all with confirmation modals.

### Connecting a real backend

The store's action signatures are the API contract. Replace bodies in `appStore.ts` with HTTP calls; keep `guard()` semantics server-side (permission → entitlement → tenant → post → audit). `Principal` maps to a JWT claim set; `TenantData` maps to a per-tenant schema or row-level `tenant_id` filter. The AI's `buildContext()` output is exactly what should be placed in front of an LLM.

---

## Design

Premium fintech: liquid-glass surfaces, Sora/Manrope/JetBrains Mono, dark default with a full light theme via CSS tokens, tabular numerals everywhere money appears, SVG charts with no chart library, progressive disclosure (locked items explain *why*: permission vs plan), skeletons, debounced search, pagination.

> Demo data is clearly labelled. Payment providers, bank feeds, e-invoicing and OTP are architecture placeholders — not connected.
