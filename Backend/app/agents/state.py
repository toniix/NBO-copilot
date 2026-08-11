from __future__ import annotations
from typing import Optional
from typing_extensions import TypedDict


class AgentState(TypedDict):
    """Estado compartido a través de todos los nodos del grafo LangGraph."""

    dni: str
    customer_profile: dict
    ml_scores: dict          # {"churn_risk": float, "mt_propensity": float}
    nbo_selected: str        # Nombre del producto recomendado
    offers_retrieved: list   # Ofertas del catálogo recuperadas por RAG
    offer_selected: dict     # Oferta final seleccionada (metadatos del catálogo)
    justification: str       # Por qué se eligió esa oferta
    channel_recommendation: dict  # {"channel", "timing", "advice", "canal_actual"}
    rebate_prepared: list  # Estrategias de rebate por motivo de rechazo (FASE 6)
    churn_label: str       # Etiqueta de segmentación de riesgo (FASE 8)
    sales_pitch: str         # Guion generado por el LLM
    pitch_type: str          # "fidelizacion" | "upselling"
    price_delta: dict         # {"diferencia_precio", "precio_actual", "precio_oferta", "gb_extra"}
    node_timings: dict       # Tiempo de ejecución por nodo (ms) para diagnóstico
    error: Optional[str]
