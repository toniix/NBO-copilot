"""
model_loader.py
---------------
Carga los modelos oficiales de FASE 8 una sola vez en memoria (singleton pattern).
Modelos cargados:
  - churn_segmentacion.pkl    -> KMeans no supervisado (FASE 8) que clasifica al cliente
                                 en {riesgo_bajo, riesgo_medio_bajo, riesgo_medio_alto,
                                 riesgo_alto}. La etiqueta se mapea a churn_risk (0-1).
  - modelo_propension.pkl     -> Pipeline OHE + XGBoost (FASE 8) que predice p_acceptance
                                 por oferta. Se usa tanto para score_offers_acceptance()
                                 como para derive_mt_propensity() (promedio sobre ofertas MT).
  - catalogo_rebate.json      -> Estrategias de rebate por motivo de rechazo (FASE 6).
"""

from __future__ import annotations

import json
import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.ml.channel_recommender import recomendar_canal, CHURN_LABEL_TO_RISK

# ---------------------------------------------------------------------------
# Singleton — los modelos se cargan una vez al arrancar la app
# ---------------------------------------------------------------------------
_churn_model: Any = None
_propension_model: Any = None
_rebate_catalog: dict = {}


def load_models() -> None:
    """Carga los modelos oficiales de FASE 8 desde disco. Llamar desde el lifespan de FastAPI."""
    global _churn_model, _propension_model, _rebate_catalog

    churn_path = settings.churn_model_path_full
    if not churn_path.exists():
        raise FileNotFoundError(
            f"Modelo de segmentación de churn no encontrado en: {churn_path}. "
            "Copia el archivo desde ModelosML/FASE 8/churn_model.pkl"
        )
    _churn_model = joblib.load(churn_path)

    # Pipeline de propensión (FASE 8): requerido para p_acceptance y mt_propensity.
    prop_path = settings.propension_model_path_full
    if not prop_path.exists():
        raise FileNotFoundError(
            f"Modelo de propensión no encontrado en: {prop_path}. "
            "Copia el archivo desde ModelosML/FASE 8/modelo_final_validado.pkl"
        )
    _propension_model = joblib.load(prop_path)

    # Catálogo de rebates (FASE 6) — estrategias por motivo de rechazo.
    rebate_path = settings.rebate_catalog_path_full
    if rebate_path.exists():
        with open(rebate_path, encoding="utf-8") as f:
            _rebate_catalog = json.load(f)



def _churn_features_vector(profile: dict) -> np.ndarray:
    """
    Vector de features del clustering de churn (FASE 8), en el ORDEN EXACTO
    de churn_segmentacion.pkl -> bundle["features"]:
      ['antiguedad_meses','uso_app_movistar_prom','monto_facturado_prom','n_reclamos',
       'n_actividad_canal','riesgo_mora_score','tiene_movil','tiene_hogar',
       'tiene_internet_hogar','elegible_mt']
    """
    features = [
        float(profile.get("antiguedad_meses", 0) or 0),
        float(profile.get("uso_app_movistar_prom", 0) or 0),
        float(profile.get("monto_facturado_prom", 0) or 0),
        float(profile.get("n_reclamos", 0) or 0),
        float(profile.get("n_actividad_canal", 0) or 0),
        float(profile.get("riesgo_mora_score", 0) or 0),
        1.0 if profile.get("tiene_movil") else 0.0,
        1.0 if profile.get("tiene_hogar") else 0.0,
        1.0 if profile.get("tiene_internet_hogar") else 0.0,
        1.0 if profile.get("elegible_mt") else 0.0,
    ]
    return np.array(features, dtype=np.float64).reshape(1, -1)


def _score_churn_segmentation(profile: dict) -> float:
    """
    Score de riesgo de churn desde la segmentación KMeans de FASE 8.
    El bundle contiene scaler + kmeans + mapa_cluster_a_etiqueta.
    La etiqueta se mapea a un score 0-1 (CHURN_LABEL_TO_RISK) para preservar
    el contrato del sistema (float con umbral 0.60).
    """
    bundle = _churn_model
    scaler = bundle["scaler"]
    kmeans = bundle["kmeans"]
    mapa = bundle.get("mapa_cluster_a_etiqueta", {})

    X = _churn_features_vector(profile)
    X_scaled = scaler.transform(X)
    cluster_id = int(kmeans.predict(X_scaled)[0])
    etiqueta = mapa.get(cluster_id, "riesgo_medio_bajo")
    return CHURN_LABEL_TO_RISK.get(etiqueta, 0.4)


