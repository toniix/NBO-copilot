import ClienteSnapshot from './results/ClienteSnapshot'
import SignalsRow from './results/SignalsRow'
import PropuestaComercial from './results/PropuestaComercial'
import GuionPanel from './results/GuionPanel'
import CanalPanel from './results/CanalPanel'
import DiagnosticoPanel from './results/DiagnosticoPanel'

const SkeletonLine = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
)

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
)

const ResultsBoard = ({ isLoading, clientData, error, onAccept, onReject }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3" aria-label="Procesando análisis" aria-busy="true">
        <div className="md:col-span-3">
          <SkeletonCard />
        </div>
        {[0, 1, 2].map((card) => (
          <SkeletonCard key={card} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!clientData) {
    return (
      <p className="mx-auto max-w-3xl text-center text-sm text-slate-500">
        Busca un cliente para ver su análisis y la propuesta comercial.
      </p>
    )
  }

  return (
    <div className="space-y-5">
      <ClienteSnapshot clientData={clientData} />

      <SignalsRow clientData={clientData} />

      {/* Primary Sales Command Center: Guion (Pitch) + Ofertas Sugeridas Side-by-Side */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <GuionPanel clientData={clientData} />
        <PropuestaComercial clientData={clientData} onAccept={onAccept} onReject={onReject} />
      </div>

      {/* Canal Panel (Cómo contactar y cerrar): Full Width */}
      <CanalPanel clientData={clientData} />

      {/* Diagnóstico Panel */}
      <DiagnosticoPanel clientData={clientData} />
    </div>
  )
}

export default ResultsBoard