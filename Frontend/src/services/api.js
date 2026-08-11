const BASE_URL = 'http://localhost:8000/api/v1'

// Asocia identificadores demo (teléfono o DNI) con su código de cliente.
// Los códigos CLI (ej. CLI000013) se resuelven directamente contra el backend.
const IDENTIFIER_TO_CLI = {
  '999999999': 'CLI000001',
  '12345678': 'CLI000001',
}

const isClientId = (value) => /^CLI\d{3,}$/i.test(value)

const normalizeMovistarTotal = (value) => String(value).toLowerCase() === 'true'

const normalizeOffer = (offer = {}) => ({
  ...offer,
  es_movistar_total: normalizeMovistarTotal(offer.es_movistar_total),
})

export const getRecommendation = async (identifier) => {
  const normalized = String(identifier || '').trim().toUpperCase()
  const dni = isClientId(normalized) ? normalized : IDENTIFIER_TO_CLI[normalized]
  if (!dni) {
    return null
  }

  const response = await fetch(`${BASE_URL}/recommendation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dni }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Error ${response.status} obteniendo recomendación`)
  }

  const payload = await response.json()
  return {
    ...payload,
    offer_selected: normalizeOffer(payload.offer_selected),
    offers_retrieved: (payload.offers_retrieved || []).map(normalizeOffer),
  }
}

export const postOutcome = async ({ dni, outcome, gestion_id }) => {
  const response = await fetch(`${BASE_URL}/outcome`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ dni, outcome, gestion_id }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Error ${response.status} registrando outcome`)
  }

  return response.json()
}