def get_churn_label(profile: dict) -> str:
    """Devuelve la etiqueta de segmentación de churn (FASE 8) del cliente."""
    if isinstance(_churn_model, dict) and "kmeans" in _churn_model:
        bundle = _churn_model
        X = _churn_features_vector(profile)
        X_scaled = bundle["scaler"].transform(X)
        cluster_id = int(bundle["kmeans"].predict(X_scaled)[0])
        return bundle.get("mapa_cluster_a_etiqueta", {}).get(cluster_id, "riesgo_medio_bajo")
    return ""


def derive_mt_propensity(profile: dict) -> float:
    """
    Propensión a Movistar Total derivada del pipeline de aceptación (FASE 8):
    promedio de p_acceptance sobre las 3 ofertas MT del catálogo.

    Un valor alto indica que el modelo predice que el cliente aceptaría
    una oferta MT si se le presentara. Se usa como señal en _prefer_mt().
    """
    if _propension_model is None:
        return 0.0

    from app.ml.catalog_retriever import get_mt_offers_cached
    offers = get_mt_offers_cached()
    if not offers:
        return 0.0

    probs = _score_propension_rows(profile, offers)
    if not probs:
        return 0.0
    return round(float(np.mean(probs)), 4)


def score_customer_full(profile: dict) -> dict:
    """
    Genera scores + etiqueta de churn en UNA SOLA pasada del modelo de segmentación.

    Returns:
        {
            "churn_risk": float (0-1),
            "mt_propensity": float (0-1),
            "churn_label": str,
        }
    """
    if _churn_model is None:
        raise RuntimeError(
            "El modelo de churn no ha sido cargado. Verifica el lifespan de FastAPI."
        )

    # churn_segmentacion.pkl es siempre el bundle KMeans de FASE 8
    bundle = _churn_model
    X = _churn_features_vector(profile)
    X_scaled = bundle["scaler"].transform(X)
    cluster_id = int(bundle["kmeans"].predict(X_scaled)[0])
    etiqueta = bundle.get("mapa_cluster_a_etiqueta", {}).get(cluster_id, "riesgo_medio_bajo")
    churn_risk = CHURN_LABEL_TO_RISK.get(etiqueta, 0.4)
    churn_label = etiqueta

    mt_proba = derive_mt_propensity(profile)

    return {
        "churn_risk": round(churn_risk, 4),
        "mt_propensity": round(mt_proba, 4),
        "churn_label": churn_label,
    }


def score_customer(profile: dict) -> dict:
    """
    Genera los scores de propensión para el cliente.

    Returns:
        {
            "churn_risk": float (0-1),
            "mt_propensity": float (0-1),
        }
    """
    res = score_customer_full(profile)
    return {
        "churn_risk": res["churn_risk"],
        "mt_propensity": res["mt_propensity"],
    }


def _as_float(value) -> float | None:
    try:
        v = float(value)
        return v if pd.notna(v) else None
    except (TypeError, ValueError):
        return None


def _resolve_canal(profile: dict, canal: str = "") -> str:
    """Canal a usar como feature: el pasado por el asesor, o el recomendado (FASE 5)."""
    if canal:
        return canal
    return recomendar_canal(profile).get("canal_recomendado", "Digital")


def _build_propension_row_values(profile: dict, offer: dict, canal: str = "") -> dict:
    """
    Construye los 27 features cliente+oferta (FASE 7) para el pipeline.
    El orden de las claves del dict define el orden de las columnas del DataFrame.
    """
    cliente = {
        "antiguedad_meses": float(profile.get("antiguedad_meses", 0) or 0),
        "monto_facturado_prom": float(profile.get("monto_facturado_prom", 0) or 0),
        "riesgo_mora_score": float(profile.get("riesgo_mora_score", 0) or 0),
        "n_reclamos": float(profile.get("n_reclamos", 0) or 0),
        "n_actividad_canal": float(profile.get("n_actividad_canal", 0) or 0),
        "uso_app_movistar_prom": float(profile.get("uso_app_movistar_prom", 0) or 0),
        "diferencia_gasto": float(profile.get("diferencia_gasto", 0) or 0),
        "brecha_datos": float(profile.get("brecha_datos", 0) or 0),
        "brecha_datos_aplica": int(profile.get("brecha_datos_aplica", 1) or 0),
        "ahorro_potencial_mt": float(profile.get("ahorro_potencial_mt", 0) or 0),
        "ahorro_potencial_mt_aplica": int(profile.get("ahorro_potencial_mt_aplica", 0) or 0),
        "monto_facturado_prom_outlier": bool(profile.get("monto_facturado_prom_outlier", False)),
        "consumo_datos_gb_prom_outlier": bool(profile.get("consumo_datos_gb_prom_outlier", False)),
        "tiene_movil": bool(profile.get("tiene_movil", False)),
        "tiene_hogar": bool(profile.get("tiene_hogar", False)),
        "tiene_internet_hogar": bool(profile.get("tiene_internet_hogar", False)),
        "elegible_mt": bool(profile.get("elegible_mt", False)),
        "tipo_cliente": str(profile.get("tipo_cliente", "sin_linea_movil") or "sin_linea_movil"),
        "edad_rango": str(profile.get("edad_rango", "") or ""),
        "ubicacion_departamento": str(
            profile.get("ubicacion_departamento", "") or profile.get("ubicacion", "") or ""
        ),
        "canal_mas_usado": str(profile.get("canal_mas_usado", "") or ""),
    }

    oferta = {
        "oferta_tipo": str(offer.get("tipo_oferta", "desconocido") or "desconocido"),
        "segmento_objetivo": str(offer.get("segmento_objetivo", "ambos") or "ambos"),
        "precio_mensual": _as_float(offer.get("precio_mensual")) or 0.0,
        "ahorro_pct": _as_float(offer.get("ahorro_pct")) or 0.0,
        "gb_incluidos": _as_float(offer.get("gb_incluidos")) or 0.0,
    }

    return {"canal": _resolve_canal(profile, canal), **cliente, **oferta}


