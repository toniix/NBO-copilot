import {
  AlertTriangle,
  BadgeCheck,
  HandCoins,
  MessagesSquare,
  Route,
  Timer,
  Tv,
  Wifi,
} from "lucide-react";

const formatPrice = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `S/ ${n.toFixed(2)}` : "—";
};

const OfferTypeBadge = ({ offer }) => {
  const esTotal = Boolean(offer?.es_movistar_total);
  const tipo = esTotal ? "Movistar Total" : offer?.tipo_oferta || "Plan";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
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
      {tipo}
    </span>
  );
};

const Chip = ({ icon: Icon, label, value, tone = "text-slate-700" }) => (
  <span className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold shadow-2xs">
    {Icon && <Icon className={`h-3.5 w-3.5 ${tone}`} aria-hidden="true" />}
    <span className={tone}>{label}</span>
    {value != null && <span className="text-[#313235]">{value}</span>}
  </span>
);

const NboCommandCenter = ({ clientData, onAccept, onReject }) => {
  const offer = clientData.offer || {};
  const channel = clientData.channel || {};
  const rebates = clientData.rebates || [];
  const nboName = offer.nombre_oferta || clientData.nboSelected || "";

  if (!nboName && !offer.oferta_id) return null;

  const gb = offer.gb_incluidos;
  const gbLabel =
    gb != null && Number(gb) < 9999 ? `${gb} GB` : "Datos ilimitados";
  const ahorro = Number(offer.ahorro_pct) > 0 ? `${offer.ahorro_pct}%` : null;
  const aceptacion = Number(offer.p_acceptance);
  const urgente = Boolean(clientData.churnAlert);
  const aceptacionPct =
    Number.isFinite(aceptacion) ? Math.round(aceptacion * 100) : null;

  return (
    <section
      className="overflow-hidden rounded-3xl border border-[#5BC500]/50 bg-white shadow-sm"
      aria-label="NBO recomendada, por qué y canal"
    >
      {/* Barra superior de prioridad */}
      <div
        className={`flex items-center gap-2 px-5 py-2 text-xs font-bold uppercase tracking-wider ${
          urgente
            ? "bg-[#DE3B2E]/10 text-[#DE3B2E]"
            : "bg-[#5BC500]/10 text-[#3f8b00]"
        }`}
      >
        {urgente ? (
          <>
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            Alerta de fuga · retener HOY con prioridad
          </>
        ) : (
          <>
            <BadgeCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
            Oportunidad de crecimiento · sin urgencia
          </>
        )}
      </div>

      <div className="space-y-4 p-5">
        {/* NBO: nombre + precio */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex rounded-full bg-[#5BC500] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white">
                NBO Recomendada
              </span>
              <OfferTypeBadge offer={offer} />
            </div>
            <h2 className="mt-2 text-xl font-extrabold leading-tight text-[#0f172a]">
              {nboName}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold leading-none text-[#0f172a]">
              {formatPrice(offer.precio_mensual)}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              mensual
            </p>
          </div>
        </div>

        {/* Chips de valor + barra de aceptación */}
        <div className="flex flex-wrap items-center gap-2">
          <Chip label={gbLabel} />
          {ahorro && (
            <Chip
              icon={BadgeCheck}
              label={`${ahorro} de ahorro`}
              tone="text-[#3f8b00]"
            />
          )}
          {aceptacionPct != null && (
            <Chip label={`${aceptacionPct}% aceptación`} tone="text-[#0176b5]" />
          )}
          {aceptacionPct != null && (
            <div className="ml-auto flex min-w-32 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-[#019DF4] transition-all duration-700"
                  style={{ width: `${aceptacionPct}%` }}
                />
              </div>
              <span className="shrink-0 text-[11px] font-bold text-[#0176b5]">
                {aceptacionPct}%
              </span>
            </div>
          )}
        </div>

        {/* Por qué esta NBO */}
        {clientData.justification && (
          <div className="rounded-2xl border border-[#5BC500]/30 bg-[#5BC500]/5 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#3f8b00]">
              Por qué esta NBO
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">
              {clientData.justification}
            </p>
          </div>
        )}

        {/* Canal + momento */}
        {(channel.channel || channel.timing) && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Canal
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#313235]">
                <MessagesSquare
                  className="h-4 w-4 shrink-0 text-[#019DF4]"
                  aria-hidden="true"
                />
                {channel.channel || channel.canal_actual || "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Momento ideal
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[#313235]">
                <Timer className="h-4 w-4 shrink-0 text-[#019DF4]" aria-hidden="true" />
                {channel.timing || "—"}
              </p>
            </div>
          </div>
        )}

        {channel.advice && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-slate-200 bg-white p-3.5">
            <Route
              className="mt-0.5 h-4 w-4 shrink-0 text-[#B8860B]"
              aria-hidden="true"
            />
            <p className="text-xs leading-relaxed text-slate-600">
              <span className="font-bold text-[#313235]">Consejo: </span>
              {channel.advice}
            </p>
          </div>
        )}

        {rebates.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {rebates.map((rebate, index) => (
              <div
                key={`${rebate.motivo || "rebate"}-${index}`}
                className="flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2"
              >
                <HandCoins
                  className="mt-0.5 h-4 w-4 shrink-0 text-[#B8860B]"
                  aria-hidden="true"
                />
                <p className="text-xs leading-relaxed text-slate-600">
                  <span className="font-bold capitalize text-[#313235]">
                    {rebate.motivo || "Oferta"}:
                  </span>{" "}
                  {rebate.estrategia}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Acciones rápidas del asesor */}
        <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            Decide sobre la marcha con el umbral de aceptación de{" "}
            <span className="font-semibold text-[#313235]">
              {clientData.decisionThreshold != null
                ? `${Math.round(clientData.decisionThreshold * 100)}%`
                : "—"}
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onReject}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#019DF4]"
            >
              No aceptó
            </button>
            <button
              type="button"
              onClick={onAccept}
              className="rounded-xl bg-[#5BC500] px-5 py-2.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-[#4da900] focus-visible:outline-2 focus-visible:outline-[#019DF4]"
            >
              Aceptó oferta
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NboCommandCenter;
