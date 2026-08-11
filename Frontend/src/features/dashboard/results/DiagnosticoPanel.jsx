import { Cpu, Fingerprint, Timer } from 'lucide-react'

const rateNode = (total = 0) => {
  const t = Number(total) || 0
  return t <= 0
    ? '—'
    : t >= 1000
      ? `${(t / 1000).toFixed(2)} s`
      : `${Math.round(t)} ms`
}

const DiagnosticoPanel = ({ clientData }) => {
  const timings = clientData.nodeTimings || {}
  const nodes = Object.entries(timings).filter(([name]) => name !== '__total__')

  if (Object.keys(timings).length === 0 && !clientData.gestion_id) return null

  return (
    <details className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="Detalle técnico del análisis">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-600">
        <span className="inline-flex items-center gap-2">
          <Cpu className="h-4 w-4" aria-hidden="true" />
          Detalle técnico del análisis
        </span>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {timings.__total__ != null && (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <Timer className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tiempo total del pipeline</p>
              <p className="text-lg font-semibold text-[#313235]">{rateNode(timings.__total__)}</p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tiempos por nodo</p>
          <ul className="space-y-2">
            {nodes.map(([name, value]) => (
              <li key={name} className="flex items-center justify-between text-sm">
                <span className="capitalize text-slate-600">{name.replace(/_/g, ' ')}</span>
                <span className="font-mono text-xs font-medium text-slate-500">{rateNode(value)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Decisión</p>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Umbral de decisión</dt>
              <dd className="font-mono text-xs font-medium text-slate-500">
                {clientData.decisionThreshold != null ? `${(clientData.decisionThreshold * 100).toFixed(2)}%` : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Aceptación predicha</dt>
              <dd className="font-mono text-xs font-medium text-slate-500">
                {clientData.aceptaPredicho === true ? 'Sí' : clientData.aceptaPredicho === false ? 'No' : '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-600">Alternativas recuperadas</dt>
              <dd className="font-mono text-xs font-medium text-slate-500">{clientData.offers?.length ?? '—'}</dd>
            </div>
          </dl>
        </div>

        {clientData.gestion_id && (
          <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-4">
            <Fingerprint className="h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">ID de gestión</p>
              <p className="truncate font-mono text-xs text-slate-600">{clientData.gestion_id}</p>
            </div>
          </div>
        )}
      </div>
    </details>
  )
}

export default DiagnosticoPanel