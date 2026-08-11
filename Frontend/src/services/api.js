const BASE_URL = 'http://localhost:8000/api/v1'

const PHONE_TO_DNI_MAP = {
  '999999999': 'CLI000001',
}

const normalizeMovistarTotal = (value) => String(value).toLowerCase() === 'true'

const normalizeOffer = (offer = {}) => ({
  ...offer,
  es_movistar_total: normalizeMovistarTotal(offer.es_movistar_total),
})

export const getRecommendation = async (phone) => {
  const dni = PHONE_TO_DNI_MAP[phone]
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
