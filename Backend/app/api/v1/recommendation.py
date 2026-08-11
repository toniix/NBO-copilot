"""
recommendation.py
-----------------
Endpoint POST /api/v1/recommendation
Orquesta la ejecución del grafo LangGraph y devuelve el resultado al Frontend.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.agents.graph import get_nbo_graph
from app.ml.outcome_store import record_outcome

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RecommendationRequest(BaseModel):
    dni: str = Field(
        ...,
        min_length=1,
        max_length=20,
        examples=["CLI000001"],
        description="ID o DNI del cliente a consultar",
    )


class MLScores(BaseModel):
    churn_risk: float
    mt_propensity: float


class OfferSelected(BaseModel):
    oferta_id: str
    nombre_oferta: str
    tipo_oferta: str | None = None
    segmento_objetivo: str | None = None
    es_movistar_total: bool | None = None
    precio_mensual: float | None = None
    ahorro_pct: float | None = None
    gb_incluidos: float | None = None
    cluster_hogar: str | None = None
    score: float | None = None
    p_acceptance: float | None = None


class ChannelRecommendation(BaseModel):
    channel: str
    timing: str
    advice: str
    canal_actual: str


class RebatePrepared(BaseModel):
    motivo: str
    estrategia: str
    argumento_base: str


class RecommendationResponse(BaseModel):
    cliente_id: str
    gestion_id: str
    customer_profile: dict
    ml_scores: MLScores
    nbo_selected: str
    offer_selected: OfferSelected
    justification: str
    offers_retrieved: list[OfferSelected]
    channel_recommendation: ChannelRecommendation
    rebate_prepared: list[RebatePrepared] = []
    churn_label: str = ""
    sales_pitch: str
    pitch_type: str
    churn_alert: bool   # True si churn_risk > 0.60
    node_timings: dict = {}  # ms por nodo del grafo (diagnóstico de rendimiento)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post(
    "/recommendation",
    response_model=RecommendationResponse,
    summary="Obtener recomendación NBO para un cliente",
    description=(
        "Ejecuta el pipeline de IA (Feature Engineering → ML Scoring → LLM Pitch) "
        "y devuelve el perfil del cliente, scores de propensión y un guion de venta personalizado."
    ),
)
async def get_recommendation(payload: RecommendationRequest):
    logger.info(f"[API] Solicitud de recomendación para DNI: {payload.dni}")

    # Estado inicial del grafo
    initial_state = {
        "dni": payload.dni.strip(),
        "customer_profile": {},
        "ml_scores": {},
        "nbo_selected": "",
        "offers_retrieved": [],
        "offer_selected": {},
        "justification": "",
        "channel_recommendation": {},
        "rebate_prepared": [],
        "churn_label": "",
        "sales_pitch": "",
        "pitch_type": "",
        "error": None,
    }

    # Ejecutar el grafo de forma asíncrona
    t0 = time.perf_counter()
    try:
        result = await get_nbo_graph().ainvoke(initial_state)
    except Exception as exc:
        logger.error(f"[API] Error ejecutando el grafo: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error interno del agente: {exc}")
    total_ms = (time.perf_counter() - t0) * 1000
    node_timings = dict(result.get("node_timings", {}) or {})
    node_timings["__total__"] = round(total_ms, 2)
    logger.info(f"[API] Grafo completo en {total_ms:.1f} ms -> node_timings={node_timings}")

    # Propagar errores de negocio
    if result.get("error"):
        error_msg = result["error"]
        if "no encontrado" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        raise HTTPException(status_code=422, detail=error_msg)

    # Validar que el resultado esté completo
    profile = result.get("customer_profile", {})
    scores = result.get("ml_scores", {})
    if not profile or not scores:
        raise HTTPException(
            status_code=500,
            detail="El pipeline no retornó datos completos. Verifica los modelos ML.",
        )

    churn_risk = scores.get("churn_risk", 0.0)
    offer_selected = result.get("offer_selected", {}) or {}
    offers_retrieved = result.get("offers_retrieved", []) or []
    channel_rec = result.get("channel_recommendation", {}) or {}

    # Trazabilidad: genera un id de gestión y registra el ofrecimiento
    gestion_id = uuid.uuid4().hex
    try:
        record_outcome(
            cliente_id=profile.get("cliente_id", payload.dni),
            outcome="ofrecida",
            gestion_id=gestion_id,
            oferta_id=offer_selected.get("oferta_id", ""),
            nombre_oferta=offer_selected.get("nombre_oferta", ""),
            pitch_type=result.get("pitch_type", ""),
            channel=channel_rec.get("channel", ""),
            canal_actual=channel_rec.get("canal_actual", ""),
            sales_pitch=result.get("sales_pitch", ""),
        )
    except Exception as exc:  # No debe tumbar la recomendación
        logger.warning(f"[API] No se pudo registrar el ofrecimiento: {exc}")

    return RecommendationResponse(
        cliente_id=profile.get("cliente_id", payload.dni),
        gestion_id=gestion_id,
        customer_profile=profile,
        ml_scores=MLScores(
            churn_risk=churn_risk,
            mt_propensity=scores.get("mt_propensity", 0.0),
        ),
        nbo_selected=result.get("nbo_selected", ""),
        offer_selected=OfferSelected(
            oferta_id=offer_selected.get("oferta_id", ""),
            nombre_oferta=offer_selected.get("nombre_oferta", ""),
            tipo_oferta=offer_selected.get("tipo_oferta"),
            segmento_objetivo=offer_selected.get("segmento_objetivo"),
            es_movistar_total=(
                str(offer_selected.get("es_movistar_total", "")).lower() == "true"
                if offer_selected.get("es_movistar_total")
                else None
            ),
            precio_mensual=offer_selected.get("precio_mensual"),
            ahorro_pct=offer_selected.get("ahorro_pct"),
            gb_incluidos=offer_selected.get("gb_incluidos"),
            cluster_hogar=offer_selected.get("cluster_hogar"),
            score=offer_selected.get("score"),
            p_acceptance=offer_selected.get("p_acceptance"),
        ),
        justification=result.get("justification", ""),
        channel_recommendation=ChannelRecommendation(
            channel=channel_rec.get("channel", ""),
            timing=channel_rec.get("timing", ""),
            advice=channel_rec.get("advice", ""),
            canal_actual=channel_rec.get("canal_actual", ""),
        ),
        offers_retrieved=[
            OfferSelected(
                oferta_id=o.get("oferta_id", ""),
                nombre_oferta=o.get("nombre_oferta", ""),
                tipo_oferta=o.get("tipo_oferta"),
                segmento_objetivo=o.get("segmento_objetivo"),
                es_movistar_total=(
                    str(o.get("es_movistar_total", "")).lower() == "true"
                    if o.get("es_movistar_total")
                    else None
                ),
                precio_mensual=o.get("precio_mensual"),
                ahorro_pct=o.get("ahorro_pct"),
                gb_incluidos=o.get("gb_incluidos"),
                cluster_hogar=o.get("cluster_hogar"),
                score=o.get("score"),
                p_acceptance=o.get("p_acceptance"),
            )
            for o in offers_retrieved
        ],
        sales_pitch=result.get("sales_pitch", ""),
        pitch_type=result.get("pitch_type", ""),
        rebate_prepared=result.get("rebate_prepared", []) or [],
        churn_label=result.get("churn_label", "") or "",
        churn_alert=churn_risk > 0.60,
        node_timings=node_timings,
    )
