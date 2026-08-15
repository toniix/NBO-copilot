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
from app.agents.utils import is_mt_offer
from app.ml.production_contract import get_umbral_decision
from app.ml.feature_engineering import necesita_estrategia_retencion

logger = logging.getLogger(__name__)

COLLECTION_NAME = "catalogo_ofertas"

# ---------------------------------------------------------------------------
# Reglas de negocio de asequibilidad (FASE 7)
# ---------------------------------------------------------------------------
# Una oferta se descarta si su precio supera el factor × la referencia de gasto
# del cliente (factura promedio, o precio del plan actual como fallback). Si el
# cliente arrastra mora, el tope se endurece para no empujar upselling premium.
AFFORDABILITY_FACTOR = 1.5
AFFORDABILITY_FACTOR_MOROSO = 1.25


def _affordability_cap(profile: dict) -> float | None:
    """
    Tope de precio del cliente según FASE 7: factor × referencia de gasto
    (factura promedio; si falta, precio del plan actual). Con mora el factor
    se endurece (1.25) para no empujar upselling premium a morosos.
    """
    factura = _as_float(profile.get("monto_facturado_prom"))
    if factura is None:
        factura = _plan_actual_price(profile)
    if factura is None:
        return None
    moroso = int(profile.get("meses_moroso", 0) or 0) > 0
    factor = AFFORDABILITY_FACTOR_MOROSO if moroso else AFFORDABILITY_FACTOR
    return factura * factor

# ---------------------------------------------------------------------------
# Umbral de propensión a Movistar Total (contrato con Estadística)
# ---------------------------------------------------------------------------
# mt_propensity es la media de p_acceptance sobre las ofertas MT (probabilidades
# del modelo de aceptación). Se alinea con el umbral de decisión del modelo
# (umbral_decision_modelo) para que "alta propensión" tenga el mismo significado
# que "aceptaría" según la última versión del ML de Estadística.
MT_PROPENSITY_THRESHOLD: float = float(get_umbral_decision())

# ---------------------------------------------------------------------------
# Prior de Movistar Total sobre el ranking ML (boost suave)
# ---------------------------------------------------------------------------
# λ en p_acceptance + λ·I_mt. Valor ~ +5 p.p.: prioriza MT sin que el boost
# binario eclipse la diferencia real de propensión entre ofertas.
MT_PROPENSITY_BOOST: float = 0.05

# ---------------------------------------------------------------------------
# Singleton — índice y catálogo crudo se cargan una sola vez
# ---------------------------------------------------------------------------
_collection: Any = None
_catalog_df: pd.DataFrame | None = None
_mt_offers_cache: list[dict] = []


def load_catalog() -> None:
    """Carga el índice Chroma y el catálogo crudo. Llamar desde el lifespan."""
    global _collection, _catalog_df, _mt_offers_cache

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

    mt_rows = _catalog_df[_catalog_df["es_movistar_total"].astype(str).str.lower() == "true"]
    _mt_offers_cache = [
        {
            "tipo_oferta": str(row["tipo_oferta"]),
            "segmento_objetivo": str(row["segmento_objetivo"]),
            "precio_mensual": _as_float(row["precio_mensual"]),
            "ahorro_pct": _as_float(row["ahorro_pct"]),
            "gb_incluidos": _as_float(row["gb_incluidos"]),
        }
        for _, row in mt_rows.iterrows()
    ]

    logger.info(f"✅ Catálogo cargado: {_collection.count()} ofertas indexadas.")


def get_mt_offers_cached() -> list[dict]:
    """Devuelve las ofertas MT precacheadas."""
    return _mt_offers_cache


def _is_catalog_loaded() -> bool:
    return _collection is not None and _catalog_df is not None


def get_catalog_df() -> pd.DataFrame:
    """Acceso al catálogo crudo (para joins por oferta_id)."""
    if not _is_catalog_loaded():
        raise RuntimeError("El catálogo no ha sido cargado. Verifica el lifespan.")
    return _catalog_df


