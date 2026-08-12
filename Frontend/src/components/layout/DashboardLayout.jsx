import { BarChart3, LogOut, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import useDashboardStore from '../../store/useDashboardStore'

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuthStore()
  const { salesMetrics, salesByAdvisor } = useDashboardStore()

  const myAdvisorKey = user?.id || `advisor-${(user?.name || '').toLowerCase()}`
  const mySales = (salesByAdvisor && salesByAdvisor[myAdvisorKey] && salesByAdvisor[myAdvisorKey].accepted) || 0
  const dailyTarget = salesMetrics?.dailyTarget || 15

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#313235]">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo & App Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#019DF4] font-extrabold text-white shadow-md shadow-[#019DF4]/20">
              M
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-[#313235]">
                NBO Copilot <span className="hidden text-xs font-semibold text-[#019DF4] sm:inline">| Movistar</span>
              </h1>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                {user?.role === 'supervisor' ? 'Panel Supervisor' : 'Asesor de Ventas'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Sales Advisor Metrics Compact Badge */}
            {user?.role !== 'supervisor' && (
              <div className="hidden items-center gap-2.5 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-1 text-xs font-semibold text-slate-700 sm:flex">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[#5BC500]" />
                  Ventas hoy: <strong className="text-[#313235]">{mySales}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500">Meta: <strong className="text-slate-700">{dailyTarget}</strong></span>
              </div>
            )}

            {user?.role !== 'supervisor' && (
              <Link
                to="/supervisor"
                title="Métricas Globales"
                aria-label="Métricas Globales"
                className="inline-flex items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50/80 px-3 py-1.5 text-xs font-bold text-[#019DF4] transition hover:bg-blue-100"
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Métricas Globales</span>
              </Link>
            )}

            <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 text-right sm:flex">
              <div>
                <p className="text-xs font-bold text-[#313235]">
                  {user?.name || user?.email || 'Asesor'}
                </p>
                <p className="text-[10px] capitalize text-slate-400">{user?.role || 'asesor'}</p>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                {(user?.name || 'A').charAt(0).toUpperCase()}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#019DF4]/30"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8 sm:py-6">
        {children}
      </main>
      {/* Global toast from dashboard store */}
      <Toast />
    </div>
  )
}

const Toast = () => {
  const { toast } = useDashboardStore()
  if (!toast || !toast.visible) return null
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="rounded-lg bg-[#5BC500] px-4 py-2 text-white shadow">{toast.message}</div>
    </div>
  )
}

export default DashboardLayout
