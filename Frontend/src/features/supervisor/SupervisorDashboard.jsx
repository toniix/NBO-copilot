import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, ClipboardCheck, Download, FileText, Target, Users, XCircle } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DashboardLayout from '../../components/layout/DashboardLayout'
import useDashboardStore from '../../store/useDashboardStore'
import { exportToCSV, exportToHTML, exportToPDF } from '../../lib/exportUtils.js'
import mockSalesHistory from '../../mock/sales_history.js'
import { LineChart, Line, AreaChart, Area } from 'recharts'
import { PROJECTION_WINDOW_DAYS, MONTH_DAYS } from '../../config/projectionConfig.js'

const retentionData = [
  { name: 'Lun', retenidos: 40 },
  { name: 'Mar', retenidos: 30 },
  { name: 'Mie', retenidos: 20 },
  { name: 'Jue', retenidos: 27 },
  { name: 'Vie', retenidos: 18 },
]

  

const SALES_EVENTS_KEY = 'movistar-sales-events'
const MONTHLY_TARGET = 60

const readSalesEvents = () => {
  try {
    return JSON.parse(localStorage.getItem(SALES_EVENTS_KEY) || '[]')
  } catch {
    return []
  }
}



const SupervisorDashboard = () => {
  const [salesEvents, setSalesEvents] = useState([])
  const buildHistoricalData = () => {
    const persisted = readSalesEvents()
    const combined = [...(mockSalesHistory || []), ...persisted]

    const accepted = combined.filter((e) => e.outcome === 'accepted')
    const map = {}
    accepted.forEach((ev) => {
      const d = (ev.date || ev.createdAt || new Date()).slice(0, 10)
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
    // count accepted for advisor in window
    const windowMs = PROJECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - windowMs
    const advisorAccepted = (combinedEvents || []).filter((e) => e.advisorId === advisorId && e.outcome === 'accepted' && new Date(e.date || e.createdAt).getTime() >= cutoff).length
    const avgPerDay = advisorAccepted / Math.max(PROJECTION_WINDOW_DAYS, 1)
    return Math.round(avgPerDay * MONTH_DAYS)
  }

  const { salesByAdvisor, salesMetrics } = useDashboardStore()

  const advisorMetrics = useMemo(() => {
    const events = salesEvents.concat(combinedEvents || [])
    const advisors = Object.values(salesByAdvisor || {})
    return advisors.map((advisor) => {
      const advisorEvents = events.filter((event) => event.advisorId === advisor.id)
      const accepted = (advisor.accepted || 0) + advisorEvents.filter((event) => event.outcome === 'accepted').length
      const rejected = (advisor.rejected || 0) + advisorEvents.filter((event) => event.outcome === 'rejected').length
      const total = accepted + rejected
      const progress = Math.min(Math.round((accepted / MONTHLY_TARGET) * 100), 100)
      const projection = advisorProjectionFromHistory(advisor.id)
      return { ...advisor, accepted, rejected, total, rate: total ? Math.round((accepted / total) * 100) : 0, progress, projection }
    }).sort((a, b) => b.accepted - a.accepted)
  }, [salesByAdvisor, salesEvents, combinedEvents])

  const totals = useMemo(() => advisorMetrics.reduce((result, advisor) => ({
    accepted: result.accepted + advisor.accepted,
    rejected: result.rejected + advisor.rejected,
  }), { accepted: 0, rejected: 0 }), [advisorMetrics])
  const acceptanceRate = (totals.accepted + totals.rejected) ? Math.round((totals.accepted / (totals.accepted + totals.rejected)) * 100) : 0
  const projectedTotal = advisorMetrics.reduce((sum, advisor) => sum + advisor.projection, 0)
  const chartData = advisorMetrics.map(({ name, accepted, rejected }) => ({ name, aceptadas: accepted, 'no aceptadas': rejected }))
  const reportSummary = [
    { label: 'Ventas aceptadas', value: totals.accepted, description: 'Total del equipo' },
    { label: 'Tasa de aceptación', value: `${acceptanceRate}%`, description: 'Conversión comercial' },
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

  const downloadVisualReport = () => exportToHTML(chartData, 'reporte-comercial-equipo.html', {
    title: 'Reporte Comercial Movistar',
    subtitle: 'Ventas, ranking y proyección del equipo de asesores',
    summary: reportSummary,
  })

  const downloadPdfReport = async () => {
    try {
      await exportToPDF('supervisor-report', 'reporte-comercial-supervisor.pdf')
    } catch (e) {
      // fallback: download html if PDF fails
      console.error(e)
      downloadVisualReport()
    }
  }

  return (
    <DashboardLayout>
      <div id="supervisor-report" className="space-y-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#019DF4]">Centro de control</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#313235]">Rendimiento comercial</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Supervisa ventas, conversión y avance de meta de Vero, Anthony y Gabriela en una sola vista.</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <button type="button" onClick={downloadPdfReport} className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white sm:w-auto" style={{ background: 'var(--color-primary)' }}><FileText className="h-4 w-4" aria-hidden="true" />Exportar PDF</button>
            <button type="button" onClick={downloadVisualReport} className="inline-flex w-full items-center justify-center gap-2 rounded-lg btn-outline sm:w-auto"><FileText className="h-4 w-4" aria-hidden="true" />Reporte HTML</button>
            <button type="button" onClick={() => exportToCSV(chartData, 'ventas-asesores.csv')} className="inline-flex w-full items-center justify-center gap-2 rounded-lg btn-outline sm:w-auto"><Download className="h-4 w-4" aria-hidden="true" />Datos CSV</button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen comercial">
          <Kpi icon={CheckCircle2} label="Ventas aceptadas" value={totals.accepted} detail="Resultado acumulado" color="text-[#5BC500]" bg="bg-green-50" />
          <Kpi icon={XCircle} label="No aceptadas" value={totals.rejected} detail="Oportunidades a recuperar" color="text-red-600" bg="bg-red-50" />
          <Kpi icon={ClipboardCheck} label="Tasa de aceptación" value={`${acceptanceRate}%`} detail="Conversión del equipo" color="text-[#019DF4]" bg="bg-blue-50" />
          <Kpi icon={Target} label="Proyección mensual" value={projectedTotal} detail={`Meta: ${MONTHLY_TARGET * 3} ventas`} color="text-[#313235]" bg="bg-slate-100" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div><h3 className="text-base font-semibold text-[#313235]">Ventas por asesor</h3><p className="mt-1 text-sm text-slate-500">Comparación de ofertas aceptadas y no aceptadas</p></div>
            <Users className="h-5 w-5 text-[#019DF4]" aria-hidden="true" />
          </div>
          <div className="h-72 w-full" aria-label="Gráfico de ventas por asesor">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} />
                <Tooltip contentStyle={{ border: '1px solid #E2E8F0', borderRadius: '8px' }} />
                <Bar dataKey="aceptadas" name="Aceptadas" fill="#5BC500" radius={[5, 5, 0, 0]} />
                <Bar dataKey="no aceptadas" name="No aceptadas" fill="#CBD5E1" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-center justify-between gap-4"><div><h3 className="text-base font-semibold text-[#313235]">Ranking y avance de meta</h3><p className="mt-1 text-sm text-slate-500">Ordenado por ventas aceptadas</p></div><BarChart3 className="h-5 w-5 text-[#019DF4]" aria-hidden="true" /></div>
          <div className="space-y-5">
            {advisorMetrics.map((advisor, index) => (
              <article key={advisor.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${index === 0 ? 'bg-[#5BC500] text-white' : 'bg-slate-100 text-slate-600'}`}>#{index + 1}</div>
                <div className="min-w-0"><div className="flex justify-between gap-3 text-sm"><span className="font-semibold text-[#313235]">{advisor.name}</span><span className="text-slate-500">{advisor.accepted}/{MONTHLY_TARGET} ventas</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#019DF4]" style={{ width: `${advisor.progress}%` }} /></div><p className="mt-1 text-xs text-slate-500">{advisor.rate}% aceptación · Proyección: {advisor.projection}</p></div>
                <span className="text-lg font-bold text-[#313235]">{advisor.accepted}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#019DF4]"><BarChart3 className="h-5 w-5" aria-hidden="true" /></div><div><h3 className="text-base font-semibold text-[#313235]">Retención diaria</h3><p className="text-sm text-slate-500">Clientes retenidos durante los últimos 5 días</p></div></div>
          <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={retentionData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#E2E8F0" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} /><Tooltip contentStyle={{ border: '1px solid #E2E8F0', borderRadius: '8px' }} /><Bar dataKey="retenidos" name="Retenidos" fill="#019DF4" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold text-[#313235]">Histórico - Ventas aceptadas (últimos 14 días)</h3>
              <p className="mt-1 text-sm text-slate-500">Tendencia combinada: datos mock + eventos recientes</p>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#5BC500" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#5BC500" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Area type="monotone" dataKey="accepted" stroke="#5BC500" fillOpacity={1} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </DashboardLayout>
  )
}

const Kpi = ({ icon: Icon, label, value, detail, color, bg }) => <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500">{label}</p><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}><Icon className="h-5 w-5" aria-hidden="true" /></div></div><p className={`mt-5 text-3xl font-semibold ${color}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></article>

export default SupervisorDashboard
