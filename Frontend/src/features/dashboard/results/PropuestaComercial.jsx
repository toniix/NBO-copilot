import { useMemo, useState } from 'react'
import { CheckCircle2, Tv, Wifi } from 'lucide-react'

const formatPrice = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `S/ ${n.toFixed(2)}` : '—'
}

const FeesBadge = ({ offer }) => {
  if (offer.es_movistar_total) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
        <Tv className="h-3 w-3" aria-hidden="true" /> Movistar Total
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
      <Wifi className="h-3 w-3" aria-hidden="true" /> {offer.tipo_oferta || 'Plan Móvil'}
    </span>
  )
}

const PropuestaComercial = ({ clientData, onAccept, onReject }) => {
  const offers = clientData.offers || []
  const nbo = clientData.offer?.nombre_oferta || clientData.nboSelected
  const [selectedOfferId, setSelectedOfferId] = useState(null)
  const [feedback, setFeedback] = useState('')

  const cards = useMemo(() => {
    const fromBackend = offers.filter((offer) => offer && offer.nombre_oferta)
    if (fromBackend.length > 0) return fromBackend
    return clientData.offer?.nombre_oferta ? [clientData.offer] : []
  }, [offers, clientData.offer])

  const recommendedId = clientData.offer?.oferta_id || null

  const applyFeedback = (text) => {
    setFeedback(text)
    if (typeof window !== 'undefined') {
      window.setTimeout(() => setFeedback(''), 4000)
    }
  }

  const handleReject = () => {
    applyFeedback('Cliente no aceptó la oferta.')
    if (typeof onReject === 'function') onReject()
  }

  const handleAccept = () => {
    applyFeedback('Venta registrada: oferta aceptada.')
    if (typeof onAccept === 'function') onAccept(selectedOfferId)
  }

  if (cards.length === 0) {
    return null
  }

  const effectiveSelected = selectedOfferId || recommendedId || cards[0]?.oferta_id

  return (
    <section className="flex h-full flex-col justify-between rounded-3xl border border-[#5BC500]/40 bg-white p-6 shadow-sm" aria-label="Propuesta comercial">
      <div>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#3f8b00]">
              Propuesta Comercial
            </span>
            <h2 className="text-lg font-bold text-[#313235]">
              Ofertas Sugeridas
            </h2>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#019DF4]"
            >
              No aceptó
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="rounded-xl bg-[#5BC500] px-4 py-2 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#4da900] focus-visible:outline-2 focus-visible:outline-[#019DF4]"
            >
              Aceptó oferta
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {cards.map((offer) => {
            const isSelected = effectiveSelected === offer.oferta_id
            const isRecommended = offer.oferta_id === recommendedId
            return (
              <button
                key={offer.oferta_id || offer.nombre_oferta}
                type="button"
                onClick={() => setSelectedOfferId(offer.oferta_id)}
                aria-pressed={isSelected}
                aria-label={`Seleccionar oferta ${offer.nombre_oferta}`}
                className={`group relative flex w-full cursor-pointer items-center justify-between rounded-2xl border p-4 text-left shadow-2xs transition-all duration-200 focus-visible:outline-2 focus-visible:outline-[#019DF4] ${
                  isSelected
                    ? 'border-2 border-[#5BC500] bg-[#f4fbe9] shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="min-w-0 flex-1 pr-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {isRecommended && (
                      <span className="inline-flex rounded-full bg-[#5BC500] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                        RECOMENDADA
                      </span>
                    )}
                    {!isRecommended && <FeesBadge offer={offer} />}
                  </div>
                  <p className="mt-1.5 text-base font-bold text-[#1e293b] leading-snug">
                    {offer.nombre_oferta}
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">
                    {offer.gb_incluidos != null && offer.gb_incluidos < 9999
                      ? `${offer.gb_incluidos} GB de datos`
                      : 'Datos ilimitados'}
                    {offer.p_acceptance != null && (
                      <span className="ml-2 font-bold text-[#3f8b00]">
                        · {Math.round(offer.p_acceptance * 100)}% aceptación
                      </span>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-right">
                  <div>
                    <p className="text-xl font-extrabold text-[#0f172a]">{formatPrice(offer.precio_mensual)}</p>
                    <p className="text-[10px] uppercase font-semibold text-slate-400">mensual</p>
                  </div>
                  <div
                    aria-hidden="true"
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${
                      isSelected ? 'border-[#5BC500] bg-white text-[#5BC500]' : 'border-slate-200 bg-white text-transparent'
                    }`}
                  >
                    ✓
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {feedback}
      </p>
    </section>
  )
}

export default PropuestaComercial