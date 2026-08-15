import { CheckCircle2, CircleAlert, Sprout, Target } from "lucide-react";

const riskTone = (label, pct) => {
  if (label === "riesgo_alto")
    return { text: "Fuga alta", bar: "bg-[#DE3B2E]", tone: "text-[#DE3B2E]" };
  if (label === "riesgo_medio_alto")
    return { text: "Fuga medio-alta", bar: "bg-[#DE3B2E]", tone: "text-[#DE3B2E]" };
  if (label === "riesgo_medio_bajo")
    return { text: "Fuga medio-baja", bar: "bg-[#E09F1E]", tone: "text-[#B8860B]" };
  if (label === "riesgo_bajo")
    return { text: "Fuga baja", bar: "bg-[#2E9E5B]", tone: "text-[#2E9E5B]" };

  if (pct <= 25) return { text: "Fuga baja", bar: "bg-[#2E9E5B]", tone: "text-[#2E9E5B]" };
  if (pct <= 60) return { text: "Fuga media", bar: "bg-[#E09F1E]", tone: "text-[#B8860B]" };
  return { text: "Fuga alta", bar: "bg-[#DE3B2E]", tone: "text-[#DE3B2E]" };
};

const BarMeter = ({ value, barClass }) => (
  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
    <div
      className={`h-full rounded-full transition-all duration-700 ${barClass}`}
      style={{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }}
    />
  </div>
);

const MiniTile = ({ icon: Icon, label, value, meter, footer }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </span>
      <Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
    </div>
    <p className="mt-1 text-2xl font-extrabold leading-none text-[#313235]">
      {value}
    </p>
    {meter && <div className="mt-2">{meter}</div>}
    {footer && <div className="mt-2">{footer}</div>}
  </div>
);

const RiskStrip = ({ clientData }) => {
  const churnPct = clientData.churnScore;
  const mtPct = Math.round((clientData.mtPropensity || 0) * 100);
  const acepta = clientData.aceptaPredicho;
  const hasMl = typeof clientData.scores?.churn_risk === "number" || churnPct != null;

  if (!hasMl && !churnPct) return null;

  const risk = riskTone(clientData.churnLabel, churnPct);

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      aria-label="Señales clave del cliente"
    >
      <MiniTile
        icon={CircleAlert}
        label="Riesgo de fuga"
        value={`${Math.round(churnPct || 0)}%`}
        meter={<BarMeter value={churnPct} barClass={risk.bar} />}
        footer={
          <p className={`text-xs font-semibold ${risk.tone}`}>{risk.text}</p>
        }
      />

      <MiniTile
        icon={Sprout}
        label="Propensión Movistar Total"
        value={`${mtPct}%`}
        meter={<BarMeter value={mtPct} barClass="bg-[#5BC500]" />}
        footer={
          <p className="text-xs font-semibold text-[#2E9E5B]">
            {mtPct >= 60
              ? "Alta afinidad convergente"
              : mtPct >= 40
                ? "Afinidad media"
                : "Afinidad baja"}
          </p>
        }
      />

      <MiniTile
        icon={acepta === true ? CheckCircle2 : Target}
        label="Veredicto"
        value={
          acepta === true ? "Sí ofrecer" : acepta === false ? "Reforzar" : "—"
        }
        footer={
          <p className="text-xs font-semibold text-slate-500">
            {acepta === true
              ? "Cliente receptivo a la NBO"
              : acepta === false
                ? "Cerrar con argumento de refuerzo"
                : "Sin predicción del pipeline"}
          </p>
        }
      />
    </div>
  );
};

export default RiskStrip;
