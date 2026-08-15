import { BadgeCheck, Tv, Wifi } from "lucide-react";

const formatPrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `S/ ${n.toFixed(2)}` : "—";
};

const gbLabel = (offer) => {
  const gb = Number(offer.gb_incluidos);
  if (gb >= 9999) return "Datos ilimitados";
  if (Number.isFinite(gb) && gb > 0) return `${gb} GB`;
  return null;
};

const OffersCarousel = ({ clientData }) => {
  const offers = (clientData.offers || []).filter((o) => o && o.nombre_oferta);
  const nboId = clientData.offer?.oferta_id;
  const others = offers.filter((o) => o.oferta_id !== nboId);

  if (others.length === 0) return null;

  return (
    <section aria-label="Otras opciones de oferta">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-500">
          Otras opciones de oferta
        </h3>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
          {others.length}
        </span>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2">
        {others.map((offer) => {
          const gb = gbLabel(offer);
          const ahorro = Number(offer.ahorro_pct) > 0 ? offer.ahorro_pct : null;
          const aceptacion = Number(offer.p_acceptance);
          const esTotal = Boolean(offer.es_movistar_total);
          return (
            <article
              key={offer.oferta_id || offer.nombre_oferta}
              className="w-64 shrink-0 snap-start rounded-2xl border border-slate-200 bg-white p-4 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                    esTotal
                      ? "bg-purple-100 text-purple-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {esTotal ? (
                    <Tv className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <Wifi className="h-3 w-3" aria-hidden="true" />
                  )}
                  {esTotal ? "Total" : offer.tipo_oferta || "Plan"}
                </span>
                {ahorro && (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#3f8b00]">
                    <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                    {ahorro}%
                  </span>
                )}
              </div>

              <p className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-[#313235]">
                {offer.nombre_oferta}
              </p>
              <p className="mt-2 text-lg font-extrabold text-[#0f172a]">
                {formatPrice(offer.precio_mensual)}
                <span className="ml-1 text-[10px] font-semibold uppercase text-slate-400">
                  /mes
                </span>
              </p>

              {gb && (
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {gb}
                </p>
              )}

              {Number.isFinite(aceptacion) && (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-[10px] font-semibold text-slate-400">
                    <span>Aceptación</span>
                    <span>{Math.round(aceptacion * 100)}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#019DF4]"
                      style={{ width: `${Math.round(aceptacion * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default OffersCarousel;
