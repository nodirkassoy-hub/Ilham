/**
 * Demo seed — "BALANS GROUP" plus two lighter tenants and a platform catalogue.
 *
 * All monetary history is produced by running documents through the accounting
 * engine, so P&L, balance sheet, AR/AP, stock value and cash all agree with each
 * other by construction. The generator is seeded → identical on every load.
 */
import type {
  Account,
  AttendanceRecord,
  BillOfMaterials,
  Company,
  Counterparty,
  Employee,
  FiscalPeriod,
  Invoice,
  InventoryMovement,
  Member,
  Notification,
  Payment,
  PayrollRun,
  Payslip,
  PlatformCompanyRow,
  Product,
  ProductionOrder,
  Purchase,
  Sale,
  StockBalance,
  Subscription,
  SupportTicket,
  SystemLogEntry,
  User,
  Warehouse,
  WorkOrder,
} from '@/core/domain/entities'
import type { RoleId } from '@/core/rbac/permissions'
import type { BusinessType, Industry, PlanId, SubscriptionStatus } from '@/core/domain/enums'
import {
  Ledger,
  buildChartOfAccounts,
  postDepreciation,
  postExpense,
  postMaterialIssue,
  postOpening,
  postPayment,
  postPayroll,
  postProductionCompletion,
  postPurchase,
  postSale,
} from '@/core/services/accounting'
import { addDays, docNumber, isoDate, mulberry32, sum } from '@/core/utils/format'
import { emptyTenantData, type TenantData } from './types'

export const DEMO_PASSWORD = 'demo1234'
export const DEMO_TENANT_ID = 't_balans'
export const SUPER_ADMIN_EMAIL = 'admin@balans.uz'

const TONES = ['brand', 'sky', 'violet', 'gold', 'danger', 'success', 'warning']

export function hashPassword(p: string): string {
  // Client demo only — a real backend uses argon2/bcrypt server-side.
  let h = 0
  for (let i = 0; i < p.length; i++) h = (Math.imul(31, h) + p.charCodeAt(i)) | 0
  return `demo$${(h >>> 0).toString(16)}`
}

/* ------------------------------------------------------------------- people */

interface Person {
  id: string
  name: string
  email: string
  phone: string
  role: RoleId
  position: string
  dept: string
  salary: number
}

const SAL = (n: number) => Math.round((n * 0.9) / 100_000) * 100_000

export const DEMO_PEOPLE: Person[] = [
  { id: 'u_jasur', name: 'Jasur Karimov', email: 'owner@balans.uz', phone: '+998 90 123 45 67', role: 'OWNER', position: 'Bosh direktor', dept: 'Boshqaruv', salary: SAL(25_000_000) },
  { id: 'u_rustam', name: 'Rustam Xolmatov', email: 'director@balans.uz', phone: '+998 90 234 56 78', role: 'DIRECTOR', position: 'Ijrochi direktor', dept: 'Boshqaruv', salary: SAL(18_000_000) },
  { id: 'u_dilnoza', name: 'Dilnoza Rashidova', email: 'chief@balans.uz', phone: '+998 91 345 67 89', role: 'CHIEF_ACCOUNTANT', position: 'Bosh buxgalter', dept: 'Moliya', salary: SAL(14_000_000) },
  { id: 'u_malika', name: 'Malika Yusupova', email: 'accountant@balans.uz', phone: '+998 93 456 78 90', role: 'ACCOUNTANT', position: 'Buxgalter', dept: 'Moliya', salary: SAL(8_500_000) },
  { id: 'u_sardor', name: 'Sardor Aliyev', email: 'salesmanager@balans.uz', phone: '+998 94 567 89 01', role: 'SALES_MANAGER', position: 'Savdo bo‘limi boshlig‘i', dept: 'Savdo', salary: SAL(11_000_000) },
  { id: 'u_aziz', name: 'Aziz Tursunov', email: 'sales@balans.uz', phone: '+998 95 678 90 12', role: 'SALES_EMPLOYEE', position: 'Sotuvchi', dept: 'Savdo', salary: SAL(6_000_000) },
  { id: 'u_gulnora', name: 'Gulnora Mirzayeva', email: 'cashier@balans.uz', phone: '+998 97 789 01 23', role: 'CASHIER', position: 'Kassir', dept: 'Savdo', salary: SAL(5_500_000) },
  { id: 'u_bobur', name: 'Bobur Nazarov', email: 'warehouse@balans.uz', phone: '+998 99 890 12 34', role: 'WAREHOUSE_MANAGER', position: 'Ombor mudiri', dept: 'Logistika', salary: SAL(8_000_000) },
  { id: 'u_kamol', name: 'Kamol Ergashev', email: 'storekeeper@balans.uz', phone: '+998 90 901 23 45', role: 'WAREHOUSE_EMPLOYEE', position: 'Omborchi', dept: 'Logistika', salary: SAL(4_800_000) },
  { id: 'u_shahnoza', name: 'Shahnoza Abdullayeva', email: 'purchasing@balans.uz', phone: '+998 91 012 34 56', role: 'PURCHASING_MANAGER', position: 'Xarid menejeri', dept: 'Logistika', salary: SAL(9_000_000) },
  { id: 'u_otabek', name: 'Otabek Rahimov', email: 'production@balans.uz', phone: '+998 93 123 45 67', role: 'PRODUCTION_MANAGER', position: 'Sex boshlig‘i', dept: 'Ishlab chiqarish', salary: SAL(12_000_000) },
  { id: 'u_farrux', name: 'Farrux Qodirov', email: 'worker@balans.uz', phone: '+998 94 234 56 78', role: 'FACTORY_WORKER', position: 'Yig‘uvchi', dept: 'Ishlab chiqarish', salary: SAL(5_200_000) },
  { id: 'u_nilufar', name: 'Nilufar Saidova', email: 'hr@balans.uz', phone: '+998 95 345 67 89', role: 'HR_MANAGER', position: 'HR menejer', dept: 'HR', salary: SAL(9_500_000) },
  { id: 'u_umida', name: 'Umida Toshpulatova', email: 'auditor@balans.uz', phone: '+998 97 456 78 90', role: 'AUDITOR', position: 'Ichki auditor', dept: 'Moliya', salary: SAL(10_000_000) },
]

/** Non-member factory staff — appear in HR only. */
const EXTRA_STAFF: { name: string; position: string; dept: string; salary: number }[] = [
  { name: 'Sherzod Qosimov', position: 'Yig‘uvchi', dept: 'Ishlab chiqarish', salary: SAL(5_200_000) },
  { name: 'Dilshod Mahmudov', position: 'CNC operatori', dept: 'Ishlab chiqarish', salary: SAL(6_800_000) },
  { name: 'Nodir Bekmurodov', position: 'Kromkalovchi', dept: 'Ishlab chiqarish', salary: SAL(5_000_000) },
  { name: 'Anvar Xudoyberdiyev', position: 'Loklovchi', dept: 'Ishlab chiqarish', salary: SAL(5_400_000) },
  { name: 'Zilola Nurmatova', position: 'Sifat nazoratchisi', dept: 'Ishlab chiqarish', salary: SAL(6_200_000) },
  { name: 'Javohir Ismoilov', position: 'Haydovchi', dept: 'Logistika', salary: SAL(5_000_000) },
  { name: 'Madina Karimova', position: 'Ofis menejeri', dept: 'Boshqaruv', salary: SAL(5_500_000) },
  { name: 'Temur Sattorov', position: 'Sotuvchi (Samarqand)', dept: 'Savdo', salary: SAL(5_800_000) },
]

/* ---------------------------------------------------------------- catalogue */

interface ProdSeed {
  id: string
  sku: string
  name: string
  type: Product['type']
  cat: string
  unit: string
  sale: number
  buy: number
  reorder: number
  tone: string
  opening: Record<string, number>
}

const P: ProdSeed[] = [
  // Raw materials → wh_raw
  { id: 'p_ldsp', sku: 'RM-001', name: 'LDSP plita 16mm (oq)', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'list', sale: 0, buy: 185_000, reorder: 120, tone: 'faint', opening: { wh_raw: 560 } },
  { id: 'p_mdf', sku: 'RM-002', name: 'MDF plita 18mm', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'list', sale: 0, buy: 240_000, reorder: 60, tone: 'faint', opening: { wh_raw: 260 } },
  { id: 'p_kromka', sku: 'RM-003', name: 'PVX kromka 2mm', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'm', sale: 0, buy: 2_400, reorder: 2000, tone: 'faint', opening: { wh_raw: 9800 } },
  { id: 'p_furnitura', sku: 'RM-004', name: 'Furnitura to‘plami', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'toʻplam', sale: 0, buy: 38_000, reorder: 200, tone: 'faint', opening: { wh_raw: 900 } },
  { id: 'p_metall', sku: 'RM-005', name: 'Metall karkas (stol)', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'dona', sale: 0, buy: 145_000, reorder: 50, tone: 'faint', opening: { wh_raw: 220 } },
  { id: 'p_lak', sku: 'RM-006', name: 'Poliuretan lak', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'l', sale: 0, buy: 62_000, reorder: 40, tone: 'faint', opening: { wh_raw: 160 } },
  { id: 'p_gazlift', sku: 'RM-007', name: 'Gazlift + mexanizm', type: 'RAW_MATERIAL', cat: 'Xomashyo', unit: 'dona', sale: 0, buy: 96_000, reorder: 40, tone: 'faint', opening: { wh_raw: 180 } },
  // Finished goods → wh_fg
  { id: 'p_stol_std', sku: 'FG-101', name: 'Ofis stoli «Standart» 140×70', type: 'FINISHED_GOOD', cat: 'Ofis mebeli', unit: 'dona', sale: 1_650_000, buy: 0, reorder: 15, tone: 'brand', opening: { wh_fg: 42, wh_smq: 8 } },
  { id: 'p_stol_prm', sku: 'FG-102', name: 'Ofis stoli «Premium» 160×80', type: 'FINISHED_GOOD', cat: 'Ofis mebeli', unit: 'dona', sale: 2_850_000, buy: 0, reorder: 10, tone: 'brand', opening: { wh_fg: 24, wh_smq: 4 } },
  { id: 'p_kreslo', sku: 'FG-103', name: 'Kreslo «Ergo»', type: 'FINISHED_GOOD', cat: 'Ofis mebeli', unit: 'dona', sale: 1_950_000, buy: 0, reorder: 12, tone: 'brand', opening: { wh_fg: 30, wh_smq: 6 } },
  { id: 'p_shkaf', sku: 'FG-104', name: 'Shkaf «Arxiv» 2 eshikli', type: 'FINISHED_GOOD', cat: 'Ofis mebeli', unit: 'dona', sale: 3_400_000, buy: 0, reorder: 6, tone: 'brand', opening: { wh_fg: 14 } },
  { id: 'p_tumba', sku: 'FG-105', name: 'Tumba 3 tortmali', type: 'FINISHED_GOOD', cat: 'Ofis mebeli', unit: 'dona', sale: 890_000, buy: 0, reorder: 15, tone: 'brand', opening: { wh_fg: 38, wh_smq: 10 } },
  // Trading goods → wh_main
  { id: 'p_monitor', sku: 'TG-201', name: 'Monitor stendi (alyumin)', type: 'GOODS', cat: 'Aksessuarlar', unit: 'dona', sale: 420_000, buy: 265_000, reorder: 20, tone: 'sky', opening: { wh_main: 64 } },
  { id: 'p_lampa', sku: 'TG-202', name: 'Stol lampasi LED', type: 'GOODS', cat: 'Aksessuarlar', unit: 'dona', sale: 310_000, buy: 190_000, reorder: 20, tone: 'sky', opening: { wh_main: 48 } },
  { id: 'p_qogoz', sku: 'TG-203', name: 'Qog‘oz A4 (500 varaq)', type: 'GOODS', cat: 'Kanselyariya', unit: 'pachka', sale: 58_000, buy: 41_000, reorder: 100, tone: 'sky', opening: { wh_main: 380, wh_smq: 60 } },
  { id: 'p_organayzer', sku: 'TG-204', name: 'Stol organayzeri', type: 'GOODS', cat: 'Aksessuarlar', unit: 'dona', sale: 145_000, buy: 82_000, reorder: 30, tone: 'sky', opening: { wh_main: 12 } },
  { id: 'p_kreslo_imp', sku: 'TG-205', name: 'Mehmon kreslosi (import)', type: 'GOODS', cat: 'Ofis mebeli', unit: 'dona', sale: 1_150_000, buy: 760_000, reorder: 8, tone: 'sky', opening: { wh_main: 9 } },
  // Services
  { id: 'p_montaj', sku: 'SV-301', name: 'Yig‘ish va o‘rnatish xizmati', type: 'SERVICE', cat: 'Xizmatlar', unit: 'xizmat', sale: 250_000, buy: 0, reorder: 0, tone: 'violet', opening: {} },
  { id: 'p_loyiha', sku: 'SV-302', name: 'Ofis dizayn loyihasi', type: 'SERVICE', cat: 'Xizmatlar', unit: 'xizmat', sale: 1_800_000, buy: 0, reorder: 0, tone: 'violet', opening: {} },
]

