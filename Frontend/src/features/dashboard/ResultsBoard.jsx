import ClienteSnapshot from "./results/ClienteSnapshot";
import RiskStrip from "./results/RiskStrip";
import NboCommandCenter from "./results/NboCommandCenter";
import OffersCarousel from "./results/OffersCarousel";
import ConsumoDataChart from "./results/ConsumoDataChart";
import GuionPanel from "./results/GuionPanel";
import ErrorPanel from "./results/ErrorPanel";

const SkeletonLine = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
);

const SkeletonCard = () => (
  <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center gap-3">
      <SkeletonLine className="h-10 w-10 rounded-xl" />
      <SkeletonLine className="h-5 w-40" />
    </div>
    <SkeletonLine className="mb-3 h-4 w-3/4" />
    <SkeletonLine className="mb-3 h-4 w-1/2" />
    <SkeletonLine className="h-4 w-2/3" />
  </section>
);

const ResultsBoard = ({ isLoading, clientData, error, errorType, onClear, onAccept, onReject }) => {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 gap-5 md:grid-cols-3"
        aria-label="Procesando análisis"
        aria-busy="true"
      >
        <div className="md:col-span-3">
          <SkeletonCard />
        </div>
        {[0, 1, 2].map((card) => (
          <SkeletonCard key={card} />
        ))}
      </div>
    );
  }

  if (error) {
    return <ErrorPanel error={error} errorType={errorType} onClear={onClear} />;
  }

  if (!clientData) {
    return (
      <p className="mx-auto max-w-3xl text-center text-sm text-slate-500">
        Busca un cliente para ver su análisis y la propuesta comercial.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <ClienteSnapshot clientData={clientData} />

      {/* Señales clave en cards compactas: riesgo de fuga + propensión MT + veredicto */}
      <RiskStrip clientData={clientData} />

      {/* Command Center: NBO + por qué + canal y momento, todo en una vista */}
      <NboCommandCenter
        clientData={clientData}
        onAccept={onAccept}
        onReject={onReject}
      />

      {/* Pitch recomendado + Uso de datos: un solo bloque, dos cards, acceso rápido */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GuionPanel clientData={clientData} />
        <ConsumoDataChart clientData={clientData} />
      </div>

      {/* Resto de ofertas en lista horizontal */}
      <OffersCarousel clientData={clientData} />
    </div>
  );
};

export default ResultsBoard;
