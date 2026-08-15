import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Download,
  FileText,
  PieChart as PieIcon,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import DashboardLayout from '../../components/layout/DashboardLayout'
import useDashboardStore from '../../store/useDashboardStore'
import { getSupervisorMetrics } from '../../services/api.js'
import { exportToCSV, exportToHTML, exportToPDF } from '../../lib/exportUtils.js'
import mockSalesHistory from '../../mock/sales_history.js'
import { PROJECTION_WINDOW_DAYS, MONTH_DAYS } from '../../config/projectionConfig.js'
import NboEngineMetricsModal from './NboEngineMetricsModal'

const retentionData = [
  { name: 'Lun', retenidos: 40 },
  { name: 'Mar', retenidos: 30 },
  { name: 'Mie', retenidos: 20 },
  { name: 'Jue', retenidos: 27 },
  { name: 'Vie', retenidos: 18 },
]

const SALES_EVENTS_KEY = 'movistar-sales-events'
const MONTHLY_TARGET = 60
const REJECTION_COLORS = ['#EF4444', '#F59E0B', '#6366F1', '#8B5CF6']

const readSalesEvents = () => {
  try {
    return JSON.parse(localStorage.getItem(SALES_EVENTS_KEY) || '[]')
  } catch {
    return []
  }
}

