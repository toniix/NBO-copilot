const BASE_URL = "http://localhost:8000/api/v1";

// Asocia identificadores demo (teléfono o DNI) con su código de cliente.
// Los códigos CLI (ej. CLI000013) se resuelven directamente contra el backend.
const IDENTIFIER_TO_CLI = {
  999999999: "CLI000001",
  12345678: "CLI000001",
};

const isClientId = (value) => /^CLI\d{3,}$/i.test(value);

const normalizeMovistarTotal = (value) =>
  String(value).toLowerCase() === "true";

const normalizeOffer = (offer = {}) => ({
  ...offer,
  es_movistar_total: normalizeMovistarTotal(offer.es_movistar_total),
});

export const getRecommendation = async (identifier) => {
  const normalized = String(identifier || "")
    .trim()
    .toUpperCase();
  const dni = isClientId(normalized)
    ? normalized
    : IDENTIFIER_TO_CLI[normalized];
  if (!dni) {
    return null;
  }

  const response = await fetch(`${BASE_URL}/recommendation`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dni }),
  });

  if (!response.ok) {
    let message = `Error ${response.status} obteniendo recomendación`
    try {
      const data = await response.json()
      if (data?.detail) message = data.detail
    } catch {
      const text = await response.text()
      if (text) message = text
    }
    const err = new Error(message)
    err.status = response.status
    throw err
  }

  const payload = await response.json();
  console.log("Payload:", payload);
  return {
    ...payload,
    offer_selected: normalizeOffer(payload.offer_selected),
    offers_retrieved: (payload.offers_retrieved || []).map(normalizeOffer),
  };
};

export const postOutcome = async ({ dni, outcome, gestion_id }) => {
  const response = await fetch(`${BASE_URL}/outcome`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ dni, outcome, gestion_id }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Error ${response.status} registrando outcome`);
  }

  return response.json();
};

export const getSupervisorMetrics = async () => {
  try {
    const response = await fetch(`${BASE_URL}/supervisor/metrics`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (!response.ok) {
      throw new Error(
        `Error ${response.status} al obtener métricas de supervisor`,
      );
    }
    return await response.json();
  } catch (error) {
    console.warn("Backend supervisor metrics endpoint error:", error);
    return null;
  }
};
