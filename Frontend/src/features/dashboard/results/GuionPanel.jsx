import { useState } from "react";
import { Check, Copy, MessageSquareText, Quote, Sparkles } from "lucide-react";

const PITCH_STRATEGIES = {
  fidelizacion: "Fidelización",
  upselling: "Upselling",
};

const GuionPanel = ({ clientData }) => {
  const [copied, setCopied] = useState(false);
  const pitch = clientData.salesPitch;
  const strategy =
    PITCH_STRATEGIES[clientData.pitchType] || clientData.pitchType || "";

  if (!pitch) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pitch);
    } catch {
      const area = document.createElement("textarea");
      area.value = pitch;
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="flex h-full flex-col gap-4 rounded-3xl border border-[#019DF4]/30 bg-gradient-to-b from-white via-white to-blue-50/20 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#019DF4]/10 text-[#019DF4]">
            <MessageSquareText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#019DF4]">
                Guion de Venta IA
              </span>
              <Sparkles
                className="h-3.5 w-3.5 text-[#5BC500]"
                aria-hidden="true"
              />
            </div>
            <h2 className="text-lg font-bold text-[#313235]">
              Pitch Recomendado
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {strategy && (
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#B8860B]">
              Estrategia: {strategy}
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-[#019DF4]"
          >
            {copied ? (
              <Check className="h-4 w-4 text-[#5BC500]" aria-hidden="true" />
            ) : (
              <Copy className="h-4 w-4" aria-hidden="true" />
            )}
            {copied ? "Copiado" : "Copiar guion"}
          </button>
        </div>
      </div>

      <div className="relative flex-1 rounded-2xl border border-blue-100 bg-white p-5 shadow-2xs">
        <Quote
          className="absolute right-4 top-4 h-8 w-8 text-blue-100/60"
          aria-hidden="true"
        />
        <p className="relative z-10 whitespace-pre-line text-sm sm:text-[15px] font-medium leading-relaxed text-[#1e293b]">
          {pitch}
        </p>
      </div>
    </section>
  );
};

export default GuionPanel;