def _score_propension_rows(
    profile: dict,
    offers: list[dict],
    canal: str = "",
) -> list[float]:
    """
    Predice p_acceptance de varias ofertas en UNA sola pasada de predict_proba
    (batch). El pipeline OHE + XGBoost se ejecuta una vez, no una vez por oferta.

    Returns:
        lista de probabilidades en el mismo orden que `offers`.
    """
    if _propension_model is None or not offers:
        return [0.0] * len(offers)

    rows = [_build_propension_row_values(profile, offer, canal) for offer in offers]
    df = pd.DataFrame(rows)
    probas = _propension_model.predict_proba(df)[:, 1]
    return [round(float(p), 4) for p in probas]


def _score_propension_row(profile: dict, offer: dict, canal: str = "") -> float:
    """Versión de una sola oferta (usa el mismo pipeline, 1 fila)."""
    if _propension_model is None:
        return 0.0
    return _score_propension_rows(profile, [offer], canal)[0]


def score_offer_acceptance(
    profile: dict,
    offer: dict,
    canal: str = "",
) -> float:
    """
    Estima la probabilidad de aceptación (p_acceptance) de una oferta para un
    cliente usando el pipeline de Estadística (modelo_propension.pkl).

    El feature 'canal' se calcula con recomendar_canal() (FASE 5), que puede
    sobreescribirse con el parámetro `canal` (canal del asesor).

    Args:
        profile: perfil del cliente (con features derivadas de feature_engineering)
        offer:   oferta del catálogo (tipo_oferta, segmento_objetivo, precio...)
        canal:   canal opcional para forzar el canal (default: recomendar_canal)

    Returns:
        float (0-1) o 0.0 si el modelo no está disponible.
    """
    return _score_propension_row(profile, offer, canal)


def score_offers_acceptance(
    profile: dict,
    offers: list[dict],
    canal: str = "",
) -> list[float]:
    """
    Versión batch de score_offer_acceptance: predice p_acceptance de todas las
    ofertas en una sola pasada de predict_proba (mucho más rápido).

    Returns:
        lista de probabilidades en el mismo orden que `offers`.
    """
    return _score_propension_rows(profile, offers, canal)


def get_rebate_catalog() -> dict:
    """Devuelve el catálogo de estrategias de rebate (FASE 6)."""
    return _rebate_catalog


def build_rebate_prepared(profile: dict, limit: int | None = 2) -> list[dict]:
    """
    Arma la lista de estrategias de rebate preparadas para el asesor (FASE 6).
    Prioriza los motivos más probables para el cliente (los que tengan variables
    disponibles en el perfil), y completa con el resto del catálogo.

    Returns:
        lista de {motivo, estrategia, argumento_base}
    """
    if not _rebate_catalog:
        return []

    # Motivos prioritarios según la señal disponible del cliente.
    prioridad: list[str] = []
    if profile.get("ahorro_potencial_mt_aplica"):
        prioridad.append("precio")
    if profile.get("brecha_datos_aplica"):
        prioridad.append("no_necesita")
    prioridad += [m for m in _rebate_catalog if m not in prioridad]

    items = [
        {
            "motivo": m,
            "estrategia": _rebate_catalog[m]["estrategia"],
            "argumento_base": _rebate_catalog[m]["argumento_base"],
        }
        for m in prioridad
        if m in _rebate_catalog
    ]
    if limit:
        items = items[:limit]
    return items