def _row_to_offer(row: "pd.Series", score: float = 0.0) -> dict:
    """Convierte una fila del catálogo crudo en el dict de oferta del pipeline."""
    return {
        "oferta_id": str(row["oferta_id"]),
        "nombre_oferta": str(row["nombre_oferta"]),
        "tipo_oferta": str(row["tipo_oferta"]),
        "segmento_objetivo": str(row["segmento_objetivo"]),
        "es_movistar_total": str(row["es_movistar_total"]),
        "precio_mensual": _as_float(row["precio_mensual"]),
        "ahorro_pct": _as_float(row["ahorro_pct"]) or 0.0,
        "gb_incluidos": _as_float(row["gb_incluidos"]) or 0.0,
        "cluster_hogar": (
            str(row["cluster_hogar"]) if pd.notna(row["cluster_hogar"]) else ""
        ),
        "descripcion_bundle": (
            str(row["descripcion_bundle"]) if pd.notna(row["descripcion_bundle"]) else ""
        ),
        "descripcion_corta": (
            str(row["descripcion_corta"]) if pd.notna(row["descripcion_corta"]) else ""
        ),
        "score": float(score),
    }


def get_all_catalog_offers() -> list[dict]:
    """
    Devuelve TODAS las ofertas del catálogo como dicts, sin filtros.

    El NBO es un optimizador global: se puntúan todas las ofertas elegibles con
    el modelo de aceptación (p_acceptance) y se rankean por ML. El RAG queda como
    memoria semántica (score de relevancia para desempate y alternativas del LLM),
    no como compuerta que recorta el catálogo.
    """
    catalog = get_catalog_df()
    return [_row_to_offer(row) for _, row in catalog.iterrows()]


def filter_by_business_rules(
    offers: list[dict], profile: dict, scores: dict
) -> list[dict]:
    """Wrapper público de `_filter_by_business_rules` (usado por el nodo NBO)."""
    return _filter_by_business_rules(offers, profile, scores)


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

    # Ordenar por relevancia combinada: score semántico + prior suave de MT.
    # El boost binario (1.0) se reemplaza por el prior acotado del ranking ML
    # (p + λ·I_mt) para no eclipsar la señal real de relevancia.
    for o in offers:
        o["score"] = o.get("score", 0.0) + _boost_mt_propensity(o, profile)
    offers.sort(key=lambda o: o.get("score", 0.0), reverse=True)

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
    if necesita_estrategia_retencion(churn, profile):
        contexto.append("alto riesgo de cancelacion, necesita retencion con descuento o beneficio especial")
    else:
        contexto.append("cliente estable con oportunidad de crecimiento y mejora de plan")
    # MT solo si el cliente es elegible; si no, mencionarlo lo arrastra hacia
    # ofertas convergentes premium que no puede contratar.
    if mt_prop > MT_PROPENSITY_THRESHOLD and profile.get("elegible_mt"):
        contexto.append("muy propenso a Movistar Total convergente")
    if int(profile.get("meses_moroso", 0) or 0) > 0:
        contexto.append("cliente con retrasos de pago, priorizar ofertas economicas y de retencion, evitar planes premium")
    if consumo > 30:
        contexto.append("alto consumo de datos")
    elif consumo > 0 and consumo <= 10:
        contexto.append("bajo consumo de datos, plan economico, no necesita datos ilimitados")

    return (
        f"Cliente con {servicios_str}. "
        f"Consume {consumo:.1f} GB/mes de datos. " + ". ".join(contexto) + "."
    )


def _prefer_mt(profile: dict, scores: dict) -> bool:
    """
    Decide si conviene recomendar ofertas Movistar Total al cliente.

    Condiciones:
    - Clientes ya MT: solo si hay un upgrade superior disponible.
    - Clientes NO-MT: deben ser elegibles Y tener alta propensión MT.
      El umbral es umbral_decision_modelo (contrato con Estadística): se
      considera "alta propensión" cuando la media de p_acceptance sobre las
      ofertas MT supera el mismo umbral que el modelo usa para decidir si el
      cliente aceptaría una oferta. Antes era un 0.65 arbitrario que no estaba
      alineado con el modelo.
      Nota: el churn alto por sí solo NO activa la recomendación MT si el cliente
      no es elegible — en ese caso se elige la mejor oferta de retención.
    """
    es_mt = profile.get("es_movistar_total", False)
    elegible_mt = profile.get("elegible_mt", False)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)

    if es_mt:
        return _tiene_upgrade_mt_superior(profile)

    # Condición necesaria: el cliente debe ser elegible para contratar MT
    if not elegible_mt:
        return False

    # Condición suficiente: propensidad alta según el modelo (umbral de decisión)
    return mt_prop > MT_PROPENSITY_THRESHOLD


