import { useMemo, useState } from 'react'
import { CheckCircle2, Sparkles, Tv, Wifi } from 'lucide-react'

const formatPrice = (value) => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? `S/ ${n.toFixed(2)}` : '—'
}

const FeesBadge = ({ offer }) => {
  if (offer.es_movistar_total) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-[#5eb800] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
        <Tv className="h-3 w-3" aria-hidden="true" /> Movistar Total
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
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
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Propuesta comercial">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Propuesta Comercial</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Oferta para {clientData.name || 'el cliente'}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Selecciona la alternativa y registra el resultado de la conversación.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleReject}
            className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#019DF4]"
          >
            No aceptó
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="rounded-2xl bg-[#5eb800] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4fa000] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#019DF4]"
          >
            Aceptó oferta
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((offer) => {
          const isSelected = effectiveSelected === offer.oferta_id
          const isRecommended = offer.oferta_id === recommendedId
          return (
            <button
              key={offer.oferta_id}
              type="button"
              onClick={() => setSelectedOfferId(offer.oferta_id)}
              aria-pressed={isSelected}
              aria-label={`Seleccionar oferta ${offer.nombre_oferta}`}
              className={`relative flex h-full cursor-pointer flex-col justify-between rounded-3xl border p-5 text-left shadow-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#019DF4] ${
                isSelected
                  ? 'border-[#5eb800] bg-[#f4fbf0] shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <span className="flex flex-1 flex-col">
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
                    isSelected ? 'border-[#5eb800] bg-[#ebffe0] text-[#5eb800]' : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {isSelected ? '✓' : '◯'}
                </span>
                {isRecommended && (
                  <span className="inline-flex w-fit rounded-full bg-[#5eb800] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Recomendada
                  </span>
                )}
                {!isRecommended && <FeesBadge offer={offer} />}
                <span className="mt-5 block text-base font-semibold leading-tight text-slate-900">
                  {offer.nombre_oferta}
                </span>
                <span className="mt-3 block text-4xl font-bold text-slate-950">{formatPrice(offer.precio_mensual)}</span>
                <span className="mt-3 block text-sm leading-6 text-slate-700">
                  {offer.gb_incluidos != null && offer.gb_incluidos < 9999
                    ? `${offer.gb_incluidos} GB de datos`
                    : 'Datos ilimitados'}
                </span>
              </span>
              <span className="mt-4 flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <span className="font-semibold text-slate-700">
                  {Number(offer.score || 0).toFixed(2)} puntos
                </span>
                <span className="text-xs font-medium text-slate-500">
                  aceptación {Math.round((offer.p_acceptance || 0) * 100)}%
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-[#5eb800]/30 bg-[#f4fbf0] p-4 text-sm text-slate-700">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[#3f8b00]" aria-hidden="true" />
        <p>
          Recomendación IA:{' '}
          <span className="font-semibold text-[#313235]">
            {nbo || (recommendedId ? cards.find((c) => c.oferta_id === recommendedId)?.nombre_oferta : '—')}
          </span>
          {clientData.justification ? ` — ${clientData.justification}` : ''}
        </p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {feedback}
      </p>
    </section>
  )
}

export default PropuestaComercial