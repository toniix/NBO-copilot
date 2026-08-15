import { useEffect, useState } from 'react'
import { BrainCircuit, CheckCircle2, Cpu, LineChart, Search, Sparkles } from 'lucide-react'

const LOADING_STEPS = [
  { icon: Search, title: 'Consultando base de datos Movistar...', subtitle: 'Obteniendo plan actual, facturación y perfil de cliente' },
  { icon: LineChart, title: 'Evaluando riesgo de fuga (Churn)...', subtitle: 'Calculando probabilidad de cancelación y propensión a retención' },
  { icon: Cpu, title: 'Ejecutando modelo Machine Learning (NBO)...', subtitle: 'Procesando árboles de decisión y puntuación en tiempo real' },
  { icon: BrainCircuit, title: 'Generando Next Best Offer & Guion...', subtitle: 'Seleccionando la oferta óptima y adaptando guion de venta' },
]

const InteractiveLoading = () => {
  const [currentStep, setCurrentStep] = useState(0)
  const [progress, setProgress] = useState(15)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev < LOADING_STEPS.length - 1) {
          const next = prev + 1
          setProgress(Math.min(95, Math.round(((next + 1) / LOADING_STEPS.length) * 100)))
          return next
        }
        return prev
      })
    }, 400)

    return () => clearInterval(interval)
  }, [])

  const CurrentIcon = LOADING_STEPS[currentStep].icon

  return (
    <div className="mx-auto my-6 max-w-2xl rounded-3xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-slate-200/50 transition-all">
      {/* Top AI Indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-[#019DF4] to-[#5BC500] text-white shadow-md shadow-[#019DF4]/20">
            <Sparkles className="h-5 w-5 animate-pulse" aria-hidden="true" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5BC500] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#5BC500]" />
            </span>
          </div>
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#019DF4]">
              IA Motor NBO Copilot
            </p>
            <h3 className="text-base font-bold text-[#313235]">Analizando cliente en tiempo real</h3>
          </div>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-bold text-[#019DF4]">
          {progress}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#019DF4] via-[#019DF4] to-[#5BC500] transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Current Step Spotlight */}
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-3">
        <div className="rounded-xl bg-white p-2 text-[#019DF4] shadow-xs">
          <CurrentIcon className="h-5 w-5 animate-bounce" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-[#313235]">{LOADING_STEPS[currentStep].title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{LOADING_STEPS[currentStep].subtitle}</p>
        </div>
      </div>

      {/* Steps List */}
      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
        {LOADING_STEPS.map((step, idx) => {
          const isDone = idx < currentStep
          const isCurrent = idx === currentStep
          const StepIcon = step.icon

          return (
            <div
              key={step.title}
              className={`flex items-center gap-3 transition-opacity duration-200 ${
                isCurrent ? 'opacity-100' : isDone ? 'opacity-70' : 'opacity-40'
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#5BC500]" aria-hidden="true" />
              ) : (
                <StepIcon
                  className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-[#019DF4]' : 'text-slate-400'}`}
                  aria-hidden="true"
                />
              )}
              <span className={`text-xs ${isCurrent ? 'font-bold text-[#313235]' : 'text-slate-600'}`}>
                {step.title}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default InteractiveLoading
