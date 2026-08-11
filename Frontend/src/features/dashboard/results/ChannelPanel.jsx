import { HandCoins, Megaphone, MessagesSquare, Navigation, Route, Timer } from 'lucide-react'
import SectionCard from './SectionCard'

const Row = ({ icon: Icon, label, value }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#019DF4]/10 text-[#019DF4]">
      <Icon className="h-4 w-4" aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold leading-5 text-[#313235]">{value || '—'}</p>
    </div>
  </div>
)

const ChannelPanel = ({ clientData }) => {
  const { channel = {}, rebates = [] } = clientData
  const hasChannel = channel && (channel.channel || channel.timing || channel.advice || channel.canal_actual)
  const hasRebates = Array.isArray(rebates) && rebates.length > 0

  if (!hasChannel && !hasRebates) return null

  return (
    <SectionCard
      title="Canal y momento de contacto"
      subtitle="Cómo y cuándo presentar la oferta"
      icon={<Navigation className="h-5 w-5 text-[#019DF4]" aria-hidden="true" />}
    >
      {hasChannel && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Row icon={Route} label="Canal actual" value={channel.canal_actual} />
          <Row icon={Megaphone} label="Canal sugerido" value={channel.channel} />
          <Row icon={Timer} label="Momento sugerido" value={channel.timing} />
          <Row icon={MessagesSquare} label="Enfoque" value={channel.advice} />
        </div>
      )}

      {hasRebates && (
        <div className="mt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#313235]">
            <HandCoins className="h-4 w-4 text-[#5BC500]" aria-hidden="true" /> Rebates / beneficios preparados
          </h3>
          <div className="space-y-3">
            {rebates.map((rebate, index) => (
              <div key={index} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-[#313235]">{rebate.motivo || `Rebate ${index + 1}`}</p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-500">Estrategia: </span>{rebate.estrategia || '—'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  <span className="font-medium text-slate-500">Argumento base: </span>{rebate.argumento_base || '—'}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default ChannelPanel