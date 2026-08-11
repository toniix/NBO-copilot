import { HandCoins, MessagesSquare, Route, Timer } from 'lucide-react'
import Section from './Section'

const CanalPanel = ({ clientData }) => {
  const channel = clientData.channel || {}
  const rebates = clientData.rebates || []

  if (!channel.channel && rebates.length === 0) return null

  return (
    <Section
      title="Cómo contactar y cerrar"
      subtitle="Canal, momento ideal y palanca de rebate"
      icon={MessagesSquare}
      accent="text-[#3f8b00]"
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <dl className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <MessagesSquare className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Canal recomendado</dt>
              <dd className="font-semibold text-[#313235]">{channel.channel || channel.canal_actual || '—'}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
              <Timer className="h-4 w-4 text-slate-500" aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Momento ideal</dt>
              <dd className="font-semibold text-[#313235]">{channel.timing || '—'}</dd>
            </div>
          </div>
          {channel.advice && (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                <Route className="h-4 w-4 text-slate-500" aria-hidden="true" />
              </span>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Consejo de ejecución</dt>
                <dd className="text-sm leading-6 text-slate-700">{channel.advice}</dd>
              </div>
            </div>
          )}
        </dl>

        <div>
          {rebates.length > 0 ? (
            <dl className="space-y-3">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">Palancas de rebate</dt>
              {rebates.map((rebate, index) => (
                <dd
                  key={`${rebate.motivo || 'rebate'}-${index}`}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-4"
                >
                  <HandCoins className="mt-0.5 h-5 w-5 shrink-0 text-[#B8860B]" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-semibold capitalize text-[#313235]">{rebate.motivo || 'Oferta especial'}</p>
                    <p className="mt-0.5 text-sm leading-6 text-slate-600">{rebate.estrategia}</p>
                    {rebate.argumento_base && (
                      <p className="mt-1 text-xs italic leading-5 text-slate-500">«{rebate.argumento_base}»</p>
                    )}
                  </div>
                </dd>
              ))}
            </dl>
          ) : (
            <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
              Sin palancas de rebate para este cliente.
            </p>
          )}
        </div>
      </div>
    </Section>
  )
}

export default CanalPanel