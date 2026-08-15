import {
  AlertCircle,
  BarChart2,
  CheckCircle2,
  Cpu,
  Layers,
  PieChart as PieIcon,
  Radio,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react'

const NboEngineMetricsModal = ({ isOpen, onClose, fase8Kpis }) => {
  if (!isOpen) return null

  const kpis = fase8Kpis || {}
  const modelMetrics = kpis.metricas_modelo || {}
  const funnel = kpis.funnel || {}
  const offerRates = kpis.tasa_por_tipo_oferta || {}
  const channelRates = kpis.tasa_por_canal || {}
  const churnDist = kpis.distribucion_riesgo_churn || {}
  const arpuProxy = kpis.arpu_proxy_por_riesgo_churn || {}
  const oportunidadMt = kpis.oportunidad_mt || {}

  const labelMap = {
    riesgo_alto: 'Riesgo Alto',
    riesgo_medio_alto: 'Riesgo Medio-Alto',
    riesgo_medio_bajo: 'Riesgo Medio-Bajo',
    riesgo_bajo: 'Riesgo Bajo',
  }

  const offerTypeMap = {
    movistar_total: 'Movistar Total (Convergente)',
    plan_movil: 'Plan Móvil High-Data',
    plan_hogar: 'Fibra / Plan Hogar',
    equipo: 'Renovación de Equipo',
    upgrade: 'Upgrade de Plan',
    paquete_adicional: 'Paquete Adicional',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-nbo-engine-title"
    >
      <div className="relative w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header del Modal */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#019DF4] to-[#0176b5] text-white shadow-md shadow-[#019DF4]/20">
              <Cpu className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="modal-nbo-engine-title" className="text-xl font-extrabold text-[#313235]">
                  Motor de Recomendación Inteligente NBO
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#019DF4] border border-blue-200">
                  XGBoost v8.0
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-extrabold text-[#3f8b00] border border-emerald-200">
                  CV 5-Fold Validado
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Parámetros de rendimiento predictivo, umbral oficial del contrato, funnel E2E y matriz de riesgo ARPU.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Cerrar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 1. Tarjetas de Métricas ML (Salud del Modelo) */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#019DF4]" />
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
              Salud del Modelo Predictivo & Umbral de Decisión
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-center">
              <p className="text-[10px] font-extrabold uppercase text-slate-400">Umbral Modelo</p>
              <p className="mt-1 text-2xl font-black text-[#019DF4]">
                {modelMetrics.umbral_decision ?? 0.3508}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Contrato de Producción</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 text-center">
              <p className="text-[10px] font-extrabold uppercase text-slate-400">Recall (Sensibilidad)</p>
              <p className="mt-1 text-2xl font-black text-[#5BC500]">
                {Math.round((modelMetrics.recall ?? 0.978) * 100)}%
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Captura de Oportunidades</p>
            </div>

            <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 text-center">
              <p className="text-[10px] font-extrabold uppercase text-slate-400">AUC Test (5-Fold CV)</p>
              <p className="mt-1 text-2xl font-black text-purple-600">
                {modelMetrics.auc_test ?? 0.585}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Estabilidad CV ±0.0014</p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 text-center">
              <p className="text-[10px] font-extrabold uppercase text-slate-400">F1 Score</p>
              <p className="mt-1 text-2xl font-black text-amber-600">
                {modelMetrics.f1_score ?? 0.547}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">Balance Precisión/Recall</p>
            </div>
          </div>
        </div>

        {/* 2. Funnel E2E & Conversión por Oferta y Canal */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Funnel de Contactabilidad */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#019DF4]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#313235]">
                Funnel de Contactabilidad E2E
              </h3>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between rounded-xl bg-white p-3 border border-slate-100">
                <span className="text-slate-600">Ofrecimientos Intentados:</span>
                <strong className="text-slate-800">
                  {(funnel.total_ofrecimientos_intentados ?? funnel.total_ofrecimientos_historicos ?? 254618).toLocaleString()}
                </strong>
              </div>
              <div className="flex justify-between rounded-xl bg-white p-3 border border-slate-100">
                <span className="text-slate-600">Ofertas Aceptadas:</span>
                <strong className="text-[#5BC500]">
                  {(funnel.aceptadas ?? 95414).toLocaleString()} ({Math.round((funnel.tasa_aceptacion_global ?? 0.3747) * 100)}%)
                </strong>
              </div>
              <div className="flex justify-between rounded-xl bg-white p-3 border border-slate-100">
                <span className="text-slate-600">Tasa Conversión Movistar Total:</span>
                <strong className="text-purple-600">
                  {Math.round((offerRates.movistar_total ?? 0.697) * 100)}%
                </strong>
              </div>
              <div className="flex justify-between rounded-xl bg-white p-3 border border-slate-100">
                <span className="text-slate-600">Oportunidad Convergencia (Sin MT):</span>
                <strong className="text-[#019DF4]">
                  {(oportunidadMt.clientes_elegibles_sin_mt ?? 13650).toLocaleString()} clientes
                </strong>
              </div>
            </div>
          </div>

          {/* Tasa por Canal de Contacto */}
          <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#5BC500]" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#313235]">
                Efectividad por Canal de Contacto
              </h3>
            </div>

            <div className="space-y-2.5">
              {Object.entries(channelRates).map(([canal, rate]) => (
                <div key={canal} className="rounded-xl bg-white p-3 border border-slate-100">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{canal}</span>
                    <span className="text-[#019DF4]">{Math.round(Number(rate) * 100)}% aceptación</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#019DF4]"
                      style={{ width: `${Math.round(Number(rate) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. ARPU Proxy & Distribución de Churn */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-purple-600" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#313235]">
                Segmentación de Fuga & Matriz ARPU Proxy
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">Clustering KMeans (100,000 clientes)</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(arpuProxy).map(([nivel, arpu]) => {
              const dist = churnDist[nivel] ?? 0
              const isHighRisk = nivel.includes('alto')
              return (
                <div
                  key={nivel}
                  className={`rounded-2xl border p-4 transition-all ${
                    isHighRisk ? 'border-rose-200 bg-rose-50/50' : 'border-slate-100 bg-slate-50/70'
                  }`}
                >
                  <p className="text-xs font-bold capitalize text-[#313235]">
                    {labelMap[nivel] || nivel}
                  </p>
                  <p className="mt-1 text-xl font-black text-[#019DF4]">
                    S/ {Number(arpu).toFixed(2)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                    {Math.round(dist * 100)}% de la base de clientes
                  </p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-400 italic">
            * Métricas calculadas sobre la base nacional de clientes y modelo predictivo de producción.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[#019DF4] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#008bd8]"
          >
            Cerrar Consulta
          </button>
        </div>
      </div>
    </div>
  )
}

export default NboEngineMetricsModal