const CUSTOMERS: { id: string; name: string; tin: string; contact: string; segment: string; terms: number; limit: number }[] = [
  { id: 'c_uztelecom', name: '«Uztelecom» AJ', tin: '200584521', contact: 'Sanjar Mirzayev', segment: 'Korporativ', terms: 30, limit: 150_000_000 },
  { id: 'c_artel', name: '«Artel Electronics» MChJ', tin: '303218754', contact: 'Nodira Karimova', segment: 'Korporativ', terms: 30, limit: 120_000_000 },
  { id: 'c_akfa', name: '«Akfa Group» MChJ', tin: '301025874', contact: 'Bekzod Umarov', segment: 'Korporativ', terms: 45, limit: 200_000_000 },
  { id: 'c_itpark', name: '«IT Park Tashkent»', tin: '306521478', contact: 'Malika Rasulova', segment: 'Davlat', terms: 60, limit: 90_000_000 },
  { id: 'c_ipak', name: '«Ipak Yo‘li» banki', tin: '200987456', contact: 'Ulug‘bek Toshev', segment: 'Bank', terms: 30, limit: 180_000_000 },
  { id: 'c_orient', name: '«Orient Group» MChJ', tin: '305874123', contact: 'Jamshid Saidov', segment: 'O‘rta biznes', terms: 15, limit: 40_000_000 },
  { id: 'c_smart', name: '«Smart Office» MChJ', tin: '307412589', contact: 'Dilorom Yuldasheva', segment: 'Diler', terms: 30, limit: 60_000_000 },
  { id: 'c_najot', name: '«Najot Ta‘lim» o‘quv markazi', tin: '304785612', contact: 'Sherzod Ahmedov', segment: 'Ta‘lim', terms: 15, limit: 30_000_000 },
  { id: 'c_samarqand', name: '«Samarqand Darvoza» savdo markazi', tin: '302147856', contact: 'Botir Nazarov', segment: 'O‘rta biznes', terms: 15, limit: 35_000_000 },
  { id: 'c_bukhara', name: '«Buxoro Klinika» MChJ', tin: '305632147', contact: 'Gulchehra Rahimova', segment: 'Tibbiyot', terms: 30, limit: 50_000_000 },
  { id: 'c_retail', name: 'Chakana xaridor', tin: '', contact: '—', segment: 'Chakana', terms: 0, limit: 0 },
  { id: 'c_texno', name: '«TexnoMart» MChJ', tin: '306987412', contact: 'Aziza Qurbonova', segment: 'Diler', terms: 30, limit: 70_000_000 },
]

const SUPPLIERS: { id: string; name: string; tin: string; contact: string; terms: number; supplies: string[] }[] = [
  { id: 's_kronospan', name: '«Kronospan Uzbekistan»', tin: '304125874', contact: 'Igor Petrov', terms: 30, supplies: ['p_ldsp', 'p_mdf'] },
  { id: 's_hafele', name: '«Häfele Central Asia»', tin: '305874521', contact: 'Rustam Boboev', terms: 45, supplies: ['p_furnitura', 'p_gazlift', 'p_kromka'] },
  { id: 's_metall', name: '«Toshkent Metall Konstruksiya»', tin: '201458796', contact: 'Abdulla Sodiqov', terms: 15, supplies: ['p_metall'] },
  { id: 's_kimyo', name: '«Navoiy Kimyo Savdo»', tin: '303654789', contact: 'Zafar Mamatov', terms: 15, supplies: ['p_lak'] },
  { id: 's_import', name: '«Silk Road Import» MChJ', tin: '306321478', contact: 'Chen Wei', terms: 30, supplies: ['p_monitor', 'p_lampa', 'p_organayzer', 'p_kreslo_imp'] },
  { id: 's_qogoz', name: '«Qog‘oz Savdo» MChJ', tin: '302587413', contact: 'Nargiza Olimova', terms: 15, supplies: ['p_qogoz'] },
]

/* ------------------------------------------------------------------- seed */

export interface SeedResult {
  users: User[]
  tenants: Record<string, TenantData>
  platformCompanies: PlatformCompanyRow[]
  supportTickets: SupportTicket[]
  systemLogs: SystemLogEntry[]
}

export function buildSeed(nowDate: Date = new Date()): SeedResult {
  const rnd = mulberry32(20260924)
  const R = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1))
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]
  const now = nowDate.toISOString()

  /* users */
  const users: User[] = [
    {
      id: 'u_super',
      fullName: 'Platforma Admin',
      email: SUPER_ADMIN_EMAIL,
      phone: '+998 71 200 00 00',
      passwordHash: hashPassword(DEMO_PASSWORD),
      avatarTone: 'danger',
      locale: 'uz',
      theme: 'dark',
      twoFactorEnabled: true,
      isSuperAdmin: true,
      lastLoginAt: now,
      createdAt: '2025-01-10T09:00:00.000Z',
      updatedAt: now,
    },
    ...DEMO_PEOPLE.map((p, i) => ({
      id: p.id,
      fullName: p.name,
      email: p.email,
      phone: p.phone,
      passwordHash: hashPassword(DEMO_PASSWORD),
      avatarTone: TONES[i % TONES.length],
      locale: 'uz' as const,
      theme: 'dark' as const,
      twoFactorEnabled: p.role === 'OWNER',
      isSuperAdmin: false,
      lastLoginAt: addDays(nowDate, -R(0, 5)).toISOString(),
      createdAt: '2025-09-15T09:00:00.000Z',
      updatedAt: now,
    })),
  ]

  const balans = buildBalansGroup(nowDate, rnd, R, pick)
  const samarqand = buildLightTenant({
    tenantId: 't_samteks',
    name: 'Samarqand Tekstil',
    legalName: '«Samarqand Tekstil» MChJ',
    tin: '305412789',
    industry: 'TEXTILE',
    businessType: 'FACTORY',
    plan: 'PREMIUM',
    status: 'ACTIVE',
    ownerName: 'Bahodir Ravshanov',
    ownerEmail: 'owner@samteks.uz',
    ownerId: 'u_bahodir',
    city: 'Samarqand',
    createdAt: '2025-11-03T10:00:00.000Z',
    nowDate,
  })
  const nur = buildLightTenant({
    tenantId: 't_nur',
    name: 'Nur Savdo',
    legalName: 'YaTT «Nur Savdo»',
    tin: '512478963',
    industry: 'OTHER',
    businessType: 'RETAIL',
    plan: 'FREE',
    status: 'EXPIRED',
    ownerName: 'Nodira Yo‘ldosheva',
    ownerEmail: 'owner@nursavdo.uz',
    ownerId: 'u_nodira',
    city: 'Buxoro',
    createdAt: '2026-07-20T10:00:00.000Z',
    nowDate,
  })
  users.push(
    mkUser('u_bahodir', 'Bahodir Ravshanov', 'owner@samteks.uz', '+998 90 555 11 22', 'gold', now),
    mkUser('u_nodira', 'Nodira Yo‘ldosheva', 'owner@nursavdo.uz', '+998 91 444 22 33', 'sky', now),
  )

  const tenants: Record<string, TenantData> = {
    [DEMO_TENANT_ID]: balans,
    t_samteks: samarqand,
    t_nur: nur,
  }

  /* platform catalogue — light rows for companies that have no full data */
  const platformCompanies: PlatformCompanyRow[] = [
    rowFromTenant(balans),
    rowFromTenant(samarqand),
    rowFromTenant(nur),
    ...LIGHT_COMPANIES.map((c, i) => {
      const created = addDays(nowDate, -c.ageDays)
      const trialEnd = c.status === 'TRIAL' ? addDays(created, 30).toISOString() : null
      return {
        tenantId: `t_l${i}`,
        name: c.name,
        industry: c.industry,
        businessType: c.biz,
        planId: c.plan,
        subscriptionStatus: c.status,
        users: c.users,
        warehouses: c.wh,
        trialEnd,
        createdAt: created.toISOString(),
        lastActivityAt: addDays(nowDate, -c.idleDays).toISOString(),
        mrr: c.status === 'ACTIVE' ? (c.plan === 'PREMIUM' ? 299_000 : c.plan === 'PREMIUM_PLUS' ? 699_000 : 0) : 0,
        isDemo: false,
      } satisfies PlatformCompanyRow
    }),
  ]

  const supportTickets: SupportTicket[] = [
    { id: 'tk1', tenantId: 't_l3', company: 'Chust Pichoq Ustaxonasi', subject: 'Excel import: ustunlar mos kelmayapti', priority: 'NORMAL', status: 'OPEN', planId: 'PREMIUM', createdAt: addDays(nowDate, -1).toISOString(), lastReplyAt: addDays(nowDate, -1).toISOString() },
    { id: 'tk2', tenantId: 't_samteks', company: 'Samarqand Tekstil', subject: 'Uchinchi omborxona qo‘shish (limit)', priority: 'HIGH', status: 'PENDING', planId: 'PREMIUM', createdAt: addDays(nowDate, -2).toISOString(), lastReplyAt: addDays(nowDate, -0.5).toISOString() },
    { id: 'tk3', tenantId: 't_l7', company: 'Fergana Agro Export', subject: 'Payme orqali to‘lov qachon ishlaydi?', priority: 'NORMAL', status: 'OPEN', planId: 'PREMIUM_PLUS', createdAt: addDays(nowDate, -3).toISOString(), lastReplyAt: addDays(nowDate, -3).toISOString() },
    { id: 'tk4', tenantId: 't_l1', company: 'Andijon Non Kombinati', subject: 'Retsept (BOM) da chiqindi foizi', priority: 'LOW', status: 'RESOLVED', planId: 'PREMIUM_PLUS', createdAt: addDays(nowDate, -6).toISOString(), lastReplyAt: addDays(nowDate, -4).toISOString() },
    { id: 'tk5', tenantId: 't_nur', company: 'Nur Savdo', subject: 'Sinov tugadi — ma‘lumot saqlanadimi?', priority: 'URGENT', status: 'OPEN', planId: 'FREE', createdAt: addDays(nowDate, -0.2).toISOString(), lastReplyAt: addDays(nowDate, -0.2).toISOString() },
  ]

  const systemLogs: SystemLogEntry[] = Array.from({ length: 40 }, (_, i) => {
    const at = new Date(nowDate.getTime() - i * R(3, 25) * 60_000).toISOString()
    const kinds: SystemLogEntry[] = [
      { id: `log${i}`, at, level: 'INFO', service: 'auth', message: 'Login OK · session issued', tenantId: pick(platformCompanies).tenantId },
      { id: `log${i}`, at, level: 'INFO', service: 'billing', message: 'Trial reminder D-7 dispatched', tenantId: pick(platformCompanies).tenantId },
      { id: `log${i}`, at, level: 'WARN', service: 'rbac', message: 'DENIED finance.profit.view (SALES_EMPLOYEE) — logged to tenant audit', tenantId: DEMO_TENANT_ID },
      { id: `log${i}`, at, level: 'INFO', service: 'ai', message: 'AI query served · scopes filtered · 1 denial', tenantId: DEMO_TENANT_ID },
      { id: `log${i}`, at, level: 'INFO', service: 'ledger', message: 'Journal posted · balanced · 6 lines', tenantId: DEMO_TENANT_ID },
      { id: `log${i}`, at, level: 'ERROR', service: 'payments', message: 'Provider PAYME not configured — attempt marked SIMULATED', tenantId: pick(platformCompanies).tenantId },
      { id: `log${i}`, at, level: 'DEBUG', service: 'scheduler', message: 'Nightly backup snapshot completed (14 tenants)', tenantId: null },
    ]
    return pick(kinds)
  })

  return { users, tenants, platformCompanies, supportTickets, systemLogs }
}