def prefer_mt(profile: dict, scores: dict) -> bool:
    """Wrapper público de `_prefer_mt` para la capa de selección del NBO."""
    return _prefer_mt(profile, scores)


def _boost_mt_propensity(offer: dict, profile: dict) -> float:
    """
    Prior suave de Movistar Total aplicado al ranking.

    En lugar del boost binario (1.0 si MT y prefer_mt), el ranking puntúa
    score + λ·I_mt con λ = MT_PROPENSITY_BOOST. La prioridad MT entra como un
    empujón acotado (≈ +5 p.p.) que nunca eclipsa la señal real de relevancia
    (semántica o p_acceptance).

    Devuelve 0.0 si la oferta no es MT, o si el cliente no es elegible MT.
    """
    if not is_mt_offer(offer):
        return 0.0
    if not profile.get("elegible_mt", False):
        return 0.0
    return float(MT_PROPENSITY_BOOST)


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


def _current_plan_info(profile: dict) -> dict | None:
    """Precio, GB y tipo del plan actual del cliente (para anti-downgrade)."""
    catalog = get_catalog_df()
    plan_id = str(profile.get("plan_actual_id", "") or "")
    if not plan_id:
        return None
    row = catalog[catalog["oferta_id"].astype(str) == plan_id]
    if row.empty:
        return None
    return {
        "precio": _as_float(row.iloc[0]["precio_mensual"]),
        "gb": _as_float(row.iloc[0]["gb_incluidos"]),
        "tipo": str(row.iloc[0].get("tipo_oferta", "") or ""),
    }


def _es_downgrade(offer: dict, current: dict) -> bool:
    """
    El NBO nunca debe recomendar un plan inferior al actual del cliente:
    - plan_movil vs plan_movil: descartar si cuesta menos o trae menos GB
      (salvo que el plan actual sea ilimitado, caso cubierto por GB).
    - plan_hogar vs plan_hogar: descartar si cuesta menos.
    - "upgrade" (extra de GB): sin sentido si el plan actual ya es tope/ilimitado.
    El resto de cruces (cross-selling a otra categoría) no es downgrade.
    """
    tipo_oferta = str(offer.get("tipo_oferta", "") or "")
    precio = _as_float(offer.get("precio_mensual"))
    gb = _as_float(offer.get("gb_incluidos"))
    tipo_actual = current.get("tipo")
    precio_actual = current.get("precio")
    gb_actual = current.get("gb")

    if tipo_oferta == "plan_movil" and tipo_actual == "plan_movil":
        if precio is not None and precio_actual is not None and precio < precio_actual:
            return True
        if (
            gb is not None and gb_actual is not None
            and gb_actual < 9999 and gb < gb_actual
        ):
            return True
        return False

    if tipo_oferta == "plan_hogar" and tipo_actual == "plan_hogar":
        return precio is not None and precio_actual is not None and precio < precio_actual

    if tipo_oferta == "upgrade" and gb_actual is not None and gb_actual >= 9999:
        return True

    return False


def _as_float(value) -> float | None:
    try:
        v = float(value)
        return v
    except (TypeError, ValueError):
        return None


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

    # Asequibilidad: precio de la oferta <= factor × referencia de gasto.
    cap = _affordability_cap(profile)
    moroso = int(profile.get("meses_moroso", 0) or 0) > 0

    current = _current_plan_info(profile)

    filtered: list[dict] = []
    for offer in offers:
        segmento = str(offer.get("segmento_objetivo", "ambos"))
        if segmento == "hogar" and not tiene_hogar:
            continue
        if segmento == "movil" and not tiene_movil:
            continue
        es_mt_offer = str(offer.get("es_movistar_total", "False")).lower() == "true"
        if es_mt and es_mt_offer and not necesita_estrategia_retencion(churn, profile):
            continue
        if cap is not None:
            precio = _as_float(offer.get("precio_mensual"))
            if precio is not None and precio > cap:
                continue
        if current is not None and _es_downgrade(offer, current):
            continue
        filtered.append(offer)

    # Si el filtro dejó vacío, devolver las originales (fallback seguro)
    return filtered if filtered else offers
