import { create } from 'zustand'
import mockCustomers from '../mock/customers.json'
import { getRecommendation, postOutcome } from '../services/api.js'

const DEMO_PHONE = '999999999'

const demoClient = {
  name: 'Juan Pérez',
  phone: DEMO_PHONE,
  currentPlan: 'Plan 15GB (S/ 39.90)',
  arpu: 39.9,
  churnScore: 78,
  churnRisk: 'Alto (78%)',
  nextBestOffer: 'Upgrade a 30GB + Netflix por S/ 49.90',
  fidelity: '2 años',
}

const buildClientDataFromRecommendation = (recommendation, phone) => {
  const profile = recommendation.customer_profile || {}
  const scores = recommendation.ml_scores || {}
  const offer = recommendation.offer_selected || {}
  const churnRiskValue = Number(scores.churn_risk || 0)
  const clienteId = recommendation.cliente_id || profile.cliente_id || ''

  return {
    // Identidad y trazabilidad
    dni: clienteId,
    gestion_id: recommendation.gestion_id || '',
    name: profile.nombre || profile.name || clienteId || `Cliente ${phone}`,
    phone,

    // Perfil completo del backend (customer_profile)
    profile,

    // Scores ML
    scores,
    churnScore: Math.round(churnRiskValue * 100),
    churnRisk: `${Math.round(churnRiskValue * 100)}%`,
    churnLabel: recommendation.churn_label || '',
    churnAlert: Boolean(recommendation.churn_alert),
    mtPropensity: Number(scores.mt_propensity || 0),
    pitchType: recommendation.pitch_type || '',

    // Oferta seleccionada (NBO)
    offer,
    offerPrice: offer.precio_mensual,
    offerGb: offer.gb_incluidos,
    offerPct: offer.p_acceptance,
    offers: recommendation.offers_retrieved || [],
    nextBestOffer: offer.nombre_oferta || recommendation.nbo_selected || 'Oferta recomendada',
    nboSelected: recommendation.nbo_selected || '',
    justification: recommendation.justification || '',

    // Guion de venta
    salesPitch: recommendation.sales_pitch || '',

    // Canal, momento y rebates
    channel: recommendation.channel_recommendation || {},
    rebates: recommendation.rebate_prepared || [],

    // Decisión del pipeline
    decisionThreshold: recommendation.decision_threshold ?? null,
    aceptaPredicho: recommendation.acepta_predicho ?? null,

    // Diagnóstico
    nodeTimings: recommendation.node_timings || {},

    // Compatibilidad con vistas anteriores / simulación local
    currentPlan: profile.plan_actual_desc || profile.plan_actual_id || profile.plan_actual || 'Plan actual',
    arpu: Number(profile.monto_facturado_prom || profile.arpu || 0),
    fidelity: profile.antiguedad_categoria_simple || profile.fidelity || 'Sin dato',

    // Payload crudo por si el UI necesita algún campo no mapeado
    raw: recommendation,
  }
}

export const offerCatalog = [
  { id: 'principal', name: 'Upgrade 30GB + Netflix', price: 'S/ 49.90', margin: 'Margen alto', description: 'La mejor combinación de valor para el cliente y rentabilidad para Movistar.', recommended: true },
  { id: 'fidelizacion', name: 'Plan 25GB Fidelización', price: 'S/ 44.90', margin: 'Margen medio', description: 'Alternativa equilibrada para retener al cliente con menor impacto económico.' },
  { id: 'retencion', name: 'Bono 10GB por 3 meses', price: 'S/ 39.90', margin: 'Margen controlado', description: 'Opción de entrada para reducir fricción y mantener la línea activa.' },
]

const SALES_EVENTS_KEY = 'movistar-sales-events'
const CUSTOMER_CACHE_KEY = 'movistar-customer-cache'

