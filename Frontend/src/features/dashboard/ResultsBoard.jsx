import { useState } from "react";
import { CircleAlert, Gift, Phone, ShieldCheck, UserRound } from "lucide-react";

const SkeletonLine = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
);

const ResultCard = ({ title, icon, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
  >
    <div className="mb-6 flex items-center gap-3">
      <SkeletonLine className="h-10 w-10 rounded-xl" />
      <SkeletonLine className="h-5 w-36" />
    </div>
    <SkeletonLine className="mb-3 h-4 w-3/4" />
    <SkeletonLine className="mb-3 h-4 w-1/2" />
    <SkeletonLine className="h-4 w-2/3" />
  </section>
);

const ResultsBoard = ({ isLoading, clientData, error, onOffer }) => {
  const [offerMessage, setOfferMessage] = useState("");

  console.log("clientData", clientData);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-5 md:grid-cols-3"
        aria-label="Procesando análisis"
      >
        {[0, 1, 2].map((card) => (
          <section
            key={card}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
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
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-3xl rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm text-red-700"
      >
        {error}
      </div>
    );
  }

  if (!clientData) return null;

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      <ResultCard
        title="Perfil del Cliente"
        icon={<UserRound className="h-5 w-5" aria-hidden="true" />}
      >
        <dl className="space-y-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Nombre</dt>
            <dd className="font-medium text-[#313235]">{clientData.name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Celular</dt>
            <dd className="flex items-center gap-2 font-medium text-[#313235]">
              <Phone className="h-4 w-4 text-[#019DF4]" />
              {clientData.phone}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Segmento</dt>
            <dd className="font-medium text-[#313235]">
              {clientData.currentPlan}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Antigüedad</dt>
            <dd className="font-medium text-[#313235]">
              {clientData.fidelity}
            </dd>
          </div>
        </dl>
      </ResultCard>

      <ResultCard
        title="Next Best Offer"
        icon={<Gift className="h-5 w-5 text-[#5BC500]" aria-hidden="true" />}
        className="border-[#5BC500]/40"
      >
        <div className="rounded-xl bg-[#5BC500]/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#3f8b00]">
            Oferta recomendada
          </p>
          <p className="text-lg font-semibold text-[#313235]">
            {clientData.nextBestOffer}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Oferta personalizada según el perfil del cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={onOffer}
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-[#5BC500] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4da900] focus:outline-none focus:ring-4 focus:ring-[#5BC500]/20"
        >
          Ofrecer Plan
        </button>
        {offerMessage && (
          <p role="status" className="mt-3 text-sm font-medium text-[#3f8b00]">
            {offerMessage}
          </p>
        )}
      </ResultCard>

      <ResultCard
        title="Riesgo de Churn"
        icon={
          <CircleAlert className="h-5 w-5 text-[#FF6B35]" aria-hidden="true" />
        }
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-4">
            {/* Circular gauge */}
            {(() => {
              const score =
                typeof clientData.churnScore === "number"
                  ? clientData.churnScore
                  : Number((clientData.churnRisk.match(/\d+/) || [0])[0]);
              const pct = Math.round(score);
              const radius = 36;
              const stroke = 10;
              const normalizedRadius = radius - stroke / 2;
              const circumference = normalizedRadius * 2 * Math.PI;
              const offset = circumference - (pct / 100) * circumference;
              const color =
                pct <= 30 ? "#2ECC71" : pct <= 60 ? "#F6C244" : "#FF6B35";
              return (
                <div className="relative flex h-24 w-24 items-center justify-center">
                  <svg
                    height={radius * 2}
                    width={radius * 2}
                    className="transform -rotate-90"
                  >
                    <circle
                      stroke="#EDF2F7"
                      fill="transparent"
                      strokeWidth={stroke}
                      r={normalizedRadius}
                      cx={radius}
                      cy={radius}
                    />
                    <circle
                      stroke={color}
                      fill="transparent"
                      strokeWidth={stroke}
                      strokeLinecap="round"
                      r={normalizedRadius}
                      cx={radius}
                      cy={radius}
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={offset}
                      style={{ transition: "stroke-dashoffset 800ms ease" }}
                    />
                  </svg>
                  <div className="absolute text-center">
                    <div className="text-sm font-medium text-slate-500">
                      Riesgo
                    </div>
                    <div
                      className="text-xl font-bold"
                      style={{ color: "#313235" }}
                    >
                      {pct}%
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          <div>
            <p
              className={`font-semibold ${(clientData.churnScore || Number((clientData.churnRisk.match(/\d+/) || [0])[0])) <= 30 ? "text-green-600" : (clientData.churnScore || Number((clientData.churnRisk.match(/\d+/) || [0])[0])) <= 60 ? "text-amber-600" : "text-red-600"}`}
            >
              {clientData.churnRisk.split(" (")[0]}
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Conviene contactar al cliente esta semana.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center gap-2 text-xs font-medium text-slate-500">
          <ShieldCheck className="h-4 w-4 text-[#5BC500]" aria-hidden="true" />{" "}
          Análisis generado por IA
        </div>
      </ResultCard>
    </div>
  );
};

export default ResultsBoard;
