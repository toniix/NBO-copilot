import ClientHeader from './results/ClientHeader'
import ScoresPanel from './results/ScoresPanel'
import OfferPanel from './results/OfferPanel'
import SalesPitchPanel from './results/SalesPitchPanel'
import ChannelPanel from './results/ChannelPanel'
import ProfilePanel from './results/ProfilePanel'
import DiagnosticsPanel from './results/DiagnosticsPanel'

const SkeletonLine = ({ className = '' }) => (
  <div className={`animate-pulse rounded-md bg-slate-200 ${className}`} />
)

const SkeletonCard = () => (
  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
    <div className="mb-6 flex items-center gap-3">
      <SkeletonLine className="h-10 w-10 rounded-xl" />
      <SkeletonLine className="h-5 w-36" />
    </div>
    <SkeletonLine className="mb-3 h-4 w-3/4" />
    <SkeletonLine className="mb-3 h-4 w-1/2" />
    <SkeletonLine className="h-4 w-2/3" />
  </section>
)

const ResultsBoard = ({ isLoading, clientData, error, onOffer }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3" aria-label="Procesando análisis">
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
      <div role="alert" className="mx-auto max-w-3xl rounded-xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!clientData) return null

  return (
    <div className="space-y-5">
      <ClientHeader clientData={clientData} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OfferPanel clientData={clientData} onOffer={onOffer} />
        </div>
        <ScoresPanel clientData={clientData} />
      </div>

      <SalesPitchPanel clientData={clientData} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChannelPanel clientData={clientData} />
        </div>
        <ProfilePanel clientData={clientData} />
      </div>

      <DiagnosticsPanel clientData={clientData} />
    </div>
  )
}

export default ResultsBoard