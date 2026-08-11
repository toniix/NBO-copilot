import { CheckCircle2, Clock, Gauge, Gift, Info, Layers, TrendingUp } from 'lucide-react'
import SectionCard from './SectionCard'
import Badge from './Badge'
import ProgressBar from './ProgressBar'

const formatSoles = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n != null ? `S/ ${n.toFixed(2)}` : '—'
}

const OfferRow = ({ offer, selected }) => {
  const pct = offer.p_acceptance != null ? Math.round(Number(offer.p_acceptance) * 100) : null

  return (
    <div className={`rounded-xl border p-4 ${selected ? 'border-[#019DF4] bg-blue-50/40' : 'border-slate-100 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[#313235]">{offer.nombre_oferta}</p>
            {selected && (
              <Badge tone="blue">
                <Gift className="h-3 w-3" aria-hidden="true" /> Seleccionada
              </Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {offer.tipo_oferta && <span className="capitalize">{offer.tipo_oferta}</span>}
            {offer.segmento_objetivo && <span className="capitalize"> · {offer.segmento_objetivo}</span>}
            {offer.cluster_hogar && <span> · {offer.cluster_hogar}</span>}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-bold text-[#313235]">{formatSoles(offer.precio_mensual)}</span>
          {offer.gb_incluidos != null && offer.gb_incluidos < 9999 && (
            <span className="text-slate-500">{offer.gb_incluidos} GB</span>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        {pct != null && (
          <div className="flex-1">
            <ProgressBar label="Probabilidad de aceptación" value={pct} color="#5BC500" />
          </div>
        )}
        {offer.ahorro_pct != null && (
          <span className="shrink-0 text-xs font-semibold text-[#3f8b00]">
            Ahorro {offer.ahorro_pct}%
          </span>
        )}
      </div>
    </div>
  )
}

const OfferPanel = ({ clientData, onOffer }) => {
  const { offer = {}, offers = [], justification, decisionThreshold, aceptaPredicho } = clientData
  const hasOffer = offer && offer.nombre_oferta
  const hasAlternatives = Array.isArray(offers) && offers.length > 0
  const selectedId = offer.oferta_id
  const pct = offer.p_acceptance != null ? Math.round(Number(offer.p_acceptance) * 100) : null

  return (
    <SectionCard
      title="Next Best Offer"
      subtitle={hasOffer ? 'Oferta recomendada por el pipeline' : 'Oferta sugerida'}
      icon={<Gift className="h-5 w-5 text-[#5BC500]" aria-hidden="true" />}
      className="border-[#5BC500]/40"
      action={
        <button
          type="button"
          onClick={onOffer}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#5BC500] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4da900] focus:outline-none focus:ring-4 focus:ring-[#5BC500]/20"
        >
          <TrendingUp className="h-4 w-4" aria-hidden="true" /> Ofrecer Plan
        </button>
      }
    >
      {hasOffer ? (
        <div className="rounded-2xl bg-gradient-to-br from-[#5BC500]/10 to-transparent p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#3f8b00]">Oferta recomendada</p>
              <h3 className="mt-1 text-2xl font-bold text-[#313235]">{offer.nombre_oferta}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {offer.es_movistar_total && <Badge tone="purple">Movistar Total</Badge>}
                {offer.tipo_oferta && <Badge tone="slate">{offer.tipo_oferta}</Badge>}
                {offer.segmento_objetivo && <Badge tone="blue">{offer.segmento_objetivo}</Badge>}
              </div>
            </div>
            <div className="flex items-end gap-5">
              <div className="text-right">
                <p className="text-3xl font-extrabold text-[#313235]">{formatSoles(offer.precio_mensual)}</p>
                <p className="text-xs text-slate-500">al mes</p>
              </div>
              {offer.gb_incluidos != null && offer.gb_incluidos < 9999 && (
                <div className="text-right">
                  <p className="text-2xl font-bold text-[#313235]">{offer.gb_incluidos} GB</p>
                  <p className="text-xs text-slate-500">de datos</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {pct != null && (
              <ProgressBar label="Probabilidad de aceptación" value={pct} color="#5BC500" />
            )}
            {offer.ahorro_pct != null && (
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <span className="text-slate-500">Ahorro estimado</span>
                <span className="font-bold text-[#3f8b00]">{offer.ahorro_pct}%</span>
              </div>
            )}
          </div>

          {(aceptaPredicho != null || decisionThreshold != null) && (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-white px-3 py-2.5 text-sm">
              {aceptaPredicho != null ? (
                aceptaPredicho ? (
                  <Badge tone="green">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Alta probabilidad de aceptación
                  </Badge>
                ) : (
                  <Badge tone="amber">
                    <Clock className="h-3 w-3" aria-hidden="true" /> Probabilidad bajo umbral de decisión
                  </Badge>
                )
              ) : (
                <Badge tone="slate">
                  <Gauge className="h-3 w-3" aria-hidden="true" /> Sin umbral de decisión configurado
                </Badge>
              )}
              {decisionThreshold != null && (
                <span className="text-xs text-slate-500">Umbral p_aceptación: {Math.round(decisionThreshold * 100)}%</span>
              )}
            </div>
          )}

          {justification && (
            <p className="mt-4 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-600">
              <Info className="mr-1.5 inline h-4 w-4 text-[#019DF4]" aria-hidden="true" />
              {justification}
            </p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#5BC500]/10 p-5">
          <p className="text-lg font-semibold text-[#313235]">{clientData.nextBestOffer || 'Oferta recomendada'}</p>
          <button type="button" onClick={onOffer} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#5BC500] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4da900]">
            <Gift className="h-4 w-4" aria-hidden="true" /> Ofrecer Plan
          </button>
        </div>
      )}

      {hasAlternatives && (
        <div className="mt-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#313235]">
            <Layers className="h-4 w-4 text-[#019DF4]" aria-hidden="true" /> Alternativas consideradas ({offers.length})
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {offers.map((o) => (
              <OfferRow key={o.oferta_id || o.nombre_oferta} offer={o} selected={selectedId && o.oferta_id === selectedId} />
            ))}
          </div>
        </div>
      )}
    </SectionCard>
  )
}

export default OfferPanel