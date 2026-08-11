import { BadgeCheck, CalendarDays, CircleAlert, Landmark, MapPin, Phone, Sparkles, Tag, UserRound, Wifi } from 'lucide-react'
import Badge from './Badge'

const formatSoles = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `S/ ${n.toFixed(2)}` : null
}

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()

const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-2.5">
    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-semibold text-[#313235]">{value || '—'}</p>
    </div>
  </div>
)

const ClientHeader = ({ clientData }) => {
  const { name, dni, gestion_id, phone, profile = {}, churnAlert, pitchType, offer = {} } = clientData
  const arpu = formatSoles(profile.monto_facturado_prom ?? clientData.arpu)
  const plan = profile.plan_actual_desc || profile.plan_actual_id || clientData.currentPlan
  const antiguedad = profile.antiguedad_meses != null ? `${profile.antiguedad_meses} meses` : clientData.fidelity

  return (
    <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#019DF4]/5" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-20 right-24 h-44 w-44 rounded-full bg-[#5BC500]/5" aria-hidden="true" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#019DF4] to-[#008bd8] text-xl font-bold text-white shadow-md">
            {initials(name)}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-bold tracking-tight text-[#313235]">{name}</h2>
              {churnAlert && (
                <Badge tone="red">
                  <CircleAlert className="h-3 w-3" aria-hidden="true" /> Riesgo alto de fuga
                </Badge>
              )}
              {pitchType && (
                <Badge tone={pitchType === 'fidelizacion' ? 'amber' : 'green'}>
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {pitchType === 'fidelizacion' ? 'Retención' : 'Upselling'}
                </Badge>
              )}
              {offer.es_movistar_total && (
                <Badge tone="purple">
                  <Wifi className="h-3 w-3" aria-hidden="true" /> Movistar Total
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" /> {dni || 'Sin ID'}
              </span>
              {gestion_id && (
                <span className="hidden items-center gap-1.5 font-mono text-xs text-slate-400 sm:inline-flex">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" /> Gestión {gestion_id.slice(0, 10)}…
                </span>
              )}
              {phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> {phone}
                </span>
              )}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:w-auto">
          <Stat icon={MapPin} label="Ubicación" value={profile.ubicacion_departamento} />
          <Stat icon={UserRound} label="Edad" value={profile.edad_rango} />
          <Stat icon={CalendarDays} label="Antigüedad" value={antiguedad} />
          <Stat icon={Landmark} label="Facturación" value={arpu} />
        </dl>
      </div>

      <div className="relative mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm">
        <span className="font-medium text-slate-500">Plan actual: </span>
        <span className="font-semibold text-[#313235]">{plan}</span>
      </div>
    </header>
  )
}

export default ClientHeader