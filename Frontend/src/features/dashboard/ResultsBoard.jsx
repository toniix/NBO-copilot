import { useState } from "react";
import { CircleAlert, Copy, Gift, Phone, ShieldCheck, UserRound } from "lucide-react";

const SkeletonLine = ({ className = "" }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
);

const ResultCard = ({ title, icon, children, className = "" }) => (
  <section
    className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
  >
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        {icon}
      </div>
      <h2 className="text-base font-semibold text-[#313235]">{title}</h2>
    </div>
    {children}
  </section>
);

const ResultsBoard = ({ isLoading, clientData, error, onOffer }) => {
  const [selectedObjection, setSelectedObjection] = useState("");
  const [disposition, setDisposition] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  const diagnosticBullets = [
    "Saturación de datos en ciclos recientes",
    "Antigüedad > 12 meses sin renovación",
    "Índice de Retención: Crítico",
  ];

  const argumentText = `Presentar la propuesta de manera directa, destacando la estabilización del servicio y la mejora de condiciones. Reforzar la continuidad con bonos de fidelidad y migración escalonada para reducir el riesgo de baja.`;

  const objectionAdvice = {
    "Tarifa Elevada":
      "Recomendar un bono de fidelidad escalonado y recalcular el ahorro neto sobre el plan actual.",
    "Permanencia / Contrato":
      "Ofrecer un esquema de migración gradual con revisión contractual a 30 días para evitar cancelación inmediata.",
    "Satisfacción Actual":
      "Validar los puntos de satisfacción clave y proponer una mejora puntual sin cambiar la base tarifaria.",
  };

  const handleCopyArgument = async () => {
    try {
      await navigator.clipboard.writeText(argumentText);
      setCopyStatus("Texto copiado");
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (error) {
      setCopyStatus("No se pudo copiar");
      setTimeout(() => setCopyStatus(""), 2000);
    }
  };

  const handleObjectionClick = (key) => {
    setSelectedObjection(key);
  };

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
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
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
            <dd className="font-medium text-[#313235]">{clientData.currentPlan}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500">Antigüedad</dt>
            <dd className="font-medium text-[#313235]">{clientData.fidelity}</dd>
          </div>
        </dl>
      </ResultCard>

      <ResultCard
        title="Diagnóstico del Perfil"
        icon={<ShieldCheck className="h-5 w-5 text-slate-700" aria-hidden="true" />}
        className="border-slate-300"
      >
        <ul className="space-y-3 text-sm text-slate-700">
          {diagnosticBullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-2 w-2 rounded-full bg-slate-700" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </ResultCard>

      <ResultCard
        title="Argumentario Recomendado"
        icon={<Copy className="h-5 w-5 text-slate-700" aria-hidden="true" />}
        className="border-slate-300"
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-800">
          {argumentText}
        </div>
        <button
          type="button"
          onClick={handleCopyArgument}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          Copiar texto
        </button>
        {copyStatus && (
          <p className="mt-3 text-sm font-medium text-slate-600">{copyStatus}</p>
        )}
      </ResultCard>

      <ResultCard
        title="Acciones de Retención"
        icon={<Gift className="h-5 w-5 text-slate-700" aria-hidden="true" />}
        className="border-slate-300"
      >
        <div className="space-y-3">
          {Object.keys(objectionAdvice).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleObjectionClick(key)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${selectedObjection === key ? 'border-slate-700 bg-slate-100' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
            >
              {key}
            </button>
          ))}
        </div>
        {selectedObjection && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
            <p className="font-semibold text-slate-900">Ajuste técnico recomendado</p>
            <p className="mt-2">{objectionAdvice[selectedObjection]}</p>
          </div>
        )}
      </ResultCard>

      <ResultCard
        title="Registro de Resultado"
        icon={<CircleAlert className="h-5 w-5 text-slate-700" aria-hidden="true" />}
        className="xl:col-span-4"
      >
        <label className="block text-sm font-semibold text-slate-700">Disposition CRM</label>
        <select
          value={disposition}
          onChange={(event) => setDisposition(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          <option value="">Selecciona un resultado</option>
          <option value="Cierre Efectivo">Cierre Efectivo</option>
          <option value="Rechazado - Limitación Económica">Rechazado - Limitación Económica</option>
          <option value="Seguimiento Omnicanal (WhatsApp)">Seguimiento Omnicanal (WhatsApp)</option>
          <option value="Llamada Posterior">Llamada Posterior</option>
        </select>
        {disposition && (
          <p className="mt-3 text-sm text-slate-600">Resultado seleccionado: {disposition}</p>
        )}
      </ResultCard>
    </div>
  );
};

export default ResultsBoard;
