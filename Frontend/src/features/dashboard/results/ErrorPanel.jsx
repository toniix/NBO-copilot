import {
  AlertTriangle,
  RotateCcw,
  SearchX,
  ServerCrash,
  ShieldAlert,
  WifiOff,
} from "lucide-react";

const ERROR_META = {
  not_found: {
    icon: SearchX,
    title: "Cliente no encontrado",
    tile: "bg-amber-100 text-[#B8860B]",
    border: "border-amber-200 bg-amber-50/60",
    ring: "ring-amber-100",
  },
  network: {
    icon: WifiOff,
    title: "Sin conexión con el servidor",
    tile: "bg-red-100 text-[#DE3B2E]",
    border: "border-red-200 bg-red-50/60",
    ring: "ring-red-100",
  },
  server: {
    icon: ServerCrash,
    title: "Error del servidor",
    tile: "bg-red-100 text-[#DE3B2E]",
    border: "border-red-200 bg-red-50/60",
    ring: "ring-red-100",
  },
  validation: {
    icon: ShieldAlert,
    title: "Consulta no válida",
    tile: "bg-amber-100 text-[#B8860B]",
    border: "border-amber-200 bg-amber-50/60",
    ring: "ring-amber-100",
  },
  unknown: {
    icon: AlertTriangle,
    title: "No se pudo completar la consulta",
    tile: "bg-slate-100 text-slate-500",
    border: "border-slate-200 bg-slate-50/60",
    ring: "ring-slate-100",
  },
};

const FORMAT_HINTS = [
  "Código de cliente: CLI000013",
  "Celular de 9 dígitos: 999999999",
  "DNI de 8 dígitos: 12345678",
];

const ErrorPanel = ({ error, errorType = "unknown", onClear }) => {
  const meta = ERROR_META[errorType] || ERROR_META.unknown;
  const Icon = meta.icon;

  return (
    <div
      role="alert"
      className={`mx-auto max-w-3xl rounded-3xl border ${meta.border} bg-white p-6 shadow-sm`}
    >
      <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-4 ${meta.tile} ${meta.ring}`}
        >
          <Icon className="h-7 w-7" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-extrabold text-[#313235]">
            {meta.title}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {error}
          </p>
        </div>
      </div>

      {(errorType === "not_found" || errorType === "validation") && (
        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Formatos válidos para buscar
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {FORMAT_HINTS.map((hint) => (
              <li
                key={hint}
                className="flex items-center gap-2 text-xs font-semibold text-slate-600"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#019DF4]" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {errorType === "network" && (
        <p className="mt-4 rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          Revisa que el backend esté activo en{" "}
          <code className="font-mono text-[#019DF4]">http://localhost:8000</code>{" "}
          y vuelve a intentarlo.
        </p>
      )}

      {onClear && (
        <div className="mt-5 flex justify-center sm:justify-end">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#019DF4] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#008bd8] focus:outline-none focus:ring-2 focus:ring-[#019DF4]/25"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Nueva búsqueda
          </button>
        </div>
      )}
    </div>
  );
};

export default ErrorPanel;
