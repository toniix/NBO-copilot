import { useState } from "react";

const SkeletonLine = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
)

const offerCards = [
  {
    title: "Upgrade 30GB + Netflix",
    price: "S/ 49.90",
    description: "La mejor combinación de gigas y entretenimiento para el cliente.",
    margin: "Margen alto",
    message: "Señor cliente, le regalo 10GB extras y Netflix manteniéndole su tarifa.",
    objectionQuestion: "¿Si dice que está caro?",
    objectionAnswer: "Le descontamos S/ 10 los primeros 3 meses.",
    recommended: true,
  },
  {
    title: "Plan 25GB Fidelización",
    price: "S/ 44.90",
    description: "Alternativa económica con precio rebajado.",
    margin: "Margen medio",
    message: "Si desea estabilidad, este plan ofrece valor con un precio especial.",
    objectionQuestion: "¿Y si quiere conservar su tarifa actual?",
    objectionAnswer: "Con este plan gana continuidad y ahorra en su factura mensual.",
    recommended: false,
  },
  {
    title: "Bono 10GB por 3 meses",
    price: "S/ 39.90",
    description: "Bono de entrada para mantener al cliente.",
    margin: "Margen controlado",
    message: "Este bono temporal mantiene al cliente con flexibilidad y baja inversión.",
    objectionQuestion: "¿Prefiere una opción sin compromiso largo?",
    objectionAnswer: "El bono le ofrece minutos extra sin subir su tarifa base.",
    recommended: false,
  },
];

const ResultsBoard = ({ isLoading, clientData, error, onAccept, onReject, salesToday, dailyTarget }) => {
  const [selectedOffer, setSelectedOffer] = useState(0);
  const [showObjectionReply, setShowObjectionReply] = useState(false);
  const [offerFeedback, setOfferFeedback] = useState("");

  const selectedCard = offerCards[selectedOffer];

  const handleReject = () => {
    setOfferFeedback("Cliente no aceptó la oferta.");
    setShowObjectionReply(false);
    if (typeof onReject === "function") {
      onReject();
    }
  };

  const handleAccept = () => {
    if (typeof onAccept === "function") {
      onAccept(selectedOffer);
    }
    setOfferFeedback(`Oferta aceptada: ${selectedCard.title}`);
    setShowObjectionReply(false);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3" aria-label="Procesando análisis">
        {[0, 1, 2].map((card) => (
          <section key={card} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <SkeletonLine className="h-10 w-10 rounded-xl" />
              <SkeletonLine className="h-5 w-36" />
            </div>
            <SkeletonLine className="mb-3 h-4 w-3/4" />
            <SkeletonLine className="mb-3 h-4 w-1/2" />
            <SkeletonLine className="h-4 w-2/3" />
          </section>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!clientData) return null

  const clientName = clientData.name?.split(" ")[0] || clientData.name;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Propuesta Comercial
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Oferta para {clientData.name}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Selecciona la alternativa presentada y registra el resultado de la conversación.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleReject}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              No aceptó
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="rounded-2xl bg-[#5eb800] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#4fa000]"
            >
              Aceptó oferta
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {offerCards.map((card, index) => {
            const isSelected = selectedOffer === index;
            return (
              <article
                key={card.title}
                role="button"
                onClick={() => setSelectedOffer(index)}
                className={`relative flex h-full cursor-pointer flex-col justify-between rounded-3xl border p-5 shadow-sm transition duration-200 ${
                  isSelected
                    ? "border-[#5eb800] bg-[#f4fbf0] shadow-sm"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                }`}
              >
                <div>
                  <div className={`absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full border text-sm font-semibold shadow-sm ${
                    isSelected ? "border-[#5eb800] bg-[#ebffe0] text-[#5eb800]" : "border-slate-200 bg-white text-slate-500"
                  }`}>
                    {isSelected ? "✓" : "◯"}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      {card.recommended && (
                        <span className="inline-flex rounded-full bg-[#5eb800] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white">
                          Recomendada
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-slate-900">{card.title}</h3>
                  <p className="mt-3 text-4xl font-bold text-slate-950">{card.price}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{card.description}</p>
                </div>
                <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm font-semibold text-slate-700">
                  {card.margin}
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-800">
          <p className="font-medium text-slate-900">{selectedCard.message}</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShowObjectionReply((current) => !current)}
            className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {selectedCard.objectionQuestion}
          </button>
          {showObjectionReply && (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
              {selectedCard.objectionAnswer}
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Ventas de hoy</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{salesToday}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Meta diaria</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{dailyTarget}</p>
        </div>
      </section>

      {offerFeedback && (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
          {offerFeedback}
        </div>
      )}
    </div>
  )
}

export default ResultsBoard