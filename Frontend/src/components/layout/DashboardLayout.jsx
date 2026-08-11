import { BarChart3, LogOut, UserRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../../store/useAuthStore'
import useDashboardStore from '../../store/useDashboardStore'

const DashboardLayout = ({ children }) => {
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
  }

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-[#313235]">
      <header className="border-b border-slate-100 bg-white shadow-[0_1px_8px_rgba(49,50,53,0.06)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-base font-semibold tracking-[-0.01em] text-[#313235] sm:text-lg">
            Panel de {user?.role === 'supervisor' ? 'Supervisor' : 'Asesor'} - Movistar
          </h1>

          <div className="flex items-center gap-3">
            {user?.role !== 'supervisor' && (
              <Link
                to="/supervisor"
                title="Métricas Globales"
                aria-label="Métricas Globales"
                className="inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold text-[#019DF4] transition hover:bg-blue-50 sm:px-3"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Métricas Globales</span>
              </Link>
            )}
            <div className="hidden items-center gap-2 text-right sm:flex">
              <div>
                <p className="text-sm font-semibold text-[#313235]">
                  {user?.name || user?.email || 'Asesor'}
                </p>
                <p className="text-xs capitalize text-slate-500">{user?.role || 'asesor'}</p>
              </div>
              <UserRound className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-[#313235] focus:outline-none focus:ring-2 focus:ring-[#019DF4]/30"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
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
