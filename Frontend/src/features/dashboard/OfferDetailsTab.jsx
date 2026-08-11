import { CheckCircle2, Circle, X } from "lucide-react";
import { offerCatalog } from "../../store/useDashboardStore.js";

const OfferDetailsTab = ({
  clientData,
  selectedOfferId,
  outcome,
  onSelectOffer,
  onOutcome,
  onClose,
}) => (
  <section
    className="border-b border-slate-200 bg-white shadow-sm"
    aria-label="Detalle de ofertas"
  >
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#019DF4]">
            Propuesta comercial
          </p>
          <h2 className="mt-1 text-xl font-semibold text-[#313235]">
            Oferta para {clientData.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Selecciona la alternativa presentada y registra el resultado de la
            conversación.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar detalle de ofertas"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-[#313235]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {offerCatalog.map((offer) => {
          const selected = selectedOfferId === offer.id;
          return (
            <button
              key={offer.id}
              type="button"
              onClick={() => onSelectOffer(offer.id)}
              className={`relative rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-4 focus:ring-[#019DF4]/15 ${offer.recommended ? "border-[#5BC500] bg-[#5BC500]/5 shadow-md" : selected ? "border-[#019DF4] bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              {offer.recommended && (
                <span className="absolute -top-3 left-4 rounded-full bg-[#5BC500] px-3 py-1 text-xs font-bold text-white">
                  Recomendada
                </span>
              )}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#313235]">
                  {offer.name}
                </span>
                {selected ? (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-[#019DF4]"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-5 w-5 shrink-0 text-slate-300"
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className="mt-4 text-2xl font-bold text-[#313235]">
                {offer.price}
              </p>
              <p className="mt-2 text-sm leading-5 text-slate-500">
                {offer.description}
              </p>
              <p
                className={`mt-4 text-xs font-semibold ${offer.recommended ? "text-[#3f8b00]" : "text-slate-500"}`}
              >
                {offer.margin}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
        {outcome ? (
          <p role="status" className="text-sm font-semibold text-[#3f8b00]">
            Resultado registrado:{" "}
            {outcome === "accepted" ? "Aceptó oferta" : "No aceptó oferta"}.
          </p>
        ) : (
          <p className="text-sm text-slate-500">
            Elige una opción y registra la respuesta del cliente.
          </p>
        )}
        <div className="flex w-full gap-3 sm:w-auto">
          <button
            type="button"
            onClick={() => onOutcome("rejected")}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:flex-none"
          >
            No aceptó
          </button>
          <button
            type="button"
            onClick={() => onOutcome("accepted")}
            className="flex-1 rounded-lg bg-[#5BC500] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#4da900] sm:flex-none"
          >
            Aceptó oferta
          </button>
        </div>
      </div>
    </div>
  </section>
);

export default OfferDetailsTab;