const SupervisorDashboard = () => {
  const [salesEvents, setSalesEvents] = useState([])
  const [backendMetrics, setBackendMetrics] = useState(null)
  const [isBackendLoading, setIsBackendLoading] = useState(true)
  const [isNboModalOpen, setIsNboModalOpen] = useState(false)

  // Fetch metrics from backend API /api/v1/supervisor/metrics
  useEffect(() => {
    const fetchBackendMetrics = async () => {
      setIsBackendLoading(true)
      const data = await getSupervisorMetrics()
      if (data) {
        setBackendMetrics(data)
      }
      setIsBackendLoading(false)
    }

    fetchBackendMetrics()
  }, [])

  const buildHistoricalData = () => {
    const persisted = readSalesEvents()
    const combined = [...(mockSalesHistory || []), ...persisted]

    const accepted = combined.filter((e) => e.outcome === 'accepted')
    const map = {}
    accepted.forEach((ev) => {
      const d = (ev.date || ev.createdAt || new Date().toISOString()).slice(0, 10)
      map[d] = (map[d] || 0) + 1
    })

    const days = PROJECTION_WINDOW_DAYS
    const today = new Date()
    const data = []
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(today)
      day.setDate(today.getDate() - i)
      const key = day.toISOString().slice(0, 10)
      data.push({ date: key, accepted: map[key] || 0 })
    }
    return { timeseries: data, combined }
  }

  const { timeseries: historicalData, combined: combinedEvents } = buildHistoricalData()

  const advisorProjectionFromHistory = (advisorId) => {
    const windowMs = PROJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - windowMs
    const advisorAccepted = (combinedEvents || []).filter(
      (e) => e.advisorId === advisorId && e.outcome === 'accepted' && new Date(e.date || e.createdAt).getTime() >= cutoff
    ).length
    const avgPerDay = advisorAccepted / Math.max(PROJECTION_WINDOW_DAYS, 1)
    return Math.round(avgPerDay * MONTH_DAYS)
  }

  const { salesByAdvisor } = useDashboardStore()

  const advisorMetrics = useMemo(() => {
    const events = salesEvents.concat(combinedEvents || [])
    const advisors = Object.values(salesByAdvisor || {})
    return advisors
      .map((advisor) => {
        const advisorEvents = events.filter((event) => event.advisorId === advisor.id)
        const accepted = (advisor.accepted || 0) + advisorEvents.filter((event) => event.outcome === 'accepted').length
        const rejected = (advisor.rejected || 0) + advisorEvents.filter((event) => event.outcome === 'rejected').length
        const total = accepted + rejected
        const progress = Math.min(Math.round((accepted / MONTHLY_TARGET) * 100), 100)
        const projection = advisorProjectionFromHistory(advisor.id)
        return {
          ...advisor,
          accepted,
          rejected,
          total,
          rate: total ? Math.round((accepted / total) * 100) : 0,
          progress,
          projection,
        }
      })
      .sort((a, b) => b.accepted - a.accepted)
  }, [salesByAdvisor, salesEvents, combinedEvents])

  const totals = useMemo(
    () =>
      advisorMetrics.reduce(
        (result, advisor) => ({
          accepted: result.accepted + advisor.accepted,
          rejected: result.rejected + advisor.rejected,
        }),
        { accepted: 0, rejected: 0 }
      ),
    [advisorMetrics]
  )

  const acceptanceRate = totals.accepted + totals.rejected ? Math.round((totals.accepted / (totals.accepted + totals.rejected)) * 100) : 0
  const projectedTotal = advisorMetrics.reduce((sum, advisor) => sum + advisor.projection, 0)
  const chartData = advisorMetrics.map(({ name, accepted, rejected }) => ({ name, aceptadas: accepted, 'no aceptadas': rejected }))

  const reportSummary = [
    { label: 'Ventas aceptadas', value: totals.accepted, description: 'Total del equipo' },
    { label: 'Tasa de aceptación', value: `${backendMetrics?.kpis?.conversion_rate ?? acceptanceRate}%`, description: 'Conversión comercial' },
    { label: 'Proyección mensual', value: projectedTotal, description: 'Ventas estimadas' },
  ]

  useEffect(() => {
    const loadSalesEvents = () => setSalesEvents(readSalesEvents())
    loadSalesEvents()
    const refresh = () => setSalesEvents(readSalesEvents())
    window.addEventListener('storage', refresh)
    window.addEventListener('sales-event-created', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('sales-event-created', refresh)
    }
  }, [])

  const downloadVisualReport = () =>
    exportToHTML(chartData, 'reporte-comercial-equipo.html', {
      title: 'Reporte Comercial Movistar',
      subtitle: 'Ventas, ranking y proyección del equipo de asesores',
      summary: reportSummary,
    })

  const downloadPdfReport = async () => {
    try {
      await exportToPDF('supervisor-report', 'reporte-comercial-supervisor.pdf')
    } catch (e) {
      console.error(e)
      downloadVisualReport()
    }
  }

  // Combined KPIs merging real Backend API + Store
  const kpis = backendMetrics?.kpis || {}
  const rejectionReasons = backendMetrics?.rejection_reasons || [
    { reason: 'Precio percibido alto', count: 4, pct: 67 },
    { reason: 'Sin interés en el producto', count: 2, pct: 33 },
  ]
  const teamBaseline = backendMetrics?.team_performance || []

  return (
    <DashboardLayout>
      <div id="supervisor-report" className="space-y-6">
        {/* Header & API Sync Status */}
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#019DF4]">
                Centro de Control Gerencial
              </span>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-[#3f8b00] border border-emerald-200">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5BC500] animate-pulse" />
                Sistema Conectado en Tiempo Real
              </span>
            </div>
            <h2 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-[#313235]">
              Rendimiento Comercial & Copilot IA
            </h2>
            <p className="mt-1 max-w-2xl text-xs sm:text-sm text-slate-500">
              Supervisa conversión real, retención de fuga, motivos de rechazo y adherencia al Copilot del equipo en tiempo real.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button
              type="button"
              onClick={() => setIsNboModalOpen(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#019DF4] to-[#0176b5] px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-[#019DF4]/20 transition hover:from-[#008bd8] hover:to-[#01659c] sm:w-auto"
            >
              <Cpu className="h-4 w-4" aria-hidden="true" />
              Motor NBO IA
            </button>
            <button
              type="button"
              onClick={downloadPdfReport}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 sm:w-auto"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Exportar PDF
            </button>
            <button
              type="button"
              onClick={downloadVisualReport}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 sm:w-auto"
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Reporte HTML
            </button>
            <button
              type="button"
              onClick={() => exportToCSV(chartData, 'ventas-asesores.csv')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 sm:w-auto"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Datos CSV
            </button>
          </div>
        </header>

        {/* 4 Executive KPI Cards Row */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="KPIs Ejecutivos">
          <Kpi
            icon={CheckCircle2}
            label="Tasa de Conversión Real"
            value={`${kpis.conversion_rate != null ? kpis.conversion_rate : acceptanceRate}%`}
            detail="Gestiones registradas acumuladas"
            color="text-[#5BC500]"
            bg="bg-green-50"
          />
          <Kpi
            icon={ShieldAlert}
            label="Clientes Retenidos (Churn)"
            value={kpis.churn_prevented || 142}
            detail={`+${kpis.churn_prevented_delta || 18} este mes`}
            color="text-[#019DF4]"
            bg="bg-blue-50"
          />
          <Kpi
            icon={TrendingUp}
            label="Adopción Movistar Total"
            value={`${kpis.mt_adoption_pct || 42.3}%`}
            detail={`Meta convergente: ${kpis.mt_adoption_goal || 50}%`}
            color="text-purple-600"
            bg="bg-purple-50"
          />
          <Kpi
            icon={Cpu}
            label="Gestiones Totales NBO"
            value={kpis.total_interactions != null ? kpis.total_interactions : totals.accepted + totals.rejected}
            detail={`Proyección: ${projectedTotal} ventas`}
            color="text-slate-700"
            bg="bg-slate-100"
          />
        </section>

        {/* Rejection Reasons & Team Sales Breakdown */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Rejection Reasons & Objeciones (Backend API) */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
                  Análisis de Objeciones
                </span>
                <h3 className="text-base font-bold text-[#313235]">Motivos de Rechazo de Ofertas</h3>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-4 mt-4">
              {rejectionReasons.length > 0 ? (
                rejectionReasons.map((item, idx) => (
                  <div key={item.reason} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-[#313235]">
                      <span>{item.reason}</span>
                      <span className="text-rose-600">{item.count} objeciones ({item.pct}%)</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${item.pct}%`,
                          backgroundColor: REJECTION_COLORS[idx % REJECTION_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No se han registrado rechazos recientes.</p>
              )}
            </div>
          </section>

          {/* Sales by Advisor Shift */}
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#019DF4]">
                  Turno Comercial
                </span>
                <h3 className="text-base font-bold text-[#313235]">Ventas por Asesor</h3>
              </div>
              <Users className="h-5 w-5 text-[#019DF4]" aria-hidden="true" />
            </div>

            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ border: '1px solid #E2E8F0', borderRadius: '12px' }} />
                  <Bar dataKey="aceptadas" name="Aceptadas" fill="#5BC500" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="no aceptadas" name="No aceptadas" fill="#CBD5E1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </div>

        {/* Team Performance & Copilot Score (Backend Team Baseline) */}
        {teamBaseline.length > 0 && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#019DF4]">
                  Adherencia NBO Copilot
                </span>
                <h3 className="text-base font-bold text-[#313235]">Desempeño & Copilot Score del Equipo</h3>
              </div>
              <Award className="h-5 w-5 text-[#5BC500]" aria-hidden="true" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-extrabold text-slate-400 border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-3">Asesor</th>
                    <th className="px-4 py-3 text-center">Interacciones</th>
                    <th className="px-4 py-3 text-center">Ofertas Presentadas</th>
                    <th className="px-4 py-3 text-center">Aceptación MT</th>
                    <th className="px-4 py-3 text-right">Copilot Score IA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamBaseline.map((member) => (
                    <tr key={member.advisor} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-[#313235]">{member.advisor}</td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{member.interactions}</td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-700">{member.offers}</td>
                      <td className="px-4 py-3.5 text-center font-bold text-[#3f8b00]">
                        {member.mt_acceptance_pct}%
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-[#3f8b00] border border-emerald-200">
                          <Sparkles className="h-3 w-3" /> {member.copilot_score}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 14-Day Sales Trend & Projection */}
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#313235]">Tendencia Histórica de Ventas Aceptadas (14 días)</h3>
              <p className="text-xs text-slate-500">Evolución diaria combinada de gestiones del equipo</p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5BC500" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#5BC500" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: '12px' }} />
                <Area type="monotone" dataKey="accepted" stroke="#5BC500" strokeWidth={3} fillOpacity={1} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Modal de Métricas del Motor NBO IA (Fase 8) */}
      <NboEngineMetricsModal
        isOpen={isNboModalOpen}
        onClose={() => setIsNboModalOpen(false)}
        fase8Kpis={backendMetrics?.fase8_kpis}
      />
    </DashboardLayout>
  )
}

const Kpi = ({ icon: Icon, label, value, detail, color, bg }) => (
  <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:shadow-md">
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div className={`flex h-9 w-9 items-center justify-center rounded-2xl ${bg} ${color}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
    </div>
    <p className={`mt-4 text-3xl font-extrabold ${color}`}>{value}</p>
    <p className="mt-1 text-xs text-slate-500 font-medium">{detail}</p>
  </article>
)

export default SupervisorDashboard
