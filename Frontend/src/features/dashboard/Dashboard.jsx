import DashboardLayout from '../../components/layout/DashboardLayout'
import SupervisorDashboard from '../supervisor/SupervisorDashboard'
import ResultsBoard from './ResultsBoard'
import SearchBar from './SearchBar'
import ManualSimulatorModal from './ManualSimulatorModal'
import InlinePredictForm from './InlinePredictForm'
import OfferDetailsTab from './OfferDetailsTab'
import useDashboardStore from '../../store/useDashboardStore.js'
import { useAuthStore } from '../../store/useAuthStore'

const Dashboard = () => {
  const { searchQuery, isLoading, clientData, error, isSimulatorModalOpen, showInlineForm, isOfferTabOpen, selectedOfferId, offerOutcome, setSearchQuery, searchClient, closeSimulator, simulateManualOffer, openOfferTab, closeOfferTab, selectOffer, clearResults, registrarVenta, registerOfferOutcome } = useDashboardStore()
  const { user } = useAuthStore()
  const { salesMetrics, salesByAdvisor } = useDashboardStore()
  const myAdvisorKey = user?.id || `advisor-${(user?.name || '').toLowerCase()}`
  const mySales = (salesByAdvisor && salesByAdvisor[myAdvisorKey] && salesByAdvisor[myAdvisorKey].accepted) || 0
  const handleAccept = (selectedOffer) => {
    if (user) registrarVenta(user)
    clearResults()
  }
  const handleReject = () => {
    clearResults()
  }

  if (user?.role === 'supervisor') {
    return <SupervisorDashboard />
  }

  return (
    <DashboardLayout>
      {isOfferTabOpen && clientData && <OfferDetailsTab clientData={clientData} selectedOfferId={selectedOfferId} outcome={offerOutcome} onSelectOffer={selectOffer} onOutcome={(outcome) => registerOfferOutcome(outcome, user)} onClose={closeOfferTab} />}
      <div className="space-y-10">
        <section className="text-left">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#313235]">Hola, {user?.name || 'Asesor'} — Resumen de tu turno</h3>
              <p className="text-sm text-slate-500">Bienvenido al panel. Aquí tienes un resumen rápido de tus métricas.</p>
            </div>
            <div className="mt-3 flex gap-3 sm:mt-0">
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Ventas de hoy</p>
                <p className="mt-1 text-2xl font-bold text-[#313235]">{mySales}</p>
              </div>
              <div className="rounded-lg bg-white p-4 shadow-sm">
                <p className="text-xs text-slate-500">Meta diaria</p>
                <p className="mt-1 text-2xl font-bold text-[#313235]">{salesMetrics?.dailyTarget || 15}</p>
              </div>
            </div>
          </div>
        </section>
        <section className="text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--color-primary)' }}>Consulta inteligente</p>
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#313235] sm:text-4xl">Conoce mejor a tu cliente</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
            Analiza su perfil, identifica el riesgo de fuga y encuentra la oferta más relevante.
          </p>
          <div className="mt-8">
            <SearchBar searchQuery={searchQuery} isLoading={isLoading} onChange={setSearchQuery} onSearch={searchClient} />
          </div>
        </section>

        <ResultsBoard isLoading={isLoading} clientData={clientData} error={error} onAccept={handleAccept} onReject={handleReject} salesToday={mySales} dailyTarget={salesMetrics?.dailyTarget || 15} />
      </div>
      {isSimulatorModalOpen && <ManualSimulatorModal isLoading={isLoading} onClose={closeSimulator} onSubmit={simulateManualOffer} />}
      {showInlineForm && <InlinePredictForm />}
    </DashboardLayout>
  )
}

export default Dashboard