const toClientData = (customer) => ({
  name: customer.name,
  phone: customer.phone,
  currentPlan: customer.current_plan,
  arpu: Number(customer.arpu),
  churnRisk: customer.churn_risk,
  nextBestOffer: customer.next_best_offer || offerCatalog[0].name,
  fidelity: customer.fidelity,
})

const initialSalesByAdvisor = {
  'advisor-vero': { id: 'advisor-vero', name: 'Vero', accepted: 12, rejected: 4 },
  'advisor-anthony': { id: 'advisor-anthony', name: 'Anthony', accepted: 10, rejected: 6 },
  'advisor-gabriela': { id: 'advisor-gabriela', name: 'Gabriela', accepted: 8, rejected: 5 },
}

const initialTotalAccepted = Object.values(initialSalesByAdvisor).reduce((s, a) => s + (a.accepted || 0), 0)

const PERSIST_KEY = 'dashboard-sales'

const loadPersistedSales = () => {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

const persisted = loadPersistedSales() || {}

const useDashboardStore = create((set, get) => ({
  searchQuery: '',
  isLoading: false,
  clientData: null,
  error: null,
  errorType: null,
  isSimulatorModalOpen: false,
  showInlineForm: false,
  isOfferTabOpen: false,
  selectedOfferId: 'principal',
  offerOutcome: null,

  // Sales metrics (persisted)
  salesMetrics: (persisted.salesMetrics) ? persisted.salesMetrics : { totalAccepted: initialTotalAccepted, dailyTarget: 15 },
  salesByAdvisor: (persisted.salesByAdvisor) ? persisted.salesByAdvisor : initialSalesByAdvisor,
  toast: { message: null, visible: false },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  openSimulator: () => set({ isSimulatorModalOpen: true }),
  closeSimulator: () => set({ isSimulatorModalOpen: false }),
  openInlineForm: () => set({ showInlineForm: true }),
  closeInlineForm: () => set({ showInlineForm: false }),
  openOfferTab: () => set({ isOfferTabOpen: true, selectedOfferId: 'principal', offerOutcome: null }),
  closeOfferTab: () => set({ isOfferTabOpen: false, offerOutcome: null }),
  selectOffer: (selectedOfferId) => set({ selectedOfferId }),
  clearResults: () => set({ clientData: null, searchQuery: '', error: null, errorType: null, isLoading: false, showInlineForm: false, isOfferTabOpen: false, offerOutcome: null, selectedOfferId: 'principal' }),

  registrarVenta: (advisorRef) => {
    const advisorId = typeof advisorRef === 'string' ? advisorRef : (advisorRef?.id || advisorRef?.advisorId || 'unknown')
    const advisorName = typeof advisorRef === 'string' ? advisorRef : (advisorRef?.name || advisorRef?.advisorName || advisorId)
    set((state) => {
      const salesByAdvisor = { ...state.salesByAdvisor }
      const current = salesByAdvisor[advisorId] || { id: advisorId, name: advisorName, accepted: 0, rejected: 0 }
      current.accepted = (current.accepted || 0) + 1
      salesByAdvisor[advisorId] = current
      const salesMetrics = { ...state.salesMetrics, totalAccepted: (state.salesMetrics?.totalAccepted || 0) + 1 }
      // persist event to local storage for historical charts
      const event = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        advisorId,
        advisorName: current.name,
        outcome: 'accepted',
        offerId: state.selectedOfferId,
        offerName: offerCatalog.find((o) => o.id === state.selectedOfferId)?.name || offerCatalog[0].name,
        amount: offerCatalog.find((o) => o.id === state.selectedOfferId)?.price || offerCatalog[0].price,
        clientName: state.clientData?.name || 'Cliente',
        createdAt: new Date().toISOString(),
      }
      const currentEvents = JSON.parse(localStorage.getItem(SALES_EVENTS_KEY) || '[]')
      localStorage.setItem(SALES_EVENTS_KEY, JSON.stringify([...currentEvents, event]))
      window.dispatchEvent(new CustomEvent('sales-event-created', { detail: event }))

      // persist sales metrics separately
      try { localStorage.setItem(PERSIST_KEY, JSON.stringify({ salesMetrics, salesByAdvisor })) } catch (e) { /* ignore */ }

      // show temporary toast
      setTimeout(() => set({ toast: { message: null, visible: false } }), 3000)
      return { salesByAdvisor, salesMetrics, toast: { message: 'Venta registrada', visible: true } }
    })
  },

  // Initialize local customer cache from mock data if none exists
  _initCache: (() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CUSTOMER_CACHE_KEY) || '{}')
      if (Object.keys(cached).length === 0 && Array.isArray(mockCustomers) && mockCustomers.length > 0) {
        const seed = {}
        mockCustomers.forEach((c) => {
          const churnPct = Math.min(100, Math.max(0, Math.round((1 - (Number(c.feature_a) || 0)) * 100)))
          const label = churnPct <= 30 ? 'Bajo' : churnPct <= 60 ? 'Medio' : 'Alto'
          seed[c.phone] = {
            name: c.name,
            phone: c.phone,
            currentPlan: c.currentPlan || 'Plan Demo 15GB',
            arpu: c.arpu || 39.9,
            churnScore: churnPct,
            churnRisk: `${label} (${churnPct}%)`,
            nextBestOffer: c.nextBestOffer || offerCatalog[0].name,
            fidelity: c.fidelity || '1 año',
          }
        })
        localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(seed))
      }
    } catch (e) {
      // ignore
    }
  })(),

  searchClient: async (identifier) => {
    const normalizedPhone = identifier.trim().toUpperCase()
    set({ searchQuery: normalizedPhone, isLoading: true, clientData: null, error: null, errorType: null })
    const cachedCustomers = JSON.parse(localStorage.getItem(CUSTOMER_CACHE_KEY) || '{}')
    if (cachedCustomers[normalizedPhone]) {
      const existingClient = cachedCustomers[normalizedPhone]
      set({ isLoading: false, clientData: existingClient, error: null, errorType: null })
      return existingClient
    }

    if (normalizedPhone === DEMO_PHONE) {
      set({ isLoading: false, clientData: demoClient, error: null, errorType: null })
      return demoClient
    }

    try {
      const recommendation = await getRecommendation(normalizedPhone)
      if (recommendation) {
        const client = buildClientDataFromRecommendation(recommendation, normalizedPhone)
        set({ isLoading: false, clientData: client, error: null, errorType: null })
        return client
      }
    } catch (error) {
      console.error('Error fetching recommendation:', error)
      const status = error?.status
      let errorType = 'unknown'
      let message = error?.message || 'No se pudo obtener la recomendación.'

      if (!status) {
        errorType = 'network'
        message = 'No se pudo conectar con el servidor. Verifica que el backend esté corriendo en http://localhost:8000.'
      } else if (status === 404) {
        errorType = 'not_found'
      } else if (status === 422) {
        errorType = 'validation'
      } else if (status >= 500) {
        errorType = 'server'
      }

      set({ isLoading: false, clientData: null, error: message, errorType })
      return null
    }

    set({ isLoading: false, clientData: null, error: 'Cliente no encontrado en la base de datos.', errorType: 'not_found' })
    return null
  },

  simulateManualOffer: async (formData) => {
    set({ isLoading: true, error: null })
    await new Promise((resolve) => setTimeout(resolve, 1400))

    // Support both new inline form keys and legacy modal keys
    const antiguedadValue = formData.antiguedad || (formData.lineAge ? (formData.lineAge === '0-6 meses' ? '0 a 6 meses' : formData.lineAge === '6-12 meses' ? '6 a 12 meses' : formData.lineAge === '1-3 años' ? '12 a 18 meses' : formData.lineAge === '+3 años' ? 'Más de 24 meses' : formData.lineAge) : '0 a 6 meses')

    let score = 20
    switch (antiguedadValue) {
      case '0 a 6 meses': score += 25; break
      case '6 a 12 meses': score += 15; break
      case '12 a 18 meses': score += 8; break
      case '18 a 24 meses': score += 4; break
      case 'Más de 24 meses': score -= 5; break
      default: break
    }

    const costo = Number(formData.costo_plan || formData.monthlyTicket) || 39.9
    if (costo < 30) score += 10
    else if (costo > 50) score -= 5

    const reclamosVal = formData.reclamos || (formData.hasComplaints ? 'Sí (1)' : 'No (0)')
    if ((reclamosVal || '').includes('Sí')) score += 20

    const tipoLineaVal = formData.tipo_linea || 'Postpago'
    if ((tipoLineaVal || '') === 'Prepago') score += 10
    else if ((tipoLineaVal || '') === 'Postpago') score -= 5

    const jitter = Math.round((Math.random() - 0.5) * 10)
    const churnPct = Math.min(100, Math.max(0, score + jitter))
    const label = churnPct <= 30 ? 'Bajo' : churnPct <= 60 ? 'Medio' : 'Alto'

    const simulatedClient = {
      name: 'Cliente nuevo',
      phone: get().searchQuery,
      currentPlan: `${tipoLineaVal} (S/ ${costo.toFixed(2)})`,
      arpu: costo,
      churnScore: churnPct,
      churnRisk: `${label} (${churnPct}%)`,
      nextBestOffer: costo > 50 ? offerCatalog[2].name : offerCatalog[0].name,
      fidelity: antiguedadValue,
    }

    const cachedCustomers = JSON.parse(localStorage.getItem(CUSTOMER_CACHE_KEY) || '{}')
    cachedCustomers[simulatedClient.phone] = simulatedClient
    localStorage.setItem(CUSTOMER_CACHE_KEY, JSON.stringify(cachedCustomers))

    set({ isLoading: false, clientData: simulatedClient, error: null, isSimulatorModalOpen: false, showInlineForm: false })
    return simulatedClient
  },

  registerOfferOutcome: async (outcome, advisor) => {
    const { clientData, selectedOfferId } = get()
    const offer = offerCatalog.find((item) => item.id === selectedOfferId) || offerCatalog[0]
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      advisorId: advisor.id,
      advisorName: advisor.name,
      outcome,
      offerId: offer.id,
      offerName: offer.name,
      amount: offer.price,
      clientName: clientData?.name || 'Cliente',
      createdAt: new Date().toISOString(),
    }
    // In Mock Mode we only persist events locally

    const currentEvents = JSON.parse(localStorage.getItem(SALES_EVENTS_KEY) || '[]')
    localStorage.setItem(SALES_EVENTS_KEY, JSON.stringify([...currentEvents, event]))
    window.dispatchEvent(new CustomEvent('sales-event-created', { detail: event }))

    if (outcome === 'accepted' && clientData?.dni && clientData?.gestion_id) {
      try {
        await postOutcome({ dni: clientData.dni, outcome, gestion_id: clientData.gestion_id })
      } catch (error) {
        console.error('Error registrando outcome en backend:', error)
      }
    }

    // Update counters when accepted/rejected
    if (outcome === 'accepted') {
      get().registrarVenta({ id: advisor.id, name: advisor.name })
    } else {
      // increment rejected counter
      set((state) => {
        const salesByAdvisor = { ...state.salesByAdvisor }
        const current = salesByAdvisor[advisor.id] || { id: advisor.id, name: advisor.name, accepted: 0, rejected: 0 }
        current.rejected = (current.rejected || 0) + 1
        salesByAdvisor[advisor.id] = current
        return { salesByAdvisor }
      })
    }

    set({ offerOutcome: outcome, isOfferTabOpen: false })
    return event
  },
}))

export default useDashboardStore
