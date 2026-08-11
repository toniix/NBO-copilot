"""
catalog_retriever.py
--------------------
Carga el índice vectorial (Chroma) del catálogo de ofertas una sola vez
(singleton) y expone retrieve_offers(), que recupera las ofertas más
relevantes para un perfil de cliente dado sus features y scores ML.

El índice se construye offline con scripts/build_catalog_index.py.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pandas as pd
from chromadb import PersistentClient
from chromadb.utils import embedding_functions

from app.core.config import settings
from app.ml.feature_engineering import CHURN_HIGH_THRESHOLD

logger = logging.getLogger(__name__)

COLLECTION_NAME = "catalogo_ofertas"

# ---------------------------------------------------------------------------
# Singleton — índice y catálogo crudo se cargan una sola vez
# ---------------------------------------------------------------------------
_collection: Any = None
_catalog_df: pd.DataFrame | None = None


def load_catalog() -> None:
    """Carga el índice Chroma y el catálogo crudo. Llamar desde el lifespan."""
    global _collection, _catalog_df

    index_dir = settings.catalog_index_full
    if not (index_dir / "chroma.sqlite3").exists():
        raise FileNotFoundError(
            f"Índice de catálogo no encontrado en: {index_dir}. "
            "Ejecuta: python scripts/build_catalog_index.py"
        )

    embed_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name=settings.CATALOG_EMBEDDING_MODEL
    )
    client = PersistentClient(path=str(index_dir))
    _collection = client.get_collection(name=COLLECTION_NAME, embedding_function=embed_fn)

    csv_path = index_dir / "catalog.csv"
    if csv_path.exists():
        _catalog_df = pd.read_csv(csv_path).fillna("")
    else:
        _catalog_df = pd.read_csv(settings.catalog_path_full).fillna("")

    logger.info(f"✅ Catálogo cargado: {_collection.count()} ofertas indexadas.")


def _is_catalog_loaded() -> bool:
    return _collection is not None and _catalog_df is not None


def get_catalog_df() -> pd.DataFrame:
    """Acceso al catálogo crudo (para joins por oferta_id)."""
    if not _is_catalog_loaded():
        raise RuntimeError("El catálogo no ha sido cargado. Verifica el lifespan.")
    return _catalog_df


def retrieve_offers(
    profile: dict,
    scores: dict,
    top_k: int | None = None,
) -> list[dict]:
    """
    Recupera las ofertas más relevantes para el perfil del cliente.

    Construye una query textual a partir del perfil + scores ML, la
    convierte en embedding y busca las top-k más similares en el índice.
    Aplica reglas de negocio de filtrado (segmento objetivo compatible).

    Returns:
        Lista de ofertas con metadatos + score de similitud:
        [{"oferta_id", "nombre_oferta", "tipo_oferta", "segmento_objetivo",
          "es_movistar_total", "precio_mensual", "ahorro_pct", "gb_incluidos",
          "cluster_hogar", "score": float}, ...]
    """
    if not _is_catalog_loaded():
        raise RuntimeError("El catálogo no ha sido cargado. Verifica el lifespan.")

    top_k = top_k or settings.CATALOG_TOP_K
    query = _build_query(profile, scores)

    # 1) Recuperación semántica (top-k × 2 para luego filtrar)
    results = _collection.query(query_texts=[query], n_results=top_k * 2)

    offers: list[dict] = []
    ids = results["ids"][0]
    metas = results["metadatas"][0]
    distances = results["distances"][0]

    for oferta_id, meta, distance in zip(ids, metas, distances):
        offer = dict(meta)
        offer["oferta_id"] = oferta_id
        offer["score"] = round(1.0 - float(distance), 4)  # similitud coseno
        offers.append(offer)

    # 2) Reglas de negocio: filtrar por segmento compatible
    offers = _filter_by_business_rules(offers, profile, scores)

    # 3) Boosting híbrido: si churn/alta propensión MT, priorizar ofertas MT
    offers = _boost_relevant_offers(offers, profile, scores)

    # Ordenar por relevancia combinada: MT boost primero (mirror de regla de negocio)
    offers.sort(
        key=lambda o: (
            1.0 if _is_mt(o) and _prefer_mt(profile, scores) else 0.0,
            o.get("score", 0.0),
        ),
        reverse=True,
    )

    return offers[:top_k]


def _build_query(profile: dict, scores: dict) -> str:
    """Construye una descripción textual del cliente para búsqueda semántica."""
    servicios = []
    if profile.get("tiene_movil"):
        servicios.append("plan movil")
    if profile.get("tiene_hogar") or profile.get("tiene_internet_hogar"):
        servicios.append("plan hogar")
    servicios_str = " y ".join(servicios) if servicios else "sin servicios"

    consumo = float(profile.get("consumo_datos_gb_prom", 0) or 0)
    churn = float(scores.get("churn_risk", 0) or 0)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)

    contexto = []
    if churn > 0.60:
        contexto.append("alto riesgo de cancelacion, necesita retencion con descuento o beneficio especial")
    else:
        contexto.append("cliente estable con oportunidad de crecimiento y mejora de plan")
    if mt_prop > 0.50:
        contexto.append("muy propenso a Movistar Total convergente")
    if consumo > 30:
        contexto.append("alto consumo de datos")
    elif consumo > 0 and consumo <= 10:
        contexto.append("bajo consumo de datos, plan economico")

    return (
        f"Cliente con {servicios_str}. "
        f"Consume {consumo:.1f} GB/mes de datos. " + ". ".join(contexto) + "."
    )


def _prefer_mt(profile: dict, scores: dict) -> bool:
    """¿Conviene recomendar ofertas Movistar Total al cliente?"""
    churn = float(scores.get("churn_risk", 0) or 0)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)
    es_mt = profile.get("es_movistar_total", False)
    elegible_mt = profile.get("elegible_mt", False)
    # Cliente MT: se le ofrece upgrade premium dentro de la familia MT
    if es_mt:
        return _tiene_upgrade_mt_superior(profile)
    return (churn > CHURN_HIGH_THRESHOLD and not es_mt) or (
        elegible_mt and mt_prop > 0.50 and not es_mt
    )


def _tiene_upgrade_mt_superior(profile: dict) -> bool:
    """Hay una oferta MT más cara que el plan actual del cliente (upgrade)."""
    actual_price = _plan_actual_price(profile)
    if actual_price is None:
        return False
    catalog = get_catalog_df()
    mt_offers = catalog[catalog["es_movistar_total"].astype(str).str.lower() == "true"]
    for _, row in mt_offers.iterrows():
        precio = _as_float(row["precio_mensual"])
        if precio is not None and precio > actual_price:
            return True
    return False


def _plan_actual_price(profile: dict) -> float | None:
    """Precio del plan/estado actual del cliente desde el catálogo."""
    catalog = get_catalog_df()
    plan_id = str(profile.get("plan_actual_id", "") or "")
    if not plan_id:
        return None
    row = catalog[catalog["oferta_id"].astype(str) == plan_id]
    if row.empty:
        return None
    return _as_float(row.iloc[0]["precio_mensual"])


def _as_float(value) -> float | None:
    try:
        v = float(value)
        return v
    except (TypeError, ValueError):
        return None


def _is_mt(offer: dict) -> bool:
    return str(offer.get("es_movistar_total", "False")).lower() == "true"


def _boost_relevant_offers(
    offers: list[dict], profile: dict, scores: dict
) -> list[dict]:
    """
    Refuerza las candidatas con ofertas del catálogo relevantes por reglas de
    negocio que el RAG semántico podría no recuperar (p. ej. MT de retención
    para clientes con churn alto). Devolver numéricas sin duplicados.
    """
    candidates = {o["oferta_id"]: o for o in offers}
    catalog = get_catalog_df()
    churn = float(scores.get("churn_risk", 0) or 0)
    es_mt = profile.get("es_movistar_total", False)
    única = _prefer_mt(profile, scores)

    if única and not es_mt:
        mt_rows = catalog[catalog["es_movistar_total"].astype(str).str.lower() == "true"]
        for _, row in mt_rows.iterrows():
            oid = str(row["oferta_id"])
            if oid not in candidates:
                offer = {
                    "oferta_id": oid,
                    "nombre_oferta": str(row["nombre_oferta"]),
                    "tipo_oferta": str(row["tipo_oferta"]),
                    "segmento_objetivo": str(row["segmento_objetivo"]),
                    "es_movistar_total": "True",
                    "precio_mensual": _as_float(row["precio_mensual"]),
                    "ahorro_pct": _as_float(row["ahorro_pct"]) or 0.0,
                    "gb_incluidos": _as_float(row["gb_incluidos"]) or 0.0,
                    "cluster_hogar": str(row["cluster_hogar"]) if row["cluster_hogar"] else "",
                    "score": 0.8,  # alta relevancia por regla de negocio
                }
                candidates[oid] = offer

    if es_mt:
        # Cliente MT: reforzar con upgrades MT de precio superior al actual
        actual_price = _plan_actual_price(profile)
        mt_rows = catalog[catalog["es_movistar_total"].astype(str).str.lower() == "true"]
        for _, row in mt_rows.iterrows():
            oid = str(row["oferta_id"])
            precio = _as_float(row["precio_mensual"])
            if precio is None or (actual_price is not None and precio <= actual_price):
                continue  # no downgrade
            if oid not in candidates:
                candidates[oid] = {
                    "oferta_id": oid,
                    "nombre_oferta": str(row["nombre_oferta"]),
                    "tipo_oferta": str(row["tipo_oferta"]),
                    "segmento_objetivo": str(row["segmento_objetivo"]),
                    "es_movistar_total": "True",
                    "precio_mensual": precio,
                    "ahorro_pct": _as_float(row["ahorro_pct"]) or 0.0,
                    "gb_incluidos": _as_float(row["gb_incluidos"]) or 0.0,
                    "cluster_hogar": str(row["cluster_hogar"]) if row["cluster_hogar"] else "",
                    "score": 0.85,
                }

    return list(candidates.values())


def _filter_by_business_rules(
    offers: list[dict], profile: dict, scores: dict
) -> list[dict]:
    """
    Reglas simples de filtrado:
      - Ofertas de segmento 'hogar' solo para clientes con servicio hogar.
      - Ofertas de segmento 'movil' solo para clientes con servicio movil.
      - Ofertas 'ambos' son válidas para cualquier cliente.
      - Si el cliente ya es MT, descartar ofertas 'movistar_total' de adquisición
        (quedan upgrades/paquetes), salvo retención por churn alto.
    """
    tiene_movil = profile.get("tiene_movil", False)
    tiene_hogar = profile.get("tiene_hogar") or profile.get("tiene_internet_hogar", False)
    es_mt = profile.get("es_movistar_total", False)
    churn = float(scores.get("churn_risk", 0) or 0)

    filtered: list[dict] = []
    for offer in offers:
        segmento = str(offer.get("segmento_objetivo", "ambos"))
        if segmento == "hogar" and not tiene_hogar:
            continue
        if segmento == "movil" and not tiene_movil:
            continue
        es_mt_offer = str(offer.get("es_movistar_total", "False")).lower() == "true"
        if es_mt and es_mt_offer and churn <= 0.60:
            continue
        filtered.append(offer)

    # Si el filtro dejó vacío, devolver las originales (fallback seguro)
    return filtered if filtered else offers
