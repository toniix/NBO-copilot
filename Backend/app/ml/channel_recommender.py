"""
channel_recommender.py
----------------------
Replica FASE 5 (CANAL ÓPTIMO) del equipo de Estadística: recomienda el canal
más efectivo para un cliente según su segmento, usando la tabla de reglas
derivada del training set. El canal resultante se usa como input del modelo
de aceptación (feature 'canal').

Reglas (extraídas del notebook FASE 5):
  - Segmento = "{tipo_cliente} | mora_{nivel} | elegible_mt_{bool}"
  - mora_nivel desde riesgo_mora_score (terciles del training set):
      bajo  <= 33.33
      medio <= 42.33
      alto   > 42.33
  - Solo un segmento tiene canal recomendado con evidencia estadística
    (postpago | mora_bajo | elegible_mt_False -> Digital); el resto cae a
    "canal_habitual_del_cliente" (el canal_mas_usado del cliente).
"""

from __future__ import annotations

from app.ml.production_contract import get_riesgo_mora_cortes

# --- Reglas de FASE 5 (constantes_produccion.json de FASE 8) ---
# Fuente única de verdad: si Estadística actualiza los terciles, el backend
# los toma de constantes_produccion.json sin tocar este código.
_RIESGO_MORA_CORTES = get_riesgo_mora_cortes()
MORA_TERCIL_MEDIO = _RIESGO_MORA_CORTES["corte_33"]  # riesgo_mora_score <= 33.33 -> mora_bajo
MORA_TERCIL_ALTO = _RIESGO_MORA_CORTES["corte_66"]   # 33.33 < riesgo_mora_score <= 42.5 -> mora_medio

# Mapeo de etiqueta churn (segmentación KMeans FASE 8) a score 0-1.
# El contrato del sistema espera churn_risk float con umbral 0.60 (CHURN_HIGH_THRESHOLD).
CHURN_LABEL_TO_RISK: dict[str, float] = {
    "riesgo_bajo": 0.2,
    "riesgo_medio_bajo": 0.4,
    "riesgo_medio_alto": 0.7,
    "riesgo_alto": 0.9,
}

# Segmentos con canal recomendado por evidencia estadística.
# Solo este segmento obtuvo una recomendación significativa (chi-cuadrado).
CANAL_RECOMENDADO_EVIDENCIA: dict[str, str] = {
    "postpago | mora_bajo | elegible_mt_False": "Digital",
}

CANAL_HABITUAL_FALLBACK = "canal_habitual_del_cliente"


def _mora_nivel(riesgo_mora_score: float) -> str:
    if riesgo_mora_score <= MORA_TERCIL_MEDIO:
        return "bajo"
    if riesgo_mora_score <= MORA_TERCIL_ALTO:
        return "medio"
    return "alto"


def _canal_habitual(profile: dict) -> str:
    """Canal más usado del cliente (imputado 'sin_interaccion' si no registra)."""
    return str(profile.get("canal_mas_usado", "") or "Digital")


def recomendar_canal(profile: dict) -> dict:
    """
    Devuelve el canal recomendado para el cliente según FASE 5.

    Returns:
        {
            "canal_recomendado": str,
            "confianza": "alta" | "media" | "baja",
            "justificacion": str,
            "canal_actual": str,
        }
    """
    tipo_cliente = str(profile.get("tipo_cliente", "") or "")
    elegible_mt = bool(profile.get("elegible_mt", False))
    riesgo_mora_score = float(profile.get("riesgo_mora_score", 0) or 0)

    nivel = _mora_nivel(riesgo_mora_score)
    segmento = f"{tipo_cliente} | mora_{nivel} | elegible_mt_{elegible_mt}"

    canal_actual = _canal_habitual(profile)

    recomendado = CANAL_RECOMENDADO_EVIDENCIA.get(segmento)
    if recomendado:
        return {
            "canal_recomendado": recomendado,
            "confianza": "alta",
            "justificacion": (
                "Tasa de aceptación histórica superior respaldada por "
                "evidencia estadística para este segmento."
            ),
            "canal_actual": canal_actual,
        }

    base = {
        "canal_recomendado": canal_actual,
        "confianza": "media",
        "justificacion": (
            "Sin diferencia significativa entre canales para este segmento — "
            "se usa el canal habitual del cliente para minimizar fricción."
        ),
        "canal_actual": canal_actual,
    }
    if not tipo_cliente or tipo_cliente == "desconocido" or not canal_actual:
        base["confianza"] = "baja"
        base["justificacion"] = (
            "Segmento sin datos históricos suficientes — "
            "se usa el canal habitual del cliente."
        )
    return base