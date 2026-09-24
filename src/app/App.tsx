import { Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/appStore'
import { useI18nStore } from '@/core/i18n'
import { ToastViewport } from '@/ui/primitives'
import { useSession } from './useSession'
import { WorkspaceLayout } from './layouts/WorkspaceLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { PublicLayout } from './layouts/PublicLayout'

/* Public */
const Landing = lazy(() => import('@/pages/public/Landing'))
const Login = lazy(() => import('@/pages/public/Login'))
const Onboarding = lazy(() => import('@/pages/public/Onboarding'))
const PricingPage = lazy(() => import('@/pages/public/PricingPage'))

/* Workspace */
const Dashboard = lazy(() => import('@/pages/app/Dashboard'))
const SalesPages = lazy(() => import('@/pages/app/Sales'))
const InventoryPages = lazy(() => import('@/pages/app/Inventory'))
const PurchasingPage = lazy(() => import('@/pages/app/Purchasing'))
const CounterpartiesPage = lazy(() => import('@/pages/app/Counterparties'))
const AccountingPages = lazy(() => import('@/pages/app/Accounting'))
const ReportsPage = lazy(() => import('@/pages/app/Reports'))
const ManufacturingPages = lazy(() => import('@/pages/app/Manufacturing'))
const HrPages = lazy(() => import('@/pages/app/Hr'))
const AiPage = lazy(() => import('@/pages/app/AiCfo'))
const NotificationsPage = lazy(() => import('@/pages/app/Notifications'))
const SettingsPages = lazy(() => import('@/pages/app/Settings'))
const CheckoutPage = lazy(() => import('@/pages/app/Checkout'))

/* Admin */
const AdminPages = lazy(() => import('@/pages/admin/Admin'))

function Fallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="h-5 w-5 rounded-full border-2 border-brand border-t-transparent animate-spin" />
        Yuklanmoqda…
      </div>
    </div>
  )
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => window.scrollTo({ top: 0 }), [pathname])
  return null
}

function RequireWorkspace({ children }: { children: JSX.Element }) {
  const { principal, tenant } = useSession()
  const loc = useLocation()
  if (!principal) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  if (principal.isSuperAdmin && !tenant) return <Navigate to="/admin" replace />
  if (!tenant) return <Navigate to="/login" replace />
  return children
}

function RequireSuperAdmin({ children }: { children: JSX.Element }) {
  const user = useAppStore((s) => s.users.find((u) => u.id === s.session?.userId))
  if (!user) return <Navigate to="/login?admin=1" replace />
  if (!user.isSuperAdmin) return <Navigate to="/app" replace />
  return children
}

export default function App() {
  const boot = useAppStore((s) => s.boot)
  const ready = useAppStore((s) => s.ready)
  const theme = useAppStore((s) => s.theme)
  const lang = useI18nStore((s) => s.lang)

  useEffect(() => boot(), [boot])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.lang = lang
  }, [theme, lang])

  if (!ready) return <Fallback />

  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Landing />} />
            <Route path="/pricing" element={<PricingPage />} />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Onboarding />} />
          <Route path="/demo" element={<Navigate to="/login?demo=1" replace />} />

          <Route
            path="/app"
            element={
              <RequireWorkspace>
                <WorkspaceLayout />
              </RequireWorkspace>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="sales/*" element={<SalesPages />} />
            <Route path="invoices" element={<SalesPages view="invoices" />} />
            <Route path="payments" element={<SalesPages view="payments" />} />
            <Route path="customers" element={<CounterpartiesPage kind="CUSTOMER" />} />
            <Route path="suppliers" element={<CounterpartiesPage kind="SUPPLIER" />} />
            <Route path="inventory/*" element={<InventoryPages />} />
            <Route path="purchasing" element={<PurchasingPage />} />
            <Route path="accounting/*" element={<AccountingPages />} />
            <Route path="reports/*" element={<ReportsPage />} />
            <Route path="manufacturing/*" element={<ManufacturingPages />} />
            <Route path="hr/*" element={<HrPages />} />
            <Route path="ai" element={<AiPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="settings/*" element={<SettingsPages />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>

          <Route
            path="/admin/*"
            element={
              <RequireSuperAdmin>
                <AdminLayout />
              </RequireSuperAdmin>
            }
          >
            <Route path="*" element={<AdminPages />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <ToastViewport />
    </>
  )
}
