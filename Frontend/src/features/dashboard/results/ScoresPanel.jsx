import { AlertTriangle, Activity, ArrowDownRight, ArrowUpRight, CheckCircle2, MessageSquareWarning, ShieldAlert, Wallet } from 'lucide-react'
import SectionCard from './SectionCard'
import Gauge from './Gauge'
import Badge from './Badge'

const churnColor = (pct) => {
  if (pct <= 30) return '#2ECC71'
  if (pct <= 60) return '#F6C244'
  return '#FF6B35'
}

const formatSoles = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n !== 0 ? `${n > 0 ? '+' : ''}S/ ${n.toFixed(2)}` : null
}

const Signal = ({ icon: Icon, label, value, alert = false }) => (
  <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm">
    <span className="inline-flex items-center gap-2 text-slate-500">
      <Icon className={`h-4 w-4 ${alert ? 'text-red-500' : 'text-slate-400'}`} aria-hidden="true" />
      {label}
    </span>
    <span className={`font-semibold ${alert ? 'text-red-600' : 'text-[#313235]'}`}>{value ?? '—'}</span>
  </div>
)

const ScoresPanel = ({ clientData }) => {
  const { scores = {}, churnScore, churnLabel, churnAlert, pitchType, mtPropensity } = clientData
  const hasMlScores = scores && (scores.churn_risk != null || scores.mt_propensity != null)

  const churnPct = scores.churn_risk != null ? Math.round(Number(scores.churn_risk) * 100) : churnScore
  const mtPct = scores.mt_propensity != null ? Math.round(Number(scores.mt_propensity) * 100) : null
  const showMt = mtPct != null

  const profile = clientData.profile || {}
  const reclamosAlert = Number(profile.n_reclamos || 0) > 0
  const moraAlert = Number(profile.meses_moroso || 0) > 0
  const diferenciaGasto = formatSoles(profile.diferencia_gasto)

  return (
    <SectionCard
      title="Inteligencia predictiva"
      subtitle="Scores ML del pipeline"
      icon={<Activity className="h-5 w-5" aria-hidden="true" />}
      action={
        <Badge tone={churnAlert ? 'red' : 'green'}>
          {churnAlert ? <ShieldAlert className="h-3 w-3" aria-hidden="true" /> : <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
          {churnLabel || (churnAlert ? 'Riesgo alto' : 'Riesgo controlado')}
        </Badge>
      }
    >
      {!hasMlScores && !showMt && (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          {clientData.churnRisk || 'Sin datos de riesgo disponibles.'}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        {churnPct != null && (
          <Gauge
            value={churnPct}
            label="Riesgo de fuga"
            sublabel={pitchType === 'fidelizacion' ? 'Crítico' : 'Estable'}
            color={churnColor(churnPct)}
          />
        )}
        {showMt && (
          <Gauge value={mtPct} label="Propensión a Movistar Total" color="#019DF4" />
        )}
      </div>

      {!hasMlScores && (
        <div className="mt-5 flex items-center justify-between rounded-xl bg-[#FF6B35]/10 px-4 py-3 text-sm font-medium text-[#B23A00]">
          <span>Probabilidad estimada de churn (simulación)</span>
          <span>{churnScore}%</span>
        </div>
      )}

      {Object.keys(profile).length > 0 && (
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Signal icon={MessageSquareWarning} label="Reclamos" value={profile.n_reclamos ?? '—'} alert={reclamosAlert} />
          <Signal icon={ShieldAlert} label="Meses con mora" value={profile.meses_moroso ?? '—'} alert={moraAlert} />
          <Signal icon={AlertTriangle} label="Días de mora prom." value={profile.dias_mora_prom ?? '—'} alert={moraAlert} />
          <Signal icon={ArrowUpRight} label="Historial de mora" value={profile.historial_mora ?? '—'} />
          {diferenciaGasto && (
            <Signal
              icon={ArrowDownRight}
              label="Δ gasto (6m)"
              value={diferenciaGasto}
              alert={Number(profile.diferencia_gasto) < 0}
            />
          )}
          <Signal icon={Wallet} label="Riesgo de mora" value={profile.riesgo_mora_score ?? '—'} alert={moraAlert} />
        </div>
      )}
    </SectionCard>
  )
}

export default ScoresPanel