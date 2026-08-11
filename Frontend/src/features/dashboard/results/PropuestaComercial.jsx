import { useMemo, useState } from 'react'
import { CheckCircle2, Sparkles } from 'lucide-react'

const offerCards = [
  {
    title: 'Upgrade 30GB + Netflix',
    price: 'S/ 49.90',
    description: 'La mejor combinación de gigas y entretenimiento para el cliente.',
    margin: 'Margen alto',
    message: 'Señor cliente, le regalo 10GB extras y Netflix manteniéndole su tarifa.',
    objectionQuestion: '¿Si dice que está caro?',
    objectionAnswer: 'Le descontamos S/ 10 los primeros 3 meses.',
    recommended: true,
  },
  {
    title: 'Plan 25GB Fidelización',
    price: 'S/ 44.90',
    description: 'Alternativa económica con precio rebajado.',
    margin: 'Margen medio',
    message: 'Si desea estabilidad, este plan ofrece valor con un precio especial.',
    objectionQuestion: '¿Y si quiere conservar su tarifa actual?',
    objectionAnswer: 'Con este plan gana continuidad y ahorra en su factura mensual.',
    recommended: false,
  },
  {
    title: 'Bono 10GB por 3 meses',
    price: 'S/ 39.90',
    description: 'Bono de entrada para mantener al cliente.',
    margin: 'Margen controlado',
    message: 'Este bono temporal mantiene al cliente con flexibilidad y baja inversión.',
    objectionQuestion: '¿Prefiere una opción sin compromiso largo?',
    objectionAnswer: 'El bono le ofrece minutos extra sin subir su tarifa base.',
    recommended: false,
  },
]

const PropuestaComercial = ({ clientData, onAccept, onReject }) => {
  const [selectedOffer, setSelectedOffer] = useState(0)
  const [showObjectionReply, setShowObjectionReply] = useState(false)
  const [feedback, setFeedback] = useState('')

  const cards = useMemo(() => {
    if (!clientData.offer?.nombre_oferta) return offerCards
    return offerCards.map((card, index) => (index === 0 ? { ...card, aiOffer: clientData.offer } : card))
  }, [clientData.offer])

  const selectedCard = cards[selectedOffer]
  const aiOffer = clientData.offer?.es_movistar_total === false ? null : clientData.offer

  const handleReject = () => {
    setFeedback('Cliente no aceptó la oferta.')
    setShowObjectionReply(false)
    if (typeof onReject === 'function') onReject()
  }

  const handleAccept = () => {
    if (typeof onAccept === 'function') onAccept(selectedOffer)
    setFeedback(`Oferta aceptada: ${selectedCard.title}`)
    setShowObjectionReply(false)
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="Propuesta comercial">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Propuesta Comercial</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">Oferta para {clientData.name || 'el cliente'}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Selecciona la alternativa presentada y registra el resultado de la conversación.
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

      {aiOffer && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-[#5eb800]/40 bg-[#f4fbf0] p-4 sm:flex-row sm:items-center sm:justify-between" role="note">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#3f8b00]" aria-hidden="true" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#3f8b00]">Recomendación IA del pipeline</p>
              <p className="mt-1 text-base font-bold text-[#313235]">{aiOffer.nombre_oferta}</p>
              {clientData.justification && (
                <p className="mt-1 text-sm leading-6 text-slate-600">{clientData.justification}</p>
              )}
            </div>
          </div>
          <dl className="flex shrink-0 items-center gap-5">
            {aiOffer.precio_mensual != null && (
              <div>
                <dt className="sr-only">Precio mensual</dt>
                <dd className="text-2xl font-extrabold text-[#313235]">S/ {Number(aiOffer.precio_mensual).toFixed(2)}</dd>
                <p className="text-xs text-slate-500">al mes</p>
              </div>
            )}
            {aiOffer.gb_incluidos != null && aiOffer.gb_incluidos < 9999 && (
              <div>
                <dt className="sr-only">Gigas incluidos</dt>
                <dd className="text-xl font-bold text-[#313235]">{aiOffer.gb_incluidos} GB</dd>
                <p className="text-xs text-slate-500">de datos</p>
              </div>
            )}
            {aiOffer.p_acceptance != null && (
              <div>
                <dt className="sr-only">Probabilidad de aceptación</dt>
                <dd className="text-xl font-bold text-[#5eb800]">{Math.round(aiOffer.p_acceptance * 100)}%</dd>
                <p className="text-xs text-slate-500">aceptación</p>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((card, index) => {
          const isSelected = selectedOffer === index
          return (
            <button
              key={`${card.title}-${index}`}
              type="button"
              onClick={() => setSelectedOffer(index)}
              aria-pressed={isSelected}
              aria-label={`Seleccionar oferta ${card.title}`}
              className={`relative flex h-full cursor-pointer flex-col justify-between rounded-3xl border p-5 text-left shadow-sm transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#019DF4] ${
                isSelected
                  ? 'border-[#5eb800] bg-[#f4fbf0] shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <span>
                <span
                  aria-hidden="true"
                  className={`absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
                    isSelected ? 'border-[#5eb800] bg-[#ebffe0] text-[#5eb800]' : 'border-slate-200 bg-white text-slate-500'
                  }`}
                >
                  {isSelected ? '✓' : '◯'}
                </span>
                {card.recommended && (
                  <span className="inline-flex rounded-full bg-[#5eb800] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                    Recomendada
                  </span>
                )}
                <span className="mt-5 block text-lg font-semibold text-slate-900">{card.title}</span>
                <span className="mt-3 block text-4xl font-bold text-slate-950">{card.price}</span>
                <span className="mt-3 block text-sm leading-6 text-slate-700">{card.description}</span>
              </span>
              <span className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                {card.margin}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-800">
        <p className="font-medium text-slate-900">{selectedCard.message}</p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setShowObjectionReply((current) => !current)}
          aria-expanded={showObjectionReply}
          className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#019DF4]"
        >
          {selectedCard.objectionQuestion}
        </button>
        {showObjectionReply && (
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            {selectedCard.objectionAnswer}
          </div>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {feedback}
      </p>
      {feedback && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#5eb800]/30 bg-[#f4fbf0] p-4 text-sm font-medium text-[#3f8b00]">
          <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          {feedback}
        </div>
      )}
    </section>
  )
}

export default PropuestaComercial