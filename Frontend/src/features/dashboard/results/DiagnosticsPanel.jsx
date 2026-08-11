import { useState } from 'react'
import { ChevronDown, Cpu, Fingerprint, Timer } from 'lucide-react'

const NODE_LABELS = {
  feature_eng_node: 'Feature engineering',
  ml_scoring_node: 'Scoring ML',
  catalog_retrieval_node: 'Catálogo (RAG)',
  llm_pitch_node: 'Generación de pitch',
  __total__: 'Total',
}

const DiagnosticsPanel = ({ clientData }) => {
  const [open, setOpen] = useState(false)
  const { nodeTimings = {}, gestion_id, dni, decisionThreshold } = clientData
  const hasTimings = nodeTimings && Object.keys(nodeTimings).length > 0

  if (!hasTimings && !gestion_id && !dni && decisionThreshold == null) return null

  const total = nodeTimings.__total__
  const nodes = Object.entries(nodeTimings).filter(([key]) => key !== '__total__')

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-4 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-3 text-sm font-semibold text-[#313235]">
          <Cpu className="h-4 w-4 text-slate-400" aria-hidden="true" /> Diagnóstico del pipeline
          {total != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              <Timer className="h-3 w-3" aria-hidden="true" /> {Math.round(total)} ms
            </span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-6 border-t border-slate-100 px-6 py-5 md:grid-cols-3">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Trazabilidad</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-slate-500">
                  <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" /> Cliente
                </dt>
                <dd className="font-mono text-xs text-[#313235]">{dni || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Gestión</dt>
                <dd className="font-mono text-xs text-[#313235]">{gestion_id || '—'}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Umbral de decisión</dt>
                <dd className="font-semibold text-[#313235]">
                  {decisionThreshold != null ? `${Math.round(decisionThreshold * 100)}%` : '—'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="md:col-span-2">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Tiempos por nodo (ms)</h4>
            <div className="space-y-2">
              {nodes.map(([key, ms]) => {
                const pct = total ? Math.round((ms / total) * 100) : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{NODE_LABELS[key] || key}</span>
                      <span className="font-mono text-[#313235]">{Number(ms).toFixed(1)} ms</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#019DF4]" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default DiagnosticsPanel