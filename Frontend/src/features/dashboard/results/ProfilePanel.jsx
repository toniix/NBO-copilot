import { Database, Home, Smartphone, Tv, UserRound, Wifi, Zap } from 'lucide-react'
import SectionCard from './SectionCard'
import Badge from './Badge'

const formatNumber = (value, suffix = '') => {
  const n = Number(value)
  return Number.isFinite(n) && value != null ? `${n}${suffix}` : '—'
}

const Metric = ({ label, value, hint }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-lg font-bold text-[#313235]">{value ?? '—'}</p>
    {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
  </div>
)

const ProfilePanel = ({ clientData }) => {
  const profile = clientData.profile || {}
  if (!profile || Object.keys(profile).length === 0) return null

  const services = [
    { label: 'Móvil', active: profile.tiene_movil, icon: Smartphone },
    { label: 'Hogar', active: profile.tiene_hogar, icon: Home },
    { label: 'Internet Hogar', active: profile.tiene_internet_hogar, icon: Wifi },
    { label: 'Movistar Total', active: profile.es_movistar_total, icon: Tv },
    { label: 'Usa app Movistar', active: profile.es_usuario_app, icon: Zap },
  ]

  return (
    <SectionCard
      title="Perfil y comportamiento"
      subtitle="Datos de la línea y hábitos de consumo"
      icon={<UserRound className="h-5 w-5 text-[#019DF4]" aria-hidden="true" />}
    >
      <div className="flex flex-wrap gap-2">
        {services.map(({ label, active, icon: Icon }) => (
          <Badge key={label} tone={active ? 'green' : 'slate'}>
            <Icon className="h-3 w-3" aria-hidden="true" /> {label}
          </Badge>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Metric label="Datos promedio" value={formatNumber(profile.consumo_datos_gb_prom, ' GB')} hint="por mes" />
        <Metric label="Voz promedio" value={formatNumber(profile.consumo_voz_min_prom, ' min')} hint="por mes" />
        <Metric label="SMS promedio" value={formatNumber(profile.consumo_sms_prom)} hint="por mes" />
        <Metric label="Uso app Movistar" value={formatNumber(profile.uso_app_movistar_prom)} hint="puntuación" />
        <Metric label="GB del plan" value={formatNumber(profile.gb_plan_actual, ' GB')} hint="plan actual" />
        {profile.brecha_datos_aplica ? (
          <Metric label="Brecha de datos" value={formatNumber(profile.brecha_datos, ' GB')} hint="consumo vs plan" />
        ) : (
          <Metric label="Plan ilimitado" value="∞" hint="sin brecha" />
        )}
        {profile.ahorro_potencial_mt_aplica ? (
          <Metric label="Ahorro MT potencial" value={`S/ ${formatNumber(profile.ahorro_potencial_mt)}`} hint="por converger" />
        ) : null}
        <Metric label="Ratio uso de datos" value={`${formatNumber(profile.ratio_uso_datos * 100)}%`} hint="intensidad" />
      </div>

      {profile.plan_actual_id && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5" aria-hidden="true" /> Plan ID: {profile.plan_actual_id}
          </span>
          {profile.oferta_hogar_id && <span>Hogar: {profile.oferta_hogar_id}</span>}
          {profile.canal_mas_usado && <span>Canal favorito: {profile.canal_mas_usado}</span>}
          {profile.n_reclamos_categoria && <span>Reclamos: {profile.n_reclamos_categoria}</span>}
        </div>
      )}
    </SectionCard>
  )
}

export default ProfilePanel