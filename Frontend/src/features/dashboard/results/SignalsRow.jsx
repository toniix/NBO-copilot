import { CheckCircle2, CircleAlert, Sprout, Target } from 'lucide-react'
import Gauge from './Gauge'

const riskLabel = (pct) => {
  if (pct <= 25) return { text: 'Riesgo de fuga bajo', tone: 'text-[#2E9E5B]' }
  if (pct <= 60) return { text: 'Riesgo de fuga medio', tone: 'text-[#B8860B]' }
  return { text: 'Riesgo de fuga alto', tone: 'text-[#DE3B2E]' }
}

const SignalCard = ({ title, children, footer }) => (
  <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
    <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
    <div className="mt-4">{children}</div>
    {footer && <div className="mt-3">{footer}</div>}
  </article>
)

const SignalsRow = ({ clientData }) => {
  const churnPct = clientData.churnScore
  const mtPct = Math.round((clientData.mtPropensity || 0) * 100)
  const risk = riskLabel(churnPct)
  const acepta = clientData.aceptaPredicho
  const hasMl = typeof clientData.scores?.churn_risk === 'number'

  if (!hasMl && !clientData.churnScore) return null

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Señales clave del cliente">
      <SignalCard
        title="Riesgo de fuga"
        footer={
          <div className="flex items-center gap-2">
            <CircleAlert className={`h-4 w-4 ${risk.tone}`} aria-hidden="true" />
            <p className={`text-sm font-semibold ${risk.tone}`}>{risk.text}</p>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <Gauge value={churnPct} label="Riesgo de fuga" />
          <p className="text-right text-xs leading-5 text-slate-500">
            {clientData.churnLabel ? `Diagnóstico: ${clientData.churnLabel}` : 'Probabilidad estimada de fuga en los próximos meses.'}
          </p>
        </div>
      </SignalCard>

      <SignalCard
        title="Propensión Movistar Total"
        footer={
          <div className="flex items-center gap-2">
            <Sprout className="h-4 w-4 text-[#2E9E5B]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[#2E9E5B]">Alta afinidad convergente</p>
          </div>
        }
      >
        <div className="flex items-center justify-between gap-4">
          <Gauge value={mtPct} label="Propensión Movistar Total" />
          <p className="text-right text-xs leading-5 text-slate-500">
            Qué tan probable es que el cliente acepte un plan Movistar Total (fibra + móvil).
          </p>
        </div>
      </SignalCard>

      <SignalCard
        title="Veredicto de contacto"
        footer={
          <div className="flex items-center gap-2">
            {acepta === true ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-[#2E9E5B]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#2E9E5B]">Cliente receptivo</p>
              </>
            ) : acepta === false ? (
              <>
                <Target className="h-4 w-4 text-[#B8860B]" aria-hidden="true" />
                <p className="text-sm font-semibold text-[#B8860B]">Cerrar con refuerzo</p>
              </>
            ) : (
              <p className="text-sm text-slate-500">Sin predicción del pipeline</p>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-2xl font-bold text-[#313235]">
            {acepta === true ? 'Sí ofrecer' : acepta === false ? 'Reforzar argumento' : '—'}
          </p>
          <p className="text-xs leading-5 text-slate-500">
            {clientData.scores?.mt_propensity != null && clientData.scores?.churn_risk != null
              ? 'Fuga moderada con alta propensión: prioriza la oferta convergente como beneficio de retención.'
              : 'El pipeline recomendará el tipo de pitch según el riesgo de fuga y la propensión al producto.'}
          </p>
          {clientData.decisionThreshold != null && (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Después del guion, decide con umbral de aceptación de{' '}
              <span className="font-semibold text-[#313235]">{Math.round(clientData.decisionThreshold * 100)}%</span>.
            </p>
          )}
        </div>
      </SignalCard>
    </div>
  )
}

export default SignalsRow