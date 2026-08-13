import DashboardLayout from "../../components/layout/DashboardLayout";
import SupervisorDashboard from "../supervisor/SupervisorDashboard";
import ResultsBoard from "./ResultsBoard";
import SearchBar from "./SearchBar";
import InteractiveLoading from "./InteractiveLoading";
import ManualSimulatorModal from "./ManualSimulatorModal";
import InlinePredictForm from "./InlinePredictForm";
import OfferDetailsTab from "./OfferDetailsTab";
import useDashboardStore from "../../store/useDashboardStore.js";
import { useAuthStore } from "../../store/useAuthStore";

const Dashboard = () => {
  const {
    searchQuery,
    isLoading,
    clientData,
    error,
    isSimulatorModalOpen,
    showInlineForm,
    isOfferTabOpen,
    selectedOfferId,
    offerOutcome,
    setSearchQuery,
    searchClient,
    closeSimulator,
    simulateManualOffer,
    openOfferTab,
    closeOfferTab,
    selectOffer,
    clearResults,
    registerOfferOutcome,
  } = useDashboardStore();
  const { user } = useAuthStore();
  const { salesMetrics, salesByAdvisor } = useDashboardStore();
  const myAdvisorKey =
    user?.id || `advisor-${(user?.name || "").toLowerCase()}`;
  const mySales =
    (salesByAdvisor &&
      salesByAdvisor[myAdvisorKey] &&
      salesByAdvisor[myAdvisorKey].accepted) ||
    0;

  const handleAccept = () => {
    if (user) registerOfferOutcome("accepted", user);
    clearResults();
  };
  const handleReject = () => {
    if (user) registerOfferOutcome("rejected", user);
    clearResults();
  };

  if (user?.role === "supervisor") {
    return <SupervisorDashboard />;
  }

  return (
    <DashboardLayout>
      {isOfferTabOpen && clientData && (
        <OfferDetailsTab
          clientData={clientData}
          selectedOfferId={selectedOfferId}
          outcome={offerOutcome}
          onSelectOffer={selectOffer}
          onOutcome={(outcome) => registerOfferOutcome(outcome, user)}
          onClose={closeOfferTab}
        />
      )}

      <div className="space-y-4">
        {/* Top Search Section (Ultra-Compact when results exist) */}
        {clientData ? (
          <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/90 bg-white p-3 px-4 shadow-2xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex h-2.5 w-2.5 shrink-0 rounded-full bg-[#5BC500]" />
              <p className="text-xs font-bold uppercase tracking-wider text-[#019DF4] shrink-0">
                Cliente activo:
              </p>
              <p className="truncate text-sm font-extrabold text-[#313235]">
                {clientData.name}{" "}
                <span className="font-medium text-slate-400">
                  ({clientData.phone || clientData.dni || searchQuery})
                </span>
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <SearchBar
                compact
                searchQuery={searchQuery}
                isLoading={isLoading}
                onChange={setSearchQuery}
                onSearch={searchClient}
                onClear={clearResults}
                hasResults={true}
              />
            </div>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white via-white to-blue-50/20 p-5 sm:p-6 text-center shadow-2xs">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#019DF4]">
              Consulta Inteligente IA
            </p>
            <h2 className="mt-0.5 text-xl font-extrabold tracking-tight text-[#313235] sm:text-2xl">
              Identifica la oferta perfecta en segundos
            </h2>
            <div className="mt-4">
              <SearchBar
                searchQuery={searchQuery}
                isLoading={isLoading}
                onChange={setSearchQuery}
                onSearch={searchClient}
                onClear={clearResults}
                hasResults={false}
              />
            </div>
          </section>
        )}

        {/* Dynamic Interactive Loading State */}
        {isLoading && <InteractiveLoading />}

        {/* Results Board */}
        {!isLoading && (
          <ResultsBoard
            isLoading={false}
            clientData={clientData}
            error={error}
            onOffer={openOfferTab}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        )}
      </div>

      {isSimulatorModalOpen && (
        <ManualSimulatorModal
          isLoading={isLoading}
          onClose={closeSimulator}
          onSubmit={simulateManualOffer}
        />
      )}
      {showInlineForm && <InlinePredictForm />}
    </DashboardLayout>
  );
};

export default Dashboard;