function mkUser(id: string, fullName: string, email: string, phone: string, tone: string, now: string): User {
  return {
    id,
    fullName,
    email,
    phone,
    passwordHash: hashPassword(DEMO_PASSWORD),
    avatarTone: tone,
    locale: 'uz',
    theme: 'dark',
    twoFactorEnabled: false,
    isSuperAdmin: false,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

export function rowFromTenant(t: TenantData): PlatformCompanyRow {
  const s = t.subscription
  return {
    tenantId: t.company.tenantId,
    name: t.company.name,
    industry: t.company.industry,
    businessType: t.company.businessType,
    planId: s.planId,
    subscriptionStatus: s.status,
    users: t.members.length,
    warehouses: t.warehouses.length,
    trialEnd: s.trialEnd,
    createdAt: t.company.createdAt,
    lastActivityAt: t.members.reduce((m, x) => (x.lastActiveAt && x.lastActiveAt > m ? x.lastActiveAt : m), t.company.createdAt),
    mrr: s.status === 'ACTIVE' ? (s.planId === 'PREMIUM' ? (s.billingCycle === 'ANNUAL' ? 249_167 : 299_000) : s.planId === 'PREMIUM_PLUS' ? (s.billingCycle === 'ANNUAL' ? 582_500 : 699_000) : 0) : 0,
    isDemo: t.company.isDemo,
  }
}

const LIGHT_COMPANIES: { name: string; industry: Industry; biz: BusinessType; plan: PlanId; status: SubscriptionStatus; users: number; wh: number; ageDays: number; idleDays: number }[] = [
  { name: 'Toshkent Mebel Fabrikasi', industry: 'FURNITURE', biz: 'FACTORY', plan: 'PREMIUM_PLUS', status: 'ACTIVE', users: 34, wh: 5, ageDays: 240, idleDays: 0 },
  { name: 'Andijon Non Kombinati', industry: 'FOOD_BEVERAGE', biz: 'MANUFACTURING', plan: 'PREMIUM_PLUS', status: 'ACTIVE', users: 21, wh: 3, ageDays: 190, idleDays: 0 },
  { name: 'Buxoro Farm Savdo', industry: 'PHARMACEUTICALS', biz: 'WHOLESALE', plan: 'PREMIUM', status: 'ACTIVE', users: 8, wh: 2, ageDays: 150, idleDays: 1 },
  { name: 'Chust Pichoq Ustaxonasi', industry: 'METALLURGY', biz: 'MANUFACTURING', plan: 'PREMIUM', status: 'ACTIVE', users: 6, wh: 1, ageDays: 95, idleDays: 0 },
  { name: 'Osiyo Logistik', industry: 'TRANSPORT', biz: 'LOGISTICS', plan: 'PREMIUM', status: 'PAST_DUE', users: 9, wh: 2, ageDays: 210, idleDays: 3 },
  { name: 'Registon Kafe', industry: 'FOOD_BEVERAGE', biz: 'RESTAURANT', plan: 'FREE', status: 'ACTIVE', users: 2, wh: 1, ageDays: 120, idleDays: 2 },
  { name: 'Namangan Qurilish Servis', industry: 'CONSTRUCTION_MATERIALS', biz: 'CONSTRUCTION', plan: 'PREMIUM_PLUS', status: 'TRIAL', users: 12, wh: 2, ageDays: 9, idleDays: 0 },
  { name: 'Fergana Agro Export', industry: 'AGRICULTURE', biz: 'WHOLESALE', plan: 'PREMIUM_PLUS', status: 'ACTIVE', users: 17, wh: 4, ageDays: 300, idleDays: 0 },
  { name: 'Xorazm IT Solutions', industry: 'IT_SOFTWARE', biz: 'SERVICE', plan: 'PREMIUM', status: 'TRIAL', users: 5, wh: 1, ageDays: 22, idleDays: 1 },
  { name: 'Qarshi Elektro Market', industry: 'ELECTRONICS', biz: 'RETAIL', plan: 'PREMIUM', status: 'TRIAL', users: 4, wh: 1, ageDays: 27, idleDays: 0 },
  { name: 'Termiz Paxta Tozalash', industry: 'TEXTILE', biz: 'FACTORY', plan: 'PREMIUM_PLUS', status: 'SUSPENDED', users: 28, wh: 3, ageDays: 400, idleDays: 14 },
  { name: 'Guliston Sut Mahsulotlari', industry: 'FOOD_BEVERAGE', biz: 'MANUFACTURING', plan: 'PREMIUM', status: 'EXPIRED', users: 7, wh: 2, ageDays: 260, idleDays: 41 },
  { name: 'Nukus Avto Servis', industry: 'AUTOMOTIVE', biz: 'SERVICE', plan: 'FREE', status: 'ACTIVE', users: 2, wh: 1, ageDays: 60, idleDays: 5 },
  { name: 'Jizzax Dori Darmon', industry: 'PHARMACEUTICALS', biz: 'RETAIL', plan: 'PREMIUM', status: 'CANCELLED', users: 3, wh: 1, ageDays: 330, idleDays: 70 },
  { name: 'Sirdaryo Energo Montaj', industry: 'ENERGY', biz: 'CONSTRUCTION', plan: 'PREMIUM_PLUS', status: 'TRIAL', users: 9, wh: 2, ageDays: 3, idleDays: 0 },
  { name: 'Marg‘ilon Atlas', industry: 'TEXTILE', biz: 'MANUFACTURING', plan: 'PREMIUM', status: 'ACTIVE', users: 10, wh: 2, ageDays: 175, idleDays: 0 },
]

/* ============================================================ BALANS GROUP */

function buildBalansGroup(
  nowDate: Date,
  rnd: () => number,
  R: (a: number, b: number) => number,
  pick: <T>(arr: T[]) => T,
): TenantData {
  const tenantId = DEMO_TENANT_ID
  const now = nowDate.toISOString()
  const today = isoDate(nowDate)
  const start = new Date(nowDate.getFullYear(), nowDate.getMonth() - 11, 1) // 12 months incl. current
  const startIso = start.toISOString()

  const company: Company = {
    id: tenantId,
    tenantId,
    name: 'BALANS GROUP',
    legalName: '«BALANS GROUP» MChJ',
    tin: '305218746',
    vatCertificate: '326010045871',
    industry: 'FURNITURE',
    businessType: 'MANUFACTURING',
    ownerUserId: 'u_jasur',
    directorName: 'Karimov Jasur Botirovich',
    chiefAccountantName: 'Rashidova Dilnoza Akmalovna',
    phone: '+998 71 205 45 45',
    email: 'info@balansgroup.uz',
    address: 'Toshkent sh., Yashnobod tumani, Sanoat ko‘chasi 24',
    bankName: 'Kapitalbank ATB, Yashnobod filiali',
    bankAccount: '2020 8000 1052 4871 0001',
    bankMfo: '01088',
    baseCurrency: 'UZS',
    fiscalYearStartMonth: 1,
    vatRate: 12,
    turnoverTaxRate: 4,
    isDemo: true,
    status: 'TRIAL',
    employeeCount: 22,
    logoTone: 'brand',
    createdAt: startIso,
    updatedAt: now,
  }

  const trialStart = addDays(nowDate, -3)
  const subscription: Subscription = {
    id: 'sub_balans',
    tenantId,
    planId: 'PREMIUM_PLUS',
    status: 'TRIAL',
    billingCycle: 'MONTHLY',
    trialStart: trialStart.toISOString(),
    trialEnd: addDays(trialStart, 30).toISOString(),
    startedAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    renewalAt: null,
    cancelledAt: null,
    paymentStatus: 'UNPAID',
    seatsUsed: DEMO_PEOPLE.length,
    trialExtendedDays: 0,
    provider: null,
    createdAt: trialStart.toISOString(),
    updatedAt: now,
  }

  const d = emptyTenantData(company, subscription)
  const stamp = { createdAt: startIso, updatedAt: now }

  /* branches / warehouses */
  d.branches = [
    { id: 'br_tosh', tenantId, name: 'Toshkent — bosh ofis va zavod', code: 'TSH', city: 'Toshkent', address: 'Yashnobod, Sanoat 24', phone: '+998 71 205 45 45', managerMemberId: 'm_u_rustam', isActive: true, ...stamp },
    { id: 'br_smq', tenantId, name: 'Samarqand filiali', code: 'SMQ', city: 'Samarqand', address: 'Registon ko‘chasi 8', phone: '+998 66 233 10 10', managerMemberId: 'm_u_sardor', isActive: true, ...stamp },
  ]
  const wh = (id: string, name: string, code: string, branchId: string, type: Warehouse['type'], managerMemberId: string | null): Warehouse => ({
    id,
    tenantId,
    name,
    code,
    branchId,
    type,
    address: branchId === 'br_smq' ? 'Samarqand, Registon 8' : 'Toshkent, Sanoat 24',
    managerMemberId,
    isActive: true,
    ...stamp,
  })
  d.warehouses = [
    wh('wh_main', 'Asosiy ombor (savdo)', 'WH-01', 'br_tosh', 'MAIN', 'm_u_bobur'),
    wh('wh_raw', 'Xomashyo ombori', 'WH-02', 'br_tosh', 'PRODUCTION', 'm_u_otabek'),
    wh('wh_fg', 'Tayyor mahsulot ombori', 'WH-03', 'br_tosh', 'MAIN', 'm_u_bobur'),
    wh('wh_smq', 'Samarqand ombori', 'WH-04', 'br_smq', 'BRANCH', null),
  ]

  /* departments */
  const deptNames = ['Boshqaruv', 'Moliya', 'Savdo', 'Logistika', 'Ishlab chiqarish', 'HR']
  d.departments = deptNames.map((n, i) => ({
    id: `dep_${i}`,
    tenantId,
    name: n,
    code: `D${i + 1}`,
    headMemberId: null,
    parentId: null,
    costCenterAccountId: null,
    ...stamp,
  }))
  const deptId = (n: string) => d.departments.find((x) => x.name === n)!.id

  /* members */
  d.members = DEMO_PEOPLE.map((p, i): Member => {
    const isSmq = p.id === 'u_sardor'
    const scope: Member['dataScope'] =
      p.role === 'SALES_EMPLOYEE' || p.role === 'CASHIER' || p.role === 'FACTORY_WORKER' ? 'SELF' : p.role === 'WAREHOUSE_EMPLOYEE' ? 'WAREHOUSE' : 'ALL'
    return {
      id: `m_${p.id}`,
      tenantId,
      userId: p.id,
      fullName: p.name,
      email: p.email,
      phone: p.phone,
      role: p.role,
      departmentId: deptId(p.dept),
      branchIds: isSmq ? ['br_tosh', 'br_smq'] : ['br_tosh'],
      warehouseIds: p.role === 'WAREHOUSE_EMPLOYEE' ? ['wh_main'] : p.role.startsWith('PRODUCTION') || p.role === 'FACTORY_WORKER' ? ['wh_raw', 'wh_fg'] : d.warehouses.map((w) => w.id),
      permissionOverrides: p.id === 'u_sardor' ? { 'finance.cost.view': true } : {},
      dataScope: scope,
      status: 'ACTIVE',
      lastActiveAt: addDays(nowDate, -R(0, 4)).toISOString(),
      avatarTone: TONES[i % TONES.length],
      ...stamp,
    }
  })

  /* employees */
  const allStaff = [
    ...DEMO_PEOPLE.map((p) => ({ memberId: `m_${p.id}`, name: p.name, position: p.position, dept: p.dept, salary: p.salary })),
    ...EXTRA_STAFF.map((s) => ({ memberId: null as string | null, name: s.name, position: s.position, dept: s.dept, salary: s.salary })),
  ]
  d.employees = allStaff.map((s, i): Employee => ({
    id: `emp_${i}`,
    tenantId,
    memberId: s.memberId,
    fullName: s.name,
    tin: `4${String(10_000_000 + i * 7919).padStart(8, '0')}`,
    position: s.position,
    departmentId: deptId(s.dept),
    branchId: s.position.includes('Samarqand') ? 'br_smq' : 'br_tosh',
    employmentType: s.position.includes('Yig‘uvchi') || s.position.includes('Kromka') ? 'HOURLY' : 'FULL_TIME',
    hiredAt: addDays(start, -R(30, 900)).toISOString(),
    baseSalary: s.salary,
    phone: `+998 9${R(0, 9)} ${R(100, 999)} ${R(10, 99)} ${R(10, 99)}`,
    email: s.memberId ? DEMO_PEOPLE.find((p) => `m_${p.id}` === s.memberId)!.email : `${s.name.split(' ')[0].toLowerCase()}@balansgroup.uz`,
    status: 'ACTIVE',
    bankAccount: `8600 ${R(1000, 9999)} ${R(1000, 9999)} ${R(1000, 9999)}`,
    ...stamp,
  }))
  company.employeeCount = d.employees.length

  /* catalogue */
  const catNames = ['Xomashyo', 'Ofis mebeli', 'Aksessuarlar', 'Kanselyariya', 'Xizmatlar']
  d.categories = catNames.map((n, i) => ({ id: `cat_${i}`, tenantId, name: n, parentId: null, code: `C${i + 1}`, ...stamp }))
  const unitNames = ['dona', 'list', 'm', 'toʻplam', 'l', 'pachka', 'xizmat']
  d.units = unitNames.map((n, i) => ({ id: `unit_${i}`, tenantId, name: n, symbol: n, factor: 1, baseUnitId: null, ...stamp }))
  const catId = (n: string) => d.categories.find((c) => c.name === n)!.id
  const unitId = (n: string) => d.units.find((u) => u.name === n)!.id

  d.products = P.map((p): Product => ({
    id: p.id,
    tenantId,
    sku: p.sku,
    barcode: p.type === 'SERVICE' ? null : `478${String(R(100_000_000, 999_999_999))}`,
    name: p.name,
    description: '',
    categoryId: catId(p.cat),
    type: p.type,
    unitId: unitId(p.unit),
    salePrice: p.sale,
    purchasePrice: p.buy,
    vatRate: 12,
    trackingMode: 'NONE',
    isActive: true,
    reorderLevel: p.reorder,
    reorderQty: p.reorder * 2,
    leadTimeDays: p.type === 'RAW_MATERIAL' ? 7 : 14,
    imageTone: p.tone,
    defaultWarehouseId: p.type === 'RAW_MATERIAL' ? 'wh_raw' : p.type === 'FINISHED_GOOD' ? 'wh_fg' : p.type === 'GOODS' ? 'wh_main' : null,
    ...stamp,
  }))

  /* BOMs — standard cost drives finished-good avgCost */
  const bom = (id: string, productId: string, name: string, lines: { productId: string; qty: number; scrapPct: number }[], laborMin: number, energy: number, machineH: number): BillOfMaterials => {
    const matCost = sum(lines, (l) => l.qty * (1 + l.scrapPct / 100) * P.find((p) => p.id === l.productId)!.buy)
    const laborRate = 25_000
    const energyRate = 950
    const machineRate = 45_000
    const labor = (laborMin / 60) * laborRate
    const energyCost = energy * energyRate
    const machine = machineH * machineRate
    const overhead = (matCost + labor) * 0.12
    return {
      id,
      tenantId,
      productId,
      version: 'v2.1',
      name,
      outputQty: 1,
      lines: lines.map((l) => ({ ...l, operationId: null })),
      laborMinutes: laborMin,
      laborRatePerHour: laborRate,
      energyKwh: energy,
      energyRatePerKwh: energyRate,
      machineHours: machineH,
      machineRatePerHour: machineRate,
      overheadRate: 12,
      isActive: true,
      standardCost: Math.round(matCost + labor + energyCost + machine + overhead),
      ...stamp,
    }
  }
  d.boms = [
    bom('bom_stol_std', 'p_stol_std', 'Ofis stoli «Standart»', [
      { productId: 'p_ldsp', qty: 1.6, scrapPct: 6 },
      { productId: 'p_kromka', qty: 9, scrapPct: 4 },
      { productId: 'p_furnitura', qty: 1, scrapPct: 0 },
      { productId: 'p_metall', qty: 1, scrapPct: 0 },
    ], 95, 6.5, 1.2),
    bom('bom_stol_prm', 'p_stol_prm', 'Ofis stoli «Premium»', [
      { productId: 'p_mdf', qty: 2.1, scrapPct: 7 },
      { productId: 'p_kromka', qty: 12, scrapPct: 4 },
      { productId: 'p_furnitura', qty: 2, scrapPct: 0 },
      { productId: 'p_metall', qty: 1, scrapPct: 0 },
      { productId: 'p_lak', qty: 0.9, scrapPct: 5 },
    ], 180, 12, 2.4),
    bom('bom_kreslo', 'p_kreslo', 'Kreslo «Ergo»', [
      { productId: 'p_mdf', qty: 0.7, scrapPct: 5 },
      { productId: 'p_gazlift', qty: 1, scrapPct: 0 },
      { productId: 'p_furnitura', qty: 1, scrapPct: 0 },
      { productId: 'p_lak', qty: 0.4, scrapPct: 5 },
    ], 140, 8, 1.6),
    bom('bom_shkaf', 'p_shkaf', 'Shkaf «Arxiv»', [
      { productId: 'p_ldsp', qty: 3.4, scrapPct: 6 },
      { productId: 'p_kromka', qty: 22, scrapPct: 4 },
      { productId: 'p_furnitura', qty: 3, scrapPct: 0 },
    ], 210, 14, 2.8),
    bom('bom_tumba', 'p_tumba', 'Tumba 3 tortmali', [
      { productId: 'p_ldsp', qty: 0.9, scrapPct: 6 },
      { productId: 'p_kromka', qty: 7, scrapPct: 4 },
      { productId: 'p_furnitura', qty: 1, scrapPct: 0 },
    ], 70, 4, 0.9),
  ]
  const stdCost = (pid: string) => d.boms.find((b) => b.productId === pid)?.standardCost ?? P.find((p) => p.id === pid)!.buy

  /* machines */
  d.machines = [
    { id: 'mc_cnc', tenantId, name: 'CNC kesish markazi', code: 'MC-01', model: 'Biesse Rover K', state: 'RUNNING', capacityPerHour: 14, hourlyCost: 85_000, workshopBranchId: 'br_tosh', lastMaintenanceAt: addDays(nowDate, -22).toISOString(), nextMaintenanceAt: addDays(nowDate, 8).toISOString(), totalRuntimeHours: 4120, ...stamp },
    { id: 'mc_edge', tenantId, name: 'Kromkalash dastgohi', code: 'MC-02', model: 'Homag Ambition 1230', state: 'RUNNING', capacityPerHour: 40, hourlyCost: 42_000, workshopBranchId: 'br_tosh', lastMaintenanceAt: addDays(nowDate, -40).toISOString(), nextMaintenanceAt: addDays(nowDate, -2).toISOString(), totalRuntimeHours: 3890, ...stamp },
    { id: 'mc_press', tenantId, name: 'Gidravlik press', code: 'MC-03', model: 'Orma NPC 6/90', state: 'IDLE', capacityPerHour: 8, hourlyCost: 38_000, workshopBranchId: 'br_tosh', lastMaintenanceAt: addDays(nowDate, -10).toISOString(), nextMaintenanceAt: addDays(nowDate, 50).toISOString(), totalRuntimeHours: 2210, ...stamp },
    { id: 'mc_paint', tenantId, name: 'Loklash kamerasi', code: 'MC-04', model: 'Cefla Prima', state: 'MAINTENANCE', capacityPerHour: 6, hourlyCost: 55_000, workshopBranchId: 'br_tosh', lastMaintenanceAt: nowDate.toISOString(), nextMaintenanceAt: addDays(nowDate, 90).toISOString(), totalRuntimeHours: 1870, ...stamp },
    { id: 'mc_drill', tenantId, name: 'Ko‘p shpindelli parmalash', code: 'MC-05', model: 'SCM Startech 27', state: 'RUNNING', capacityPerHour: 30, hourlyCost: 30_000, workshopBranchId: 'br_tosh', lastMaintenanceAt: addDays(nowDate, -15).toISOString(), nextMaintenanceAt: addDays(nowDate, 45).toISOString(), totalRuntimeHours: 3010, ...stamp },
  ]

  /* counterparties */
  d.counterparties = [
    ...CUSTOMERS.map((c): Counterparty => ({
      id: c.id,
      tenantId,
      type: 'CUSTOMER',
      name: c.name,
      tin: c.tin || null,
      contactName: c.contact,
      phone: `+998 7${R(0, 9)} ${R(100, 999)} ${R(10, 99)} ${R(10, 99)}`,
      email: c.id === 'c_retail' ? '' : `info@${c.id.slice(2)}.uz`,
      address: 'Toshkent sh.',
      bankAccount: null,
      balance: 0,
      creditLimit: c.limit,
      paymentTermDays: c.terms,
      segment: c.segment,
      ownerMemberId: pick(['m_u_sardor', 'm_u_aziz']),
      isActive: true,
      riskScore: null,
      ...stamp,
    })),
    ...SUPPLIERS.map((s): Counterparty => ({
      id: s.id,
      tenantId,
      type: 'SUPPLIER',
      name: s.name,
      tin: s.tin,
      contactName: s.contact,
      phone: `+998 7${R(0, 9)} ${R(100, 999)} ${R(10, 99)} ${R(10, 99)}`,
      email: `sales@${s.id.slice(2)}.uz`,
      address: 'Toshkent sh.',
      bankAccount: `2020 8000 ${R(1000, 9999)} ${R(1000, 9999)} 0001`,
      balance: 0,
      creditLimit: 0,
      paymentTermDays: s.terms,
      segment: 'Ta‘minotchi',
      ownerMemberId: 'm_u_shahnoza',
      isActive: true,
      riskScore: null,
      ...stamp,
    })),
  ]

  /* accounting scaffolding */
  d.accounts = buildChartOfAccounts(tenantId, startIso)
  const ledger = new Ledger(d.accounts)
  const months: string[] = []
  for (let i = 0; i < 12; i++) {
    const m = new Date(start.getFullYear(), start.getMonth() + i, 1)
    months.push(m.toISOString().slice(0, 7))
  }
  d.periods = months.map((m, i): FiscalPeriod => {
    const s = new Date(`${m}-01T00:00:00Z`)
    const e = new Date(s.getFullYear(), s.getMonth() + 1, 0)
    const isPast = i < 10
    return {
      id: `per_${m}`,
      tenantId,
      label: m,
      startDate: isoDate(s),
      endDate: isoDate(e),
      status: isPast ? 'CLOSED' : i === 10 ? 'SOFT_CLOSE' : 'OPEN',
      closedAt: isPast ? addDays(e, 6).toISOString() : null,
      closedByMemberId: isPast ? 'm_u_dilnoza' : null,
      ...stamp,
    }
  })
  const periodFor = (date: string) => `per_${date.slice(0, 7)}`

  const counters: Record<string, number> = { JE: 0, SALE: 0, INV: 0, PAY: 0, PO: 0, PRD: 0, WO: 0, PR: 0, TRF: 0, CNT: 0 }
  const next = (k: string) => (counters[k] = (counters[k] ?? 0) + 1)
  const ctx = (memberId: string, at: string) => ({ tenantId, periodId: periodFor(at), memberId, number: docNumber('JE', next('JE'), new Date(at)), now: at })

  /* stock ledger (in-memory during generation) */
  const stockMap = new Map<string, StockBalance>()
  const sb = (pid: string, wid: string) => {
    const k = `${pid}|${wid}`
    let s = stockMap.get(k)
    if (!s) {
      s = { id: `stk_${pid}_${wid}`, tenantId, productId: pid, warehouseId: wid, onHand: 0, reserved: 0, inTransit: 0, avgCost: stdCost(pid), lastCountedAt: null, ...stamp }
      stockMap.set(k, s)
    }
    return s
  }
  const move = (pid: string, wid: string, type: InventoryMovement['type'], qty: number, unitCost: number, ref: string, refId: string | null, at: string, by: string, note = '') => {
    const s = sb(pid, wid)
    if (qty > 0 && s.onHand + qty > 0) {
      // moving-average cost on receipts
      s.avgCost = Math.round((s.onHand * s.avgCost + qty * unitCost) / (s.onHand + qty))
    }
    s.onHand += qty
    d.movements.push({
      id: `mv_${d.movements.length}`,
      tenantId,
      productId: pid,
      warehouseId: wid,
      type,
      qty,
      unitCost,
      value: Math.round(qty * unitCost),
      referenceType: ref,
      referenceId: refId,
      note,
      performedByMemberId: by,
      occurredAt: at,
      createdAt: at,
      updatedAt: at,
    })
  }

  /* opening balances */
  let openingInventory = 0
  for (const p of P) {
    for (const [wid, qty] of Object.entries(p.opening)) {
      const cost = stdCost(p.id)
      move(p.id, wid, 'OPENING', qty, cost, 'OPENING', null, startIso, 'm_u_dilnoza', "Boshlang'ich qoldiq")
      openingInventory += qty * cost
    }
  }
  const fixedAssetsCost = 1_240_000_000
  d.journal.push(
    postOpening(ledger, ctx('m_u_dilnoza', startIso), startIso, {
      cash: 38_000_000,
      bank: 412_000_000,
      inventory: Math.round(openingInventory),
      fixedAssets: fixedAssetsCost,
      equity: Math.round(38_000_000 + 412_000_000 + openingInventory + fixedAssetsCost - 350_000_000),
      loans: 350_000_000,
    }),
  )
  d.fixedAssets = [
    { id: 'fa1', tenantId, name: 'CNC kesish markazi Biesse', code: 'FA-001', category: 'Uskuna', acquiredAt: '2024-03-12', cost: 520_000_000, accumulatedDepreciation: 0, netBookValue: 0, usefulLifeMonths: 96, monthlyDepreciation: 5_416_667, branchId: 'br_tosh', status: 'IN_USE', ...stamp },
    { id: 'fa2', tenantId, name: 'Kromkalash dastgohi Homag', code: 'FA-002', category: 'Uskuna', acquiredAt: '2024-05-02', cost: 310_000_000, accumulatedDepreciation: 0, netBookValue: 0, usefulLifeMonths: 96, monthlyDepreciation: 3_229_167, branchId: 'br_tosh', status: 'IN_USE', ...stamp },
    { id: 'fa3', tenantId, name: 'Yuk mashinasi Isuzu NQR', code: 'FA-003', category: 'Transport', acquiredAt: '2023-11-20', cost: 280_000_000, accumulatedDepreciation: 0, netBookValue: 0, usefulLifeMonths: 84, monthlyDepreciation: 3_333_333, branchId: 'br_tosh', status: 'IN_USE', ...stamp },
    { id: 'fa4', tenantId, name: 'Ofis jihozlari va serverlar', code: 'FA-004', category: 'IT', acquiredAt: '2025-01-15', cost: 130_000_000, accumulatedDepreciation: 0, netBookValue: 0, usefulLifeMonths: 60, monthlyDepreciation: 2_166_667, branchId: 'br_tosh', status: 'IN_USE', ...stamp },
  ]
  const monthlyDep = sum(d.fixedAssets, (f) => f.monthlyDepreciation)

  /* -------- month loop */
  const salesReps = ['m_u_aziz', 'm_u_sardor', 'm_u_gulnora']
  const finished = P.filter((p) => p.type === 'FINISHED_GOOD')
  const goods = P.filter((p) => p.type === 'GOODS')
  const services = P.filter((p) => p.type === 'SERVICE')

  months.forEach((m, mi) => {
    const mStart = new Date(`${m}-01T09:00:00Z`)
    const daysInMonth = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getDate()
    const isCurrent = mi === months.length - 1
    const lastDay = isCurrent ? nowDate.getDate() : daysInMonth
    // seasonality: Q4 & spring stronger, summer softer
    const season = [1.0, 0.95, 1.05, 1.12, 1.08, 0.9, 0.85, 0.92, 1.05, 1.15, 1.2, 1.1][mStart.getMonth()]
    const growth = 1 + mi * 0.022
    const at = (day: number, h = 10) => new Date(Date.UTC(mStart.getFullYear(), mStart.getMonth(), Math.min(day, daysInMonth), h, R(0, 59))).toISOString()
    /* Receipts (purchases, production output) are applied chronologically so a sale
       on the 3rd can never consume stock that only arrives on the 12th. */
    const pending: { at: string; apply: () => void }[] = []
    const flush = (until: string) => {
      pending.sort((a, b) => a.at.localeCompare(b.at))
      while (pending.length && pending[0].at <= until) pending.shift()!.apply()
    }

    /* production orders — generated first so purchasing can be sized from the plan */
    const rawNeed = new Map<string, number>()
    const prodCount = isCurrent ? 4 : 6
    for (let i = 0; i < prodCount; i++) {
      const b = d.boms[(mi + i) % d.boms.length]
      const planned = R(40, 65)
      const day = R(5, Math.max(6, Math.min(16, lastDay - 3)))
      const startAt = at(day, 8)
      const endAt = addDays(startAt, R(2, 5)).toISOString()
      const done = endAt <= now && !(isCurrent && i === prodCount - 1)
      const status: ProductionOrder['status'] = done ? 'COMPLETED' : isCurrent ? (i === 0 ? 'QC' : 'IN_PROGRESS') : 'COMPLETED'
      const produced = done ? planned - R(0, 2) : status === 'QC' ? planned : Math.round(planned * 0.55)
      const scrap = done ? R(0, 2) : 0
      const matPlanned = sum(b.lines, (l) => l.qty * (1 + l.scrapPct / 100) * P.find((p) => p.id === l.productId)!.buy) * planned
      const matActual = matPlanned * (0.96 + rnd() * 0.1) * (produced / planned || 1)
      const laborPlanned = (b.laborMinutes / 60) * b.laborRatePerHour * planned
      const laborActual = laborPlanned * (0.95 + rnd() * 0.15) * (produced / planned || 1)
      const energyPlanned = b.energyKwh * b.energyRatePerKwh * planned
      const energyActual = energyPlanned * (0.9 + rnd() * 0.25) * (produced / planned || 1)
      const machinePlanned = b.machineHours * b.machineRatePerHour * planned
      const machineActual = machinePlanned * (0.95 + rnd() * 0.12) * (produced / planned || 1)
      const ohPlanned = (matPlanned + laborPlanned) * (b.overheadRate / 100)
      const ohActual = (matActual + laborActual) * (b.overheadRate / 100)
      const wastePlanned = matPlanned * 0.02
      const wasteActual = scrap > 0 ? (matActual / Math.max(1, produced)) * scrap : matActual * 0.012
      const order: ProductionOrder = {
        id: `prd_${m}_${i}`,
        tenantId,
        number: docNumber('PRD', next('PRD'), new Date(startAt)),
        bomId: b.id,
        productId: b.productId,
        plannedQty: planned,
        producedQty: status === 'IN_PROGRESS' ? produced : produced,
        scrapQty: scrap,
        status,
        warehouseId: 'wh_fg',
        branchId: 'br_tosh',
        plannedStart: startAt,
        plannedEnd: endAt,
        actualStart: startAt,
        actualEnd: done ? endAt : null,
        responsibleMemberId: 'm_u_otabek',
        workOrderIds: [],
        costs: [
          { component: 'MATERIAL', planned: Math.round(matPlanned), actual: Math.round(matActual) },
          { component: 'LABOR', planned: Math.round(laborPlanned), actual: Math.round(laborActual) },
          { component: 'ENERGY', planned: Math.round(energyPlanned), actual: Math.round(energyActual) },
          { component: 'MACHINE', planned: Math.round(machinePlanned), actual: Math.round(machineActual) },
          { component: 'OVERHEAD', planned: Math.round(ohPlanned), actual: Math.round(ohActual) },
          { component: 'WASTE', planned: Math.round(wastePlanned), actual: Math.round(wasteActual) },
        ],
        note: '',
        createdAt: startAt,
        updatedAt: done ? endAt : now,
      }
      // work orders
      const ops = ['Kesish', 'Kromkalash', 'Parmalash', 'Yig‘ish', 'Sifat nazorati']
      ops.forEach((_op, oi) => {
        const woDone = done || (status === 'QC' && oi < 4) || (status === 'IN_PROGRESS' && oi < 2)
        const wo: WorkOrder = {
          id: `wo_${m}_${i}_${oi}`,
          tenantId,
          number: docNumber('WO', next('WO'), new Date(startAt)),
          productionOrderId: order.id,
          operationId: `op_${oi}`,
          machineId: ['mc_cnc', 'mc_edge', 'mc_drill', null, null][oi],
          plannedQty: planned,
          completedQty: woDone ? produced : status === 'IN_PROGRESS' && oi === 2 ? Math.round(produced * 0.6) : 0,
          status: woDone ? 'DONE' : status === 'IN_PROGRESS' && oi === 2 ? 'RUNNING' : status === 'QC' && oi === 4 ? 'RUNNING' : 'PENDING',
          startedAt: woDone || oi <= 2 ? addDays(startAt, oi * 0.8).toISOString() : null,
          finishedAt: woDone ? addDays(startAt, oi * 0.8 + 0.7).toISOString() : null,
          workerMemberId: oi === 3 ? 'm_u_farrux' : null,
          laborMinutes: woDone ? Math.round((b.laborMinutes / 5) * produced) : 0,
          createdAt: startAt,
          updatedAt: now,
        }
        order.workOrderIds.push(wo.id)
        d.workOrders.push(wo)
      })
      // material issue at release — applied chronologically; ledger material cost = consumed value
      const consumeQty = status === 'IN_PROGRESS' ? produced : planned
      for (const l of b.lines) rawNeed.set(l.productId, (rawNeed.get(l.productId) ?? 0) + l.qty * (1 + l.scrapPct / 100) * consumeQty)
      pending.push({ at: startAt, apply: () => {
        let consumedValue = 0
        for (const l of b.lines) {
          const q = -Math.round(l.qty * (1 + l.scrapPct / 100) * consumeQty * 100) / 100
          const c = sb(l.productId, 'wh_raw').avgCost
          consumedValue += -q * c
          move(l.productId, 'wh_raw', 'PRODUCTION_CONSUME', q, c, 'PRODUCTION', order.id, startAt, 'm_u_otabek', order.number)
        }
        order.costs[0].actual = Math.round(consumedValue)
        d.journal.push(postMaterialIssue(ledger, ctx('m_u_otabek', startAt), order, startAt, Math.round(consumedValue)))
      } })
      if (done) {
        pending.push({ at: endAt, apply: () => {
          const unit = (sum(order.costs, (c) => c.actual) - order.costs[5].actual) / Math.max(1, produced)
          move(b.productId, 'wh_fg', 'PRODUCTION_OUTPUT', produced, Math.round(unit), 'PRODUCTION', order.id, endAt, 'm_u_otabek', order.number)
          if (scrap > 0) move(b.productId, 'wh_fg', 'SCRAP', 0, 0, 'PRODUCTION', order.id, endAt, 'm_u_otabek', `Brak ${scrap} dona`)
          d.journal.push(postProductionCompletion(ledger, ctx('m_u_dilnoza', endAt), order, endAt))
        } })
        d.qualityChecks.push({
          id: `qc_${m}_${i}`,
          tenantId,
          productionOrderId: order.id,
          checkedQty: produced + scrap,
          passQty: produced,
          failQty: scrap,
          result: scrap === 0 ? 'PASS' : scrap <= 1 ? 'CONCESSION' : 'FAIL',
          inspectorMemberId: null,
          note: scrap > 0 ? 'Kromka sifati past — qayta ishlashga yuborildi' : '',
          checkedAt: endAt,
          createdAt: endAt,
          updatedAt: endAt,
        })
      }
      d.productionOrders.push(order)
    }

    /* purchases: replenish raw + goods */
    const poCount = SUPPLIERS.length
    for (let i = 0; i < poCount; i++) {
      const sup = SUPPLIERS[i]
      const day = R(1, Math.min(3, lastDay))
      const orderedAt = at(day, 9)
      const lines = sup.supplies.map((pid) => {
        const p = P.find((x) => x.id === pid)!
        const onHand = sb(pid, p.type === 'RAW_MATERIAL' ? 'wh_raw' : 'wh_main').onHand
        // Raw: cover this month's production plan + safety; goods: refill toward 2× reorder plus expected sales.
        const target = p.type === 'RAW_MATERIAL' ? (rawNeed.get(pid) ?? 0) * 1.15 + p.reorder * 1.5 : p.reorder * 3.2 * season
        const qty = Math.max(0, Math.ceil(target - onHand))
        return { id: `pl_${pid}_${m}_${i}`, productId: pid, qty, unitPrice: Math.round(p.buy * (0.97 + rnd() * 0.06)), vatRate: 12, receivedQty: qty }
      }).filter((l) => l.qty > 0)
      if (!lines.length) continue
      const subtotal = sum(lines, (l) => l.qty * l.unitPrice)
      const vat = Math.round(subtotal * 0.12)
      const total = subtotal + vat
      const received = !isCurrent || day + 2 < lastDay
      const po: Purchase = {
        id: `po_${m}_${i}`,
        tenantId,
        number: docNumber('PO', next('PO'), new Date(orderedAt)),
        supplierId: sup.id,
        warehouseId: lines[0].productId.startsWith('p_qogoz') || sup.id === 's_import' || sup.id === 's_qogoz' ? 'wh_main' : 'wh_raw',
        status: received ? (rnd() < 0.8 ? 'PAID' : 'BILLED') : 'ORDERED',
        lines,
        subtotal,
        vatAmount: vat,
        total,
        paidAmount: 0,
        requestedByMemberId: 'm_u_shahnoza',
        approvedByMemberId: 'm_u_rustam',
        expectedAt: addDays(orderedAt, 7).toISOString(),
        receivedAt: received ? addDays(orderedAt, R(0, 2)).toISOString() : null,
        invoiceId: null,
        note: '',
        createdAt: orderedAt,
        updatedAt: orderedAt,
      }
      if (received) {
        const recAt = po.receivedAt!
        pending.push({ at: recAt, apply: () => { for (const l of lines) move(l.productId, po.warehouseId, 'PURCHASE_RECEIPT', l.qty, l.unitPrice, 'PURCHASE', po.id, recAt, 'm_u_kamol', po.number) } })
        d.journal.push(postPurchase(ledger, ctx('m_u_malika', recAt), po, recAt))
        const inv: Invoice = {
          id: `inv_in_${m}_${i}`,
          tenantId,
          number: `${sup.id.slice(2, 5).toUpperCase()}-${R(1000, 9999)}`,
          counterpartyId: sup.id,
          direction: 'IN',
          status: 'ISSUED',
          issueDate: isoDate(new Date(recAt)),
          dueDate: isoDate(addDays(recAt, sup.terms)),
          lines: lines.map((l) => ({ id: l.id, description: P.find((p) => p.id === l.productId)!.name, productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, vatRate: 12, total: Math.round(l.qty * l.unitPrice * 1.12) })),
          subtotal,
          vatAmount: vat,
          total,
          paidAmount: 0,
          currency: 'UZS',
          saleId: null,
          purchaseId: po.id,
          note: '',
          createdAt: recAt,
          updatedAt: recAt,
        }
        po.invoiceId = inv.id
        if (po.status === 'PAID') {
          const paidAt = addDays(recAt, R(3, sup.terms)).toISOString()
          if (paidAt <= now) {
            const pay: Payment = {
              id: `pay_out_${m}_${i}`,
              tenantId,
              number: docNumber('PAY', next('PAY'), new Date(paidAt)),
              direction: 'OUT',
              invoiceId: inv.id,
              counterpartyId: sup.id,
              method: 'BANK_TRANSFER',
              amount: total,
              accountId: ledger.sys('BANK_MAIN').id,
              bankAccountId: 'bank_main',
              status: 'RECONCILED',
              requiresApproval: total > 50_000_000,
              approvedByMemberId: 'm_u_rustam',
              paidAt,
              reference: `PP-${R(100000, 999999)}`,
              note: '',
              recordedByMemberId: 'm_u_malika',
              createdAt: paidAt,
              updatedAt: paidAt,
            }
            d.payments.push(pay)
            d.journal.push(postPayment(ledger, ctx('m_u_malika', paidAt), pay))
            inv.paidAmount = total
            inv.status = 'PAID'
            po.paidAmount = total
          } else {
            po.status = 'BILLED'
          }
        }
        if (inv.status !== 'PAID' && inv.dueDate < today) inv.status = 'OVERDUE'
        d.invoices.push(inv)
      }
      d.purchases.push(po)
    }

    /* sales */
    const saleCount = Math.round(42 * season * growth) + (isCurrent ? -Math.round(42 * (1 - lastDay / daysInMonth)) : 0)
    const saleDays = Array.from({ length: Math.max(4, saleCount) }, () => R(1, lastDay)).sort((a, b) => a - b)
    for (let i = 0; i < saleDays.length; i++) {
      const day = saleDays[i]
      const soldAt = at(day, R(9, 18))
      flush(soldAt)
      const isRetail = rnd() < 0.35
      const cust = isRetail ? CUSTOMERS.find((c) => c.id === 'c_retail')! : pick(CUSTOMERS.filter((c) => c.id !== 'c_retail'))
      const rep = isRetail ? pick(['m_u_aziz', 'm_u_gulnora']) : pick(salesReps)
      const branchId = rnd() < 0.22 ? 'br_smq' : 'br_tosh'
      const lineCount = isRetail ? R(1, 2) : R(1, 4)
      const lines: Sale['lines'] = []
      const usedPids = new Set<string>()
      for (let li = 0; li < lineCount; li++) {
        const pool = isRetail ? [...goods, ...finished.slice(0, 2)] : rnd() < 0.7 ? finished : rnd() < 0.5 ? goods : services
        const p = pick(pool)
        if (usedPids.has(p.id)) continue
        usedPids.add(p.id)
        const wid = p.type === 'SERVICE' ? 'wh_main' : branchId === 'br_smq' && sb(p.id, 'wh_smq').onHand > 0 ? 'wh_smq' : p.type === 'FINISHED_GOOD' ? 'wh_fg' : 'wh_main'
        const stock = p.type === 'SERVICE' ? Infinity : sb(p.id, wid).onHand
        const want = isRetail ? R(1, 3) : p.type === 'FINISHED_GOOD' ? R(2, 9) : p.type === 'SERVICE' ? R(1, 6) : R(3, 20)
        const qty = Math.min(want, Math.floor(stock))
        if (qty <= 0) continue
        const unitCost = p.type === 'SERVICE' ? 0 : sb(p.id, wid).avgCost
        lines.push({ id: `sl_${m}_${i}_${li}`, productId: p.id, warehouseId: wid, qty, unitPrice: p.sale, discountPct: isRetail ? 0 : pick([0, 0, 0, 3, 5, 7]), vatRate: 12, unitCost })
      }
      if (!lines.length) continue
      const gross = sum(lines, (l) => l.qty * l.unitPrice * (1 - l.discountPct / 100))
      const total = Math.round(gross) // VAT-inclusive pricing (UZ retail convention)
      const vat = Math.round(total - total / 1.12)
      const cogs = Math.round(sum(lines, (l) => l.qty * l.unitCost))
      const method: Sale['paymentMethod'] = isRetail ? pick(['CASH', 'CARD', 'PAYME', 'CLICK']) : cust.terms === 0 ? 'BANK_TRANSFER' : rnd() < 0.3 ? 'BANK_TRANSFER' : 'CREDIT'
      const paidNow = method === 'CREDIT' ? 0 : total
      const sale: Sale = {
        id: `sale_${m}_${i}`,
        tenantId,
        number: docNumber('S', next('SALE'), new Date(soldAt)),
        customerId: cust.id,
        branchId,
        warehouseId: lines[0].warehouseId,
        status: paidNow >= total ? 'PAID' : 'INVOICED',
        lines,
        discountPct: 0,
        vatAmount: vat,
        total,
        cogs,
        paymentMethod: method,
        paidAmount: paidNow,
        dueAt: method === 'CREDIT' ? addDays(soldAt, cust.terms).toISOString() : null,
        channel: isRetail ? 'RETAIL' : cust.segment === 'Diler' ? 'WHOLESALE' : 'B2B',
        soldByMemberId: rep,
        invoiceId: null,
        note: '',
        occurredAt: soldAt,
        createdAt: soldAt,
        updatedAt: soldAt,
      }
      for (const l of lines) {
        const p = P.find((x) => x.id === l.productId)!
        if (p.type !== 'SERVICE') move(l.productId, l.warehouseId, 'SALES_ISSUE', -l.qty, l.unitCost, 'SALE', sale.id, soldAt, rep, sale.number)
      }
      d.journal.push(postSale(ledger, ctx(rep, soldAt), sale))
      // invoice for every B2B sale
      if (!isRetail) {
        const inv: Invoice = {
          id: `inv_out_${m}_${i}`,
          tenantId,
          number: docNumber('INV', next('INV'), new Date(soldAt)),
          counterpartyId: cust.id,
          direction: 'OUT',
          status: paidNow >= total ? 'PAID' : 'ISSUED',
          issueDate: isoDate(new Date(soldAt)),
          dueDate: isoDate(addDays(soldAt, Math.max(cust.terms, 7))),
          lines: lines.map((l) => ({ id: l.id, description: P.find((p) => p.id === l.productId)!.name, productId: l.productId, qty: l.qty, unitPrice: l.unitPrice, vatRate: 12, total: Math.round(l.qty * l.unitPrice * (1 - l.discountPct / 100)) })),
          subtotal: total - vat,
          vatAmount: vat,
          total,
          paidAmount: paidNow,
          currency: 'UZS',
          saleId: sale.id,
          purchaseId: null,
          note: '',
          createdAt: soldAt,
          updatedAt: soldAt,
        }
        sale.invoiceId = inv.id
        if (method === 'CREDIT') {
          // most credit invoices get paid — some late, a few still open
          const r = rnd()
          const payDelay = r < 0.62 ? R(3, cust.terms) : r < 0.93 ? cust.terms + R(1, 25) : cust.terms + R(60, 130)
          const paidAt = addDays(soldAt, payDelay).toISOString()
          if (paidAt <= now) {
            const pay: Payment = {
              id: `pay_in_${m}_${i}`,
              tenantId,
              number: docNumber('PAY', next('PAY'), new Date(paidAt)),
              direction: 'IN',
              invoiceId: inv.id,
              counterpartyId: cust.id,
              method: 'BANK_TRANSFER',
              amount: total,
              accountId: ledger.sys('BANK_MAIN').id,
              bankAccountId: 'bank_main',
              status: 'RECONCILED',
              requiresApproval: false,
              approvedByMemberId: null,
              paidAt,
              reference: `TR-${R(100000, 999999)}`,
              note: '',
              recordedByMemberId: 'm_u_malika',
              createdAt: paidAt,
              updatedAt: paidAt,
            }
            d.payments.push(pay)
            d.journal.push(postPayment(ledger, ctx('m_u_malika', paidAt), pay))
            inv.paidAmount = total
            inv.status = 'PAID'
            sale.paidAmount = total
            sale.status = 'PAID'
          } else if (rnd() < 0.3 && soldAt < addDays(nowDate, -10).toISOString()) {
            // partial payment
            const part = Math.round(total * pick([0.3, 0.5, 0.6]))
            const paidAt = addDays(soldAt, R(5, 20)).toISOString()
            const pay: Payment = {
              id: `pay_part_${m}_${i}`,
              tenantId,
              number: docNumber('PAY', next('PAY'), new Date(paidAt)),
              direction: 'IN',
              invoiceId: inv.id,
              counterpartyId: cust.id,
              method: 'BANK_TRANSFER',
              amount: part,
              accountId: ledger.sys('BANK_MAIN').id,
              bankAccountId: 'bank_main',
              status: 'RECONCILED',
              requiresApproval: false,
              approvedByMemberId: null,
              paidAt,
              reference: `TR-${R(100000, 999999)}`,
              note: 'Qisman to‘lov',
              recordedByMemberId: 'm_u_malika',
              createdAt: paidAt,
              updatedAt: paidAt,
            }
            d.payments.push(pay)
            d.journal.push(postPayment(ledger, ctx('m_u_malika', paidAt), pay))
            inv.paidAmount = part
            inv.status = 'PARTIALLY_PAID'
            sale.paidAmount = part
            sale.status = 'PARTIALLY_PAID'
          }
          if (inv.status !== 'PAID' && inv.dueDate < today) inv.status = 'OVERDUE'
        } else {
          // paid immediately by transfer → payment record for the bank trail
          d.payments.push({
            id: `pay_imm_${m}_${i}`,
            tenantId,
            number: docNumber('PAY', next('PAY'), new Date(soldAt)),
            direction: 'IN',
            invoiceId: inv.id,
            counterpartyId: cust.id,
            method: 'BANK_TRANSFER',
            amount: total,
            accountId: ledger.sys('BANK_MAIN').id,
            bankAccountId: 'bank_main',
            status: 'RECONCILED',
            requiresApproval: false,
            approvedByMemberId: null,
            paidAt: soldAt,
            reference: `TR-${R(100000, 999999)}`,
            note: 'Savdo bilan birga',
            recordedByMemberId: rep,
            createdAt: soldAt,
            updatedAt: soldAt,
          })
        }
        d.invoices.push(inv)
      } else {
        d.payments.push({
          id: `pay_pos_${m}_${i}`,
          tenantId,
          number: docNumber('PAY', next('PAY'), new Date(soldAt)),
          direction: 'IN',
          invoiceId: null,
          counterpartyId: 'c_retail',
          method,
          amount: total,
          accountId: method === 'CASH' ? ledger.sys('CASH').id : ledger.sys('BANK_MAIN').id,
          bankAccountId: method === 'CASH' ? null : 'bank_main',
          status: 'POSTED',
          requiresApproval: false,
          approvedByMemberId: null,
          paidAt: soldAt,
          reference: method === 'CASH' ? 'Kassa' : `${method}-${R(100000, 999999)}`,
          note: 'Chakana savdo',
          recordedByMemberId: rep,
          createdAt: soldAt,
          updatedAt: soldAt,
        })
      }
      d.sales.push(sale)
    }
    flush('9999')

    /* operating expenses */
    const expAt = (day: number) => at(Math.min(day, lastDay), 11)
    const expenses: [Parameters<typeof postExpense>[3], number, string, number][] = [
      ['RENT', 32_000_000, 'Ofis va zavod ijarasi', 3],
      ['UTILITIES', Math.round((10_000_000 + rnd() * 3_000_000) * (mStart.getMonth() < 3 || mStart.getMonth() > 9 ? 1.35 : 1)), 'Elektr, gaz, suv', 8],
      ['MARKETING', Math.round(7_500_000 * (mi >= 9 ? 1.18 * (1 + (mi - 9) * 0.05) : 1) * (0.9 + rnd() * 0.2)), 'Reklama va marketing', 12],
      ['LOGISTICS', Math.round(8_500_000 * season * (0.9 + rnd() * 0.25)), 'Yetkazib berish va transport', 15],
    ]
    for (const [key, amount, memo, day] of expenses) {
      if (isCurrent && day > lastDay) continue
      d.journal.push(postExpense(ledger, ctx('m_u_malika', expAt(day)), expAt(day), key, amount, memo))
    }

    /* payroll */
    const runStatus: PayrollRun['status'] = isCurrent ? 'DRAFT' : 'PAID'
    if (!isCurrent || lastDay > 20) {
      const perEnd = isoDate(new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0))
      const gross = sum(d.employees, (e) => e.baseSalary) + (mi === 11 - 1 ? 0 : 0)
      const pit = Math.round(gross * 0.12)
      const social = Math.round(gross * 0.12)
      const net = gross - pit
      const paidAt = isCurrent ? null : addDays(perEnd, 5).toISOString()
      const run: PayrollRun = {
        id: `pr_${m}`,
        tenantId,
        number: docNumber('PR', next('PR'), mStart),
        periodLabel: m,
        periodStart: isoDate(mStart),
        periodEnd: perEnd,
        status: runStatus,
        headcount: d.employees.length,
        grossTotal: gross,
        taxTotal: pit + social,
        netTotal: net,
        payslips: [],
        approvedByMemberId: isCurrent ? null : 'm_u_rustam',
        paidAt,
        createdAt: `${perEnd}T10:00:00.000Z`,
        updatedAt: paidAt ?? now,
      }
      d.employees.forEach((e) => {
        const bonus = e.departmentId === deptId('Savdo') ? Math.round(e.baseSalary * 0.08 * season) : 0
        const g = e.baseSalary + bonus
        const t = Math.round(g * 0.12)
        const slip: Payslip = {
          id: `ps_${m}_${e.id}`,
          tenantId,
          payrollRunId: run.id,
          employeeId: e.id,
          periodLabel: m,
          lines: [
            { label: 'Lavozim maoshi', kind: 'EARNING', amount: e.baseSalary },
            ...(bonus ? [{ label: 'Savdo bonusi', kind: 'EARNING' as const, amount: bonus }] : []),
            { label: 'JShDS 12%', kind: 'TAX', amount: t },
          ],
          gross: g,
          deductions: t,
          net: g - t,
          createdAt: run.createdAt,
          updatedAt: run.createdAt,
        }
        run.payslips.push(slip.id)
        d.payslips.push(slip)
      })
      run.grossTotal = sum(d.payslips.filter((s) => s.payrollRunId === run.id), (s) => s.gross)
      run.netTotal = sum(d.payslips.filter((s) => s.payrollRunId === run.id), (s) => s.net)
      run.taxTotal = run.grossTotal - run.netTotal + Math.round(run.grossTotal * 0.12)
      d.payrollRuns.push(run)
      if (!isCurrent) d.journal.push(...postPayroll(ledger, ctx('m_u_dilnoza', `${perEnd}T18:00:00.000Z`), run, true))
    }

    /* depreciation */
    if (!isCurrent) d.journal.push(postDepreciation(ledger, ctx('m_u_dilnoza', `${isoDate(new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0))}T19:00:00.000Z`), `${isoDate(new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0))}T19:00:00.000Z`, monthlyDep))
  })

  /* fixed asset NBV (12 months of depreciation in this ledger) */
  d.fixedAssets.forEach((f) => {
    const monthsSince = Math.max(0, Math.round((nowDate.getTime() - new Date(f.acquiredAt).getTime()) / (30.4 * 86_400_000)))
    f.accumulatedDepreciation = Math.min(f.cost, f.monthlyDepreciation * monthsSince)
    f.netBookValue = f.cost - f.accumulatedDepreciation
  })

  /* stock: freeze from generator + a couple of low-stock signals */
  d.stock = [...stockMap.values()].map((s) => ({ ...s, onHand: Math.round(s.onHand * 100) / 100 }))
  const reserve = (pid: string, wid: string, q: number) => {
    const s = d.stock.find((x) => x.productId === pid && x.warehouseId === wid)
    if (s) s.reserved = Math.min(q, Math.max(0, s.onHand))
  }
  reserve('p_stol_prm', 'wh_fg', 6)
  reserve('p_kreslo', 'wh_fg', 4)

  /* transfers */
  const trAt = addDays(nowDate, -2).toISOString()
  d.transfers = [
    { id: 'trf_1', tenantId, number: docNumber('TRF', next('TRF'), nowDate), fromWarehouseId: 'wh_fg', toWarehouseId: 'wh_smq', status: 'IN_TRANSIT', lines: [{ productId: 'p_stol_std', qty: 6, receivedQty: 0 }, { productId: 'p_tumba', qty: 10, receivedQty: 0 }], shippedAt: trAt, receivedAt: null, createdAt: trAt, updatedAt: trAt },
    { id: 'trf_2', tenantId, number: docNumber('TRF', next('TRF'), nowDate), fromWarehouseId: 'wh_main', toWarehouseId: 'wh_smq', status: 'RECEIVED', lines: [{ productId: 'p_qogoz', qty: 40, receivedQty: 40 }], shippedAt: addDays(nowDate, -9).toISOString(), receivedAt: addDays(nowDate, -7).toISOString(), createdAt: addDays(nowDate, -9).toISOString(), updatedAt: addDays(nowDate, -7).toISOString() },
  ]
  for (const t of d.transfers) {
    if (t.status === 'IN_TRANSIT') {
      for (const l of t.lines) {
        const s = d.stock.find((x) => x.productId === l.productId && x.warehouseId === t.fromWarehouseId)
        const dst = d.stock.find((x) => x.productId === l.productId && x.warehouseId === t.toWarehouseId)
        if (!s || s.onHand - s.reserved < l.qty) {
          l.qty = Math.max(0, Math.floor((s?.onHand ?? 0) - (s?.reserved ?? 0)))
        }
        if (s) s.onHand -= l.qty
        if (dst) dst.inTransit += l.qty
        else d.stock.push({ id: `stk_${l.productId}_${t.toWarehouseId}`, tenantId, productId: l.productId, warehouseId: t.toWarehouseId, onHand: 0, reserved: 0, inTransit: l.qty, avgCost: s?.avgCost ?? stdCost(l.productId), lastCountedAt: null, ...stamp })
      }
    }
  }

  /* bank accounts derived from ledger */
  d.bankAccounts = [
    { id: 'bank_main', tenantId, name: 'Asosiy hisob (UZS)', bankName: 'Kapitalbank ATB', accountNumber: '2020 8000 1052 4871 0001', mfo: '01088', currency: 'UZS', balance: 0, openingBalance: 412_000_000, isActive: true, accountId: ledger.sys('BANK_MAIN').id, feedConnected: false, ...stamp },
    { id: 'bank_usd', tenantId, name: 'Valyuta hisobi (USD)', bankName: 'Kapitalbank ATB', accountNumber: '2020 8840 1052 4871 0002', mfo: '01088', currency: 'USD', balance: 14_200, openingBalance: 14_200, isActive: true, accountId: d.accounts.find((a) => a.code === '5210')!.id, feedConnected: false, ...stamp },
  ]
  // unmatched statement lines for reconciliation demo
  d.bankLines = d.payments
    .filter((p) => p.bankAccountId === 'bank_main' && p.paidAt > addDays(nowDate, -14).toISOString())
    .slice(0, 12)
    .map((p, i) => ({
      id: `bl_${i}`,
      tenantId,
      bankAccountId: 'bank_main',
      date: isoDate(new Date(p.paidAt)),
      description: `${p.direction === 'IN' ? 'Kirim' : 'Chiqim'} · ${d.counterparties.find((c) => c.id === p.counterpartyId)?.name ?? ''} · ${p.reference}`,
      amount: p.direction === 'IN' ? p.amount : -p.amount,
      matchedPaymentId: i < 8 ? p.id : null,
      matched: i < 8,
      createdAt: p.paidAt,
      updatedAt: p.paidAt,
    }))
  d.bankLines.push({ id: 'bl_x1', tenantId, bankAccountId: 'bank_main', date: isoDate(addDays(nowDate, -1)), description: 'Bank xizmat haqi', amount: -185_000, matchedPaymentId: null, matched: false, createdAt: now, updatedAt: now })

  /* taxes: derived from ledger VAT accounts of last closed month */
  const lastClosed = months[10]
  const tb = (code: string, m: string) => {
    let deb = 0
    let cred = 0
    const acc = d.accounts.find((a) => a.code === code)!
    for (const e of d.journal) if (e.date.startsWith(m)) for (const l of e.lines) if (l.accountId === acc.id) (deb += l.debit), (cred += l.credit)
    return { deb, cred }
  }
  const vatOut = tb('6411', lastClosed).cred
  const vatIn = tb('4410', lastClosed).deb
  const revLast = tb('9010', lastClosed).cred
  d.taxes = [
    { id: 'tax_vat', tenantId, taxType: 'VAT', periodLabel: lastClosed, periodStart: `${lastClosed}-01`, periodEnd: `${lastClosed}-30`, base: revLast, rate: 12, amount: Math.max(0, vatOut - vatIn), dueDate: isoDate(addDays(new Date(`${months[11]}-01`), 19)), status: 'DRAFT', filedAt: null, ...stamp },
    { id: 'tax_pit', tenantId, taxType: 'PAYROLL', periodLabel: lastClosed, periodStart: `${lastClosed}-01`, periodEnd: `${lastClosed}-30`, base: d.payrollRuns[10]?.grossTotal ?? 0, rate: 12, amount: d.payrollRuns[10]?.taxTotal ?? 0, dueDate: isoDate(addDays(new Date(`${months[11]}-01`), 14)), status: 'FILED', filedAt: addDays(new Date(`${months[11]}-01`), 9).toISOString(), ...stamp },
    { id: 'tax_income', tenantId, taxType: 'INCOME', periodLabel: `${nowDate.getFullYear()} Q3`, periodStart: `${nowDate.getFullYear()}-07-01`, periodEnd: `${nowDate.getFullYear()}-09-30`, base: 0, rate: 15, amount: 0, dueDate: `${nowDate.getFullYear()}-10-20`, status: 'DRAFT', filedAt: null, ...stamp },
  ]

  /* attendance (last 7 days) + leave */
  for (let day = 6; day >= 0; day--) {
    const dt = addDays(nowDate, -day)
    if (dt.getDay() === 0) continue
    for (const e of d.employees) {
      const r = rnd()
      const state: AttendanceRecord['state'] = r < 0.86 ? 'PRESENT' : r < 0.92 ? 'LATE' : r < 0.96 ? 'LEAVE' : 'SICK'
      d.attendance.push({ id: `att_${day}_${e.id}`, tenantId, employeeId: e.id, date: isoDate(dt), state, clockIn: state === 'PRESENT' ? '08:5' + R(0, 9) : state === 'LATE' ? '09:' + R(15, 45) : null, clockOut: state === 'PRESENT' || state === 'LATE' ? '18:0' + R(0, 9) : null, overtimeHours: rnd() < 0.1 ? 2 : 0, ...stamp })
    }
  }
  d.leaves = [
    { id: 'lv1', tenantId, employeeId: 'emp_5', type: 'ANNUAL', startDate: isoDate(addDays(nowDate, 6)), endDate: isoDate(addDays(nowDate, 17)), days: 12, status: 'PENDING', approvedByMemberId: null, note: 'Yillik ta‘til', ...stamp },
    { id: 'lv2', tenantId, employeeId: 'emp_16', type: 'SICK', startDate: isoDate(addDays(nowDate, -2)), endDate: isoDate(addDays(nowDate, 1)), days: 4, status: 'APPROVED', approvedByMemberId: 'm_u_nilufar', note: 'Kasallik varaqasi', ...stamp },
    { id: 'lv3', tenantId, employeeId: 'emp_8', type: 'UNPAID', startDate: isoDate(addDays(nowDate, 10)), endDate: isoDate(addDays(nowDate, 12)), days: 3, status: 'PENDING', approvedByMemberId: null, note: 'Oilaviy sabab', ...stamp },
  ]

  /* subscription invoices — none yet (trial); simulated attempt history empty */

  /* notifications (role-targeted) */
  const notif = (kind: Notification['kind'], sev: Notification['severity'], title: string, body: string, roles: RoleId[], link: string | null, hoursAgo: number): Notification => ({
    id: `nt_${d.notifications.length}`,
    tenantId,
    kind,
    severity: sev,
    title,
    body,
    audienceRoles: roles,
    audienceMemberId: null,
    link,
    readAt: null,
    readByMemberIds: [],
    createdAt: new Date(nowDate.getTime() - hoursAgo * 3_600_000).toISOString(),
    updatedAt: now,
  })
  const lowItems = d.stock.filter((s) => {
    const p = P.find((x) => x.id === s.productId)!
    return p.reorder > 0 && s.onHand - s.reserved <= p.reorder
  })
  const overdueOut = d.invoices.filter((i) => i.direction === 'OUT' && i.status === 'OVERDUE')
  d.notifications.push(
    notif('TRIAL_EXPIRING', 'INFO', 'Sinov muddati', `Sinov muddati tugashiga 27 kun qoldi.`, ['OWNER', 'ADMIN'], '/app/settings/billing', 2),
    notif('LOW_STOCK', 'WARNING', 'Zaxira tugayapti', `${lowItems.length} ta mahsulot minimal zaxira darajasidan past.`, ['OWNER', 'ADMIN', 'DIRECTOR', 'WAREHOUSE_MANAGER', 'WAREHOUSE_EMPLOYEE', 'PURCHASING_MANAGER'], '/app/inventory/stock', 3),
    notif('OVERDUE_PAYMENT', 'CRITICAL', 'Muddati o‘tgan to‘lovlar', `${overdueOut.length} ta mijoz fakturasi muddati o‘tgan.`, ['OWNER', 'ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'SALES_MANAGER'], '/app/invoices', 5),
    notif('APPROVAL_REQUEST', 'INFO', 'Tasdiqlash so‘rovi', 'Ta‘til arizasi: Aziz Tursunov, 12 kun.', ['OWNER', 'ADMIN', 'HR_MANAGER', 'DIRECTOR'], '/app/hr/leave', 7),
    notif('PRODUCTION_WARNING', 'WARNING', 'Uskuna texnik xizmati', 'Kromkalash dastgohi (MC-02) texnik xizmat muddati 2 kun o‘tgan.', ['OWNER', 'ADMIN', 'DIRECTOR', 'PRODUCTION_MANAGER'], '/app/manufacturing/machines', 9),
    notif('AI_INSIGHT', 'INFO', 'AI CFO xulosasi', 'Marketing xarajatlari o‘tgan oyga nisbatan oshgan. Batafsil tahlil tayyor.', ['OWNER', 'ADMIN', 'DIRECTOR', 'CHIEF_ACCOUNTANT'], '/app/ai', 12),
    notif('INVOICE_DUE', 'INFO', 'Faktura muddati yaqin', '3 ta ta‘minotchi fakturasi 5 kun ichida to‘lanishi kerak.', ['OWNER', 'ADMIN', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'PURCHASING_MANAGER'], '/app/payments', 20),
    notif('APPROVAL_REQUEST', 'INFO', 'Xarid talabi', 'LDSP plita 200 list — Shahnoza Abdullayeva tasdiq kutmoqda.', ['OWNER', 'ADMIN', 'DIRECTOR', 'PURCHASING_MANAGER'], '/app/purchasing', 26),
    notif('SYSTEM', 'SUCCESS', 'Davr yopildi', `${months[9]} davri muvaffaqiyatli yopildi.`, ['OWNER', 'ADMIN', 'CHIEF_ACCOUNTANT', 'ACCOUNTANT', 'AUDITOR'], '/app/accounting/periods', 72),
  )

  /* audit trail sample */
  const audit = (action: Parameters<typeof mkAudit>[1], actor: string, entityType: string, summary: string, perm: string | null, hoursAgo: number) => d.audit.push(mkAudit(tenantId, action, actor, d.members.find((m) => m.id === actor)?.fullName ?? actor, entityType, summary, perm, new Date(nowDate.getTime() - hoursAgo * 3_600_000).toISOString()))
  audit('DENIED_ACCESS', 'm_u_aziz', 'Report', "P&L hisobotiga kirish urinishi rad etildi", 'finance.profit.view', 1)
  audit('AI_QUERY', 'm_u_aziz', 'AIConversation', "So'rov: 'Bugungi kompaniya foydasi qancha?' — foyda ko'lami rad etildi", 'ai.view', 1.2)
  audit('CREATE', 'm_u_aziz', 'Sale', `Savdo ${d.sales.at(-1)?.number} yaratildi`, 'sales.create', 2)
  audit('PERMISSION_CHANGE', 'm_u_jasur', 'Member', "Sardor Aliyev: finance.cost.view = true (shaxsiy o'zgartirish)", 'roles.edit', 30)
  audit('APPROVE', 'm_u_rustam', 'Payment', "To'lov tasdiqlandi — Kronospan 58 400 000 so'm", 'payments.approve', 40)
  audit('EXPORT', 'm_u_dilnoza', 'Report', 'Sinov balansi Excel eksport', 'reports.export', 52)
  audit('LOGIN', 'm_u_umida', 'Session', 'Kirish — Chrome / macOS', null, 60)
  audit('UPDATE', 'm_u_bobur', 'StockCount', 'Inventarizatsiya WH-01 yakunlandi', 'stockcounts.edit', 80)
  audit('APPROVE', 'm_u_dilnoza', 'FiscalPeriod', `${months[9]} davri yopildi`, 'periodclose.approve', 100)

  d.counters = counters
  return d
}

function mkAudit(tenantId: string, action: import('@/core/domain/enums').AuditAction, actorMemberId: string, actorLabel: string, entityType: string, summary: string, permissionRequired: string | null, at: string) {
  return {
    id: `au_${at}_${Math.random().toString(36).slice(2, 6)}`,
    tenantId,
    action,
    actorMemberId,
    actorUserId: actorMemberId.replace('m_', ''),
    actorLabel,
    entityType,
    entityId: null,
    summary,
    before: null,
    after: null,
    permissionRequired: permissionRequired as import('@/core/rbac/permissions').PermissionKey | null,
    ipLabel: '213.230.' + (Math.floor(Math.random() * 200) + 10) + '.x',
    createdAt: at,
  }
}

/* ======================================================= light tenants */

interface LightArgs {
  tenantId: string
  name: string
  legalName: string
  tin: string
  industry: Industry
  businessType: BusinessType
  plan: PlanId
  status: SubscriptionStatus
  ownerName: string
  ownerEmail: string
  ownerId: string
  city: string
  createdAt: string
  nowDate: Date
}

function buildLightTenant(a: LightArgs): TenantData {
  const now = a.nowDate.toISOString()
  const company: Company = {
    id: a.tenantId,
    tenantId: a.tenantId,
    name: a.name,
    legalName: a.legalName,
    tin: a.tin,
    vatCertificate: null,
    industry: a.industry,
    businessType: a.businessType,
    ownerUserId: a.ownerId,
    directorName: a.ownerName,
    chiefAccountantName: null,
    phone: '+998 66 200 00 00',
    email: `info@${a.tenantId.slice(2)}.uz`,
    address: `${a.city} sh.`,
    bankName: null,
    bankAccount: null,
    bankMfo: null,
    baseCurrency: 'UZS',
    fiscalYearStartMonth: 1,
    vatRate: 12,
    turnoverTaxRate: 4,
    isDemo: false,
    status: a.status === 'ACTIVE' ? 'ACTIVE' : a.status === 'TRIAL' ? 'TRIAL' : 'ACTIVE',
    employeeCount: 1,
    logoTone: 'gold',
    createdAt: a.createdAt,
    updatedAt: now,
  }
  const trialEnd = addDays(a.createdAt, 30).toISOString()
  const subscription: Subscription = {
    id: `sub_${a.tenantId}`,
    tenantId: a.tenantId,
    planId: a.plan,
    status: a.status,
    billingCycle: 'MONTHLY',
    trialStart: a.createdAt,
    trialEnd,
    startedAt: a.status === 'ACTIVE' ? trialEnd : null,
    currentPeriodStart: a.status === 'ACTIVE' ? addDays(a.nowDate, -12).toISOString() : null,
    currentPeriodEnd: a.status === 'ACTIVE' ? addDays(a.nowDate, 18).toISOString() : null,
    renewalAt: a.status === 'ACTIVE' ? addDays(a.nowDate, 18).toISOString() : null,
    cancelledAt: null,
    paymentStatus: a.status === 'ACTIVE' ? 'PAID' : 'UNPAID',
    seatsUsed: 1,
    trialExtendedDays: 0,
    provider: a.status === 'ACTIVE' ? 'BANK_TRANSFER' : null,
    createdAt: a.createdAt,
    updatedAt: now,
  }
  const d = emptyTenantData(company, subscription)
  const stamp = { createdAt: a.createdAt, updatedAt: now }
  d.branches = [{ id: `${a.tenantId}_br`, tenantId: a.tenantId, name: `${a.city} — bosh ofis`, code: 'HQ', city: a.city, address: `${a.city} sh.`, phone: company.phone, managerMemberId: null, isActive: true, ...stamp }]
  d.warehouses = [{ id: `${a.tenantId}_wh`, tenantId: a.tenantId, name: 'Asosiy ombor', code: 'WH-01', branchId: d.branches[0].id, type: 'MAIN', address: `${a.city} sh.`, managerMemberId: null, isActive: true, ...stamp }]
  d.members = [{ id: `m_${a.ownerId}`, tenantId: a.tenantId, userId: a.ownerId, fullName: a.ownerName, email: a.ownerEmail, phone: '+998 90 000 00 00', role: 'OWNER', departmentId: null, branchIds: [d.branches[0].id], warehouseIds: [d.warehouses[0].id], permissionOverrides: {}, dataScope: 'ALL', status: 'ACTIVE', lastActiveAt: addDays(a.nowDate, a.status === 'EXPIRED' ? -12 : -1).toISOString(), avatarTone: 'gold', ...stamp }]
  d.accounts = buildChartOfAccounts(a.tenantId, a.createdAt)
  d.periods = [{ id: `per_${now.slice(0, 7)}`, tenantId: a.tenantId, label: now.slice(0, 7), startDate: `${now.slice(0, 7)}-01`, endDate: `${now.slice(0, 7)}-30`, status: 'OPEN', closedAt: null, closedByMemberId: null, ...stamp }]
  d.units = [{ id: `${a.tenantId}_u`, tenantId: a.tenantId, name: 'dona', symbol: 'dona', factor: 1, baseUnitId: null, ...stamp }]
  d.categories = [{ id: `${a.tenantId}_c`, tenantId: a.tenantId, name: 'Umumiy', parentId: null, code: 'C1', ...stamp }]
  const prods = a.businessType === 'RETAIL'
    ? [['Choy 100g', 12_000, 8_000], ['Shakar 1kg', 14_500, 12_000], ['Un 2kg', 19_000, 15_500], ['Yog‘ 1L', 27_000, 23_000]]
    : [['Paxta ip 20/1', 42_000, 31_000], ['Trikotaj mato', 68_000, 49_000], ['Futbolka (oq)', 55_000, 34_000]]
  d.products = prods.map(([n, s, b], i) => ({ id: `${a.tenantId}_p${i}`, tenantId: a.tenantId, sku: `SKU-${i + 1}`, barcode: null, name: n as string, description: '', categoryId: d.categories[0].id, type: 'GOODS' as const, unitId: d.units[0].id, salePrice: s as number, purchasePrice: b as number, vatRate: 12, trackingMode: 'NONE' as const, isActive: true, reorderLevel: 10, reorderQty: 20, leadTimeDays: 5, imageTone: 'sky', defaultWarehouseId: d.warehouses[0].id, ...stamp }))
  d.stock = d.products.map((p) => ({ id: `stk_${p.id}`, tenantId: a.tenantId, productId: p.id, warehouseId: d.warehouses[0].id, onHand: 40, reserved: 0, inTransit: 0, avgCost: p.purchasePrice, lastCountedAt: null, ...stamp }))
  d.counterparties = [{ id: `${a.tenantId}_retail`, tenantId: a.tenantId, type: 'CUSTOMER', name: 'Chakana xaridor', tin: null, contactName: '—', phone: '', email: '', address: '', bankAccount: null, balance: 0, creditLimit: 0, paymentTermDays: 0, segment: 'Chakana', ownerMemberId: null, isActive: true, riskScore: null, ...stamp }]
  d.employees = [{ id: `${a.tenantId}_e0`, tenantId: a.tenantId, memberId: d.members[0].id, fullName: a.ownerName, tin: null, position: 'Direktor', departmentId: null, branchId: d.branches[0].id, employmentType: 'FULL_TIME', hiredAt: a.createdAt, baseSalary: 0, phone: '', email: a.ownerEmail, status: 'ACTIVE', bankAccount: null, ...stamp }]
  const ledger = new Ledger(d.accounts)
  d.journal.push(postOpening(ledger, { tenantId: a.tenantId, periodId: d.periods[0].id, memberId: d.members[0].id, number: 'JE-0001', now: a.createdAt }, a.createdAt, { cash: 5_000_000, bank: 20_000_000, inventory: sum(d.stock, (s) => s.onHand * s.avgCost), fixedAssets: 0, equity: 25_000_000 + sum(d.stock, (s) => s.onHand * s.avgCost), loans: 0 }))
  d.bankAccounts = [{ id: `${a.tenantId}_bank`, tenantId: a.tenantId, name: 'Asosiy hisob', bankName: 'Agrobank', accountNumber: '2020 8000 0000 0000 0001', mfo: '00394', currency: 'UZS', balance: 20_000_000, openingBalance: 20_000_000, isActive: true, accountId: ledger.sys('BANK_MAIN').id, feedConnected: false, ...stamp }]
  if (a.status === 'ACTIVE') {
    d.subscriptionInvoices = [{ id: `si_${a.tenantId}`, tenantId: a.tenantId, number: `BS-${a.nowDate.getFullYear()}-00142`, subscriptionId: subscription.id, planId: a.plan, billingCycle: 'MONTHLY', periodStart: subscription.currentPeriodStart!, periodEnd: subscription.currentPeriodEnd!, amount: 299_000, vatAmount: 35_880, total: 334_880, currency: 'UZS', status: 'PAID', issuedAt: subscription.currentPeriodStart!, dueAt: subscription.currentPeriodStart!, paidAt: subscription.currentPeriodStart!, provider: 'BANK_TRANSFER', reference: 'PP-2026-8841' }]
  }
  d.notifications = a.status === 'EXPIRED'
    ? [{ id: `${a.tenantId}_n1`, tenantId: a.tenantId, kind: 'TRIAL_EXPIRING', severity: 'CRITICAL', title: 'Sinov muddati tugadi', body: 'Platformadan foydalanishni davom ettirish uchun tarifni tanlang.', audienceRoles: ['OWNER'], audienceMemberId: null, link: '/app/settings/billing', readAt: null, readByMemberIds: [], createdAt: now, updatedAt: now }]
    : []
  return d
}

export { type Account }
