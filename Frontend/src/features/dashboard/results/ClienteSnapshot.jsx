import { CalendarDays, CircleAlert, MapPin, ShieldCheck, Smartphone, Tag, Tv, UserRound, Zap } from 'lucide-react'
import Badge from './Badge'

const formatMoney = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `S/ ${n.toFixed(2)}` : '—'
}

const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2.5">
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
      <Icon className="h-4 w-4 text-slate-500" aria-hidden="true" />
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="truncate text-sm font-semibold text-[#313235]">{value || '—'}</p>
    </div>
  </div>
)

const ClienteSnapshot = ({ clientData }) => {
  const profile = clientData.profile || {}
  const initial = (clientData.name || clientData.dni || 'C').trim().charAt(0).toUpperCase()
  const isReal = Boolean(clientData.salesPitch || clientData.offer?.nombre_oferta)

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-label="Resumen del cliente"
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <span
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#019DF4] to-[#0176b5] text-2xl font-bold text-white shadow-sm"
            aria-hidden="true"
          >
            {initial}
          </span>
          <div>
            <h2 className="text-xl font-semibold text-[#313235]">{clientData.name || 'Cliente'}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" aria-hidden="true" /> {clientData.dni || 'Sin ID'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" /> {profile.plan_actual_desc || profile.plan_actual || clientData.currentPlan}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Etiquetas del cliente">
              {profile.tipo_cliente && <Badge tone="slate">{profile.tipo_cliente}</Badge>}
              {profile.es_movistar_total && <Badge tone="purple" icon={Tv}>Movistar Total</Badge>}
              {profile.es_usuario_app && <Badge tone="blue" icon={Zap}>Usa app</Badge>}
              {clientData.churnAlert && <Badge tone="red" icon={CircleAlert}>Alerta de fuga</Badge>}
              {clientData.pitchType && <Badge tone="amber" icon={ShieldCheck}>{clientData.pitchType}</Badge>}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 lg:w-auto">
          <Stat icon={MapPin} label="Ubicación" value={profile.ubicacion_departamento} />
          <Stat icon={UserRound} label="Edad" value={profile.edad_rango} />
          <Stat icon={CalendarDays} label="Antigüedad" value={profile.antiguedad_meses != null ? `${profile.antiguedad_meses} meses` : null} />
          <Stat icon={Smartphone} label="Facturación" value={formatMoney(profile.monto_facturado_prom)} />
        </dl>
      </div>

      {!isReal && (
        <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800">
          Datos de demostración: no se obtuvo una recomendación del backend para este cliente. Busca un código CLI
          (ej. CLI000013) para ver el análisis completo.
        </p>
      )}
    </section>
  )
}

export default ClienteSnapshot