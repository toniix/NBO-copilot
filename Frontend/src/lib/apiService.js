const getAiModelUrl = () => import.meta.env.VITE_AI_MODEL_URL
const REQUEST_TIMEOUT_MS = 10000

// Punto de integración con modelo predictivo de terceros desarrollado en FastAPI
export const fetchPredictiveModel = async (phone, clientData) => {
  const baseUrl = getAiModelUrl()

  if (!baseUrl) {
    throw new Error('VITE_AI_MODEL_URL no está configurada')
  }

  if (!/^\d{9}$/.test(String(phone))) {
    throw new Error('El teléfono debe contener exactamente 9 dígitos')
  }

  let modelUrl
  try {
    modelUrl = new URL(baseUrl)
  } catch {
    throw new Error('VITE_AI_MODEL_URL no contiene una URL válida')
  }

  const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(modelUrl.hostname)
  if (modelUrl.protocol !== 'https:' && !(import.meta.env.DEV && isLocalDevelopment)) {
    throw new Error('El modelo predictivo debe exponerse mediante HTTPS')
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(modelUrl, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, clientData }),
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`El modelo predictivo respondió con HTTP ${response.status}`)
    }

    return response.json()
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('El modelo predictivo tardó demasiado en responder')
    }
    throw error
  } finally {
    clearTimeout(timeoutId)
  }
}
