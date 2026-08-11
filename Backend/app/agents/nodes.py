"""
nodes.py
--------
Nodos del grafo LangGraph para el pipeline NBO de Movistar.

Flujo:
  feature_eng_node → ml_scoring_node → llm_pitch_node
"""

from __future__ import annotations

import logging
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage

from app.agents.state import AgentState
from app.agents.utils import is_mt_offer
from app.ml.feature_engineering import get_customer_profile, CHURN_HIGH_THRESHOLD
from app.ml.model_loader import (
    score_customer_full,
    score_offers_acceptance,
    build_rebate_prepared,
)
from app.ml.channel_recommender import recomendar_canal
from app.ml.catalog_retriever import retrieve_offers, get_catalog_df
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM (inicializado una vez al importar el módulo)
# ---------------------------------------------------------------------------
_llm = ChatOpenAI(
    model="gpt-5.4-mini",
    temperature=0.7,
    api_key=settings.OPENAI_API_KEY,
    base_url=settings.OPENAI_BASE_URL,
    timeout=settings.LLM_TIMEOUT_SECONDS,
    max_retries=settings.LLM_MAX_RETRIES,
)

# ---------------------------------------------------------------------------
# Nodo 1: Feature Engineering
# ---------------------------------------------------------------------------

def feature_eng_node(state: AgentState) -> dict:
    """
    Lee el CSV y extrae el perfil del cliente.
    Si no existe, marca el error en el estado.
    """
    dni = state["dni"]
    logger.info(f"[feature_eng_node] Buscando cliente: {dni}")

    try:
        profile = get_customer_profile(dni)
    except Exception as exc:
        logger.error(f"[feature_eng_node] Error al cargar datos: {exc}")
        return {"error": f"Error al cargar datos del cliente: {exc}", "customer_profile": {}}

    if profile is None:
        return {
            "error": f"Cliente con ID '{dni}' no encontrado en el dataset.",
            "customer_profile": {},
        }

    logger.info(f"[feature_eng_node] Perfil extraído: {profile.get('cliente_id')}")
    return {"customer_profile": profile, "error": None}


# ---------------------------------------------------------------------------
# Nodo 2: ML Scoring
# ---------------------------------------------------------------------------

def ml_scoring_node(state: AgentState) -> dict:
    """
    Carga los modelos .pkl y calcula churn_risk y mt_propensity.
    Determina el tipo de pitch basado en churn_risk.
    """
    if state.get("error"):
        return {}  # Propaga el error sin ejecutar

    profile = state["customer_profile"]
    logger.info(f"[ml_scoring_node] Calculando scores para: {profile.get('cliente_id')}")

    try:
        res = score_customer_full(profile)
    except Exception as exc:
        logger.error(f"[ml_scoring_node] Error en scoring: {exc}")
        return {"error": f"Error en modelo ML: {exc}", "ml_scores": {}}

    scores = {"churn_risk": res["churn_risk"], "mt_propensity": res["mt_propensity"]}
    churn_risk = scores["churn_risk"]
    pitch_type = "fidelizacion" if churn_risk > CHURN_HIGH_THRESHOLD else "upselling"

    logger.info(
        f"[ml_scoring_node] churn_risk={churn_risk:.2f}, "
        f"mt_propensity={scores['mt_propensity']:.2f}, "
        f"pitch_type={pitch_type}"
    )

    return {
        "ml_scores": scores,
        "pitch_type": pitch_type,
        "churn_label": res["churn_label"],
    }


# ---------------------------------------------------------------------------
# Nodo 2.5: Catalog Retrieval (RAG) — selecciona el NBO desde el catálogo real
# ---------------------------------------------------------------------------

def catalog_retrieval_node(state: AgentState) -> dict:
    """
    Recupera del vector store (Chroma) las ofertas del catálogo más relevantes
    para el perfil del cliente y selecciona el Next Best Offer aplicando
    reglas de negocio sobre los scores ML. Además recomienda el canal y el
    momento óptimo para presentar la oferta.
    """
    profile = state["customer_profile"]
    scores = state["ml_scores"]
    logger.info(f"[catalog_retrieval_node] Recuperando ofertas para: {profile.get('cliente_id')}")

    try:
        offers = retrieve_offers(profile, scores)
    except Exception as exc:
        logger.error(f"[catalog_retrieval_node] Error en recuperación: {exc}")
        return {"error": f"Error recuperando catálogo: {exc}", "offers_retrieved": []}

    if not offers:
        return {"error": "No se encontraron ofertas aplicables para el cliente."}

    # p_acceptance por oferta: usa el canal recomendado por FASE 5 (recomendar_canal).
    # Se calcula en batch (una sola pasada de predict_proba) para evitar 5 llamadas.
    canal_rec = recomendar_canal(profile)
    canal_uso = canal_rec.get("canal_recomendado", "Digital")
    p_accepted = score_offers_acceptance(profile, offers, canal_uso)
    for offer, p in zip(offers, p_accepted):
        offer["p_acceptance"] = p

    selected, justification = _select_best_offer(offers, profile, scores)
    channel_recommendation = _build_channel_recommendation(profile, scores)
    price_delta = _plan_actual_delta(profile, selected)

    logger.info(f"[catalog_retrieval_node] NBO seleccionado: {selected.get('oferta_id')} ({selected.get('nombre_oferta')})")

    return {
        "offers_retrieved": offers,
        "offer_selected": selected,
        "nbo_selected": selected.get("nombre_oferta", "Oferta Personalizada"),
        "justification": justification,
        "channel_recommendation": channel_recommendation,
        "rebate_prepared": build_rebate_prepared(profile),
        "price_delta": price_delta,
    }


def _build_channel_recommendation(profile: dict, scores: dict) -> dict:
    """
    Recomienda el canal y el momento óptimo para presentar la oferta al
    cliente, en función de su canal más usado y de sus scores de riesgo.
    """
    canal = str(profile.get("canal_mas_usado", "") or "Digital")
    churn = float(scores.get("churn_risk", 0) or 0)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)

    es_urgente = churn > CHURN_HIGH_THRESHOLD

    # Canal sugerido: basado en el canal preferido del cliente
    if canal == "Tienda":
        channel = "Tienda (atención presencial)"
    elif canal in ("Call In", "Call Out"):
        channel = "Call Center (llamada)"
    else:
        channel = "Canal Digital (WhatsApp / app Movistar)"

    # Momento sugerido
    if es_urgente:
        timing = "Hoy, con prioridad (cliente con alto riesgo de fuga)"
    else:
        timing = "En la próxima interacción programada con el cliente"

    # Consejo de abordaje
    advice_parts = []
    if es_urgente:
        advice_parts.append(
            "contactar lo antes posible para evitar la fuga, ofreciendo la oferta como beneficio exclusivo de retención"
        )
    else:
        advice_parts.append(
            "aprovechar la próxima interacción natural para proponer la mejora sin presionar"
        )
    if mt_prop > 0.50:
        advice_parts.append(
            "cliente con alta propensión a Movistar Total, enfatizar el ahorro convergente"
        )
    if profile.get("es_usuario_app"):
        advice_parts.append(
            "el cliente usa la app Movistar, ideal enviarle la oferta por el canal digital con un clic de aceptación"
        )

    return {
        "channel": channel,
        "timing": timing,
        "advice": ", ".join(advice_parts).capitalize() + ".",
        "canal_actual": canal,
    }


def _select_best_offer(offers: list[dict], profile: dict, scores: dict) -> tuple[dict, str]:
    """
    Selecciona la oferta final entre las recuperadas por RAG usando reglas de
    negocio que combinan scores ML + relevancia semántica (score del índice).

    Returns:
        (offer_selected, justification)
    """
    churn = float(scores.get("churn_risk", 0) or 0)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)
    es_mt = profile.get("es_movistar_total", False)
    elegible_mt = profile.get("elegible_mt", False)
    tiene_movil = profile.get("tiene_movil", False)
    tiene_hogar = profile.get("tiene_hogar", False)

    # Consistente con _prefer_mt() en catalog_retriever:
    # elegible_mt es condición necesaria, y la propensidad debe superar 0.65
    prefer_mt = not es_mt and elegible_mt and mt_prop > 0.65

    ranked = sorted(
        offers,
        key=lambda o: (
            1.0 if is_mt_offer(o) and prefer_mt else
            -0.3 if is_mt_offer(o) and not prefer_mt else
            o.get("score", 0.0)
        ),
        reverse=True,
    )

    if prefer_mt:
        candidates = [o for o in ranked if is_mt_offer(o)]
        if not candidates:
            candidates = ranked
    else:
        candidates = ranked

    selected = candidates[0]
    reasons = []

    if es_mt:
        reasons.append("el cliente ya es Movistar Total, se ofrece un upgrade premium")
    if churn > CHURN_HIGH_THRESHOLD:
        reasons.append("riesgo de cancelación alto, la oferta busca retención")
    if elegible_mt and mt_prop > 0.50:
        reasons.append("alta propensión a convergencia Movistar Total")
    if is_mt_offer(selected):
        reasons.append("producto convergente con mayor ahorro y blindaje de permanencia")
    if not tiene_hogar and selected.get("segmento_objetivo") == "hogar":
        reasons.append("cliente sin servicio hogar, oportunidad de cross-selling")
    if not tiene_movil and selected.get("segmento_objetivo") == "movil":
        reasons.append("cliente sin servicio móvil, oportunidad de cross-selling")

    if not reasons:
        reasons.append(f"mayor relevancia semántica para el perfil (similitud {selected.get('score', 0):.2f})")

    justification = "Se recomienda esta oferta porque " + "; ".join(reasons) + "."
    return selected, justification


# ---------------------------------------------------------------------------
# Nodo 3: LLM Pitch Generator
# ---------------------------------------------------------------------------

async def llm_pitch_node(state: AgentState) -> dict:
    """
    Llama al LLM para generar un guion de venta personalizado, anclado a la
    oferta real seleccionada del catálogo (precio, ahorro, GB) y a los datos
    del plan actual del cliente.
    """
    profile = state["customer_profile"]
    scores = state["ml_scores"]
    offer = state.get("offer_selected", {})
    offers = state.get("offers_retrieved", [])
    channel_rec = state.get("channel_recommendation", {})
    pitch_type = state.get("pitch_type", "upselling")
    price_delta = state.get("price_delta", {})

    logger.info(f"[llm_pitch_node] Generando pitch tipo '{pitch_type}' para oferta: {offer.get('oferta_id')}")

    system_prompt = _build_system_prompt(pitch_type)
    user_prompt = _build_user_prompt(profile, scores, offer, offers, channel_rec, pitch_type, price_delta)

    try:
        response = await _llm.ainvoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        )
        pitch = response.content.strip()
    except Exception as exc:
        logger.error(f"[llm_pitch_node] Error llamando al LLM: {exc}")
        return {"error": f"Error generando sales pitch: {exc}", "sales_pitch": ""}

    logger.info(f"[llm_pitch_node] Pitch generado ({len(pitch)} chars)")
    return {"sales_pitch": pitch}


def _build_system_prompt(pitch_type: str) -> str:
    base = (
        "Eres un asesor comercial experto de Movistar Perú. "
        "Tu objetivo es generar guiones de venta hiperpersonalizados, "
        "empáticos y persuasivos en español peruano. "
        "El guion debe ser breve (máximo 4 oraciones), directo y fácil de leer en voz alta. "
        "NO uses markdown, solo texto plano. "
        "Usa SIEMPRE los precios, datos (GB) y ahorros EXACTOS que se te proporcionan; "
        "nunca inventes cifras."
    )
    if pitch_type == "fidelizacion":
        return base + (
            " El cliente tiene ALTO riesgo de cancelar su servicio. "
            "Enfoca el guion en retención: empatía, beneficios exclusivos de quedarse, "
            "y la oferta especial disponible para él/ella hoy."
        )
    return base + (
        " El cliente tiene bajo riesgo de churn y oportunidad de crecimiento. "
        "Enfoca el guion en upselling/cross-selling: resalta el ahorro, "
        "los beneficios adicionales y cómo el nuevo plan mejora su experiencia."
    )


def _plan_actual_delta(profile: dict, offer: dict) -> dict:
    """
    Calcula el delta entre el plan actual del cliente y la oferta seleccionada,
    consultando el catálogo (join por plan_actual_id / oferta_hogar_id).
    """
    from app.ml.catalog_retriever import get_catalog_df

    catalog = get_catalog_df()
    plan_id = str(profile.get("plan_actual_id", "") or "")
    plan_row = catalog[catalog["oferta_id"].astype(str) == plan_id]
    actual_price = None
    actual_gb = None
    if not plan_row.empty:
        actual_price = float(plan_row.iloc[0]["precio_mensual"])
        actual_gb = float(plan_row.iloc[0]["gb_incluidos"])

    offer_price = None
    offer_gb = None
    if offer.get("precio_mensual") not in (None, ""):
        offer_price = float(offer["precio_mensual"])
    if offer.get("gb_incluidos") not in (None, ""):
        offer_gb = float(offer["gb_incluidos"])

    delta = {}
    if actual_price is not None and offer_price is not None:
        delta["diferencia_precio"] = round(offer_price - actual_price, 2)
        delta["precio_actual"] = actual_price
        delta["precio_oferta"] = offer_price
    if actual_gb is not None and offer_gb is not None and offer_gb > 0 and offer_gb < 9999:
        delta["gb_extra"] = int(offer_gb - actual_gb) if offer_gb > actual_gb else None

    return delta


def _build_user_prompt(
    profile: dict,
    scores: dict,
    offer: dict,
    offers: list[dict],
    channel_rec: dict,
    pitch_type: str,
    price_delta: dict | None = None,
) -> str:
    churn_pct = round(scores.get("churn_risk", 0) * 100)
    mt_pct = round(scores.get("mt_propensity", 0) * 100)

    tiene_servicios = []
    if profile.get("tiene_movil"):
        tiene_servicios.append("Móvil")
    if profile.get("tiene_hogar"):
        tiene_servicios.append("Hogar")
    if profile.get("tiene_internet_hogar"):
        tiene_servicios.append("Internet Hogar")
    servicios_str = ", ".join(tiene_servicios) if tiene_servicios else "ninguno registrado"

    mora_info = ""
    if profile.get("meses_moroso", 0) > 0:
        mora_info = (
            f" El cliente ha tenido {profile['meses_moroso']} mes(es) con mora "
            f"(promedio {profile.get('dias_mora_prom', 0):.0f} días de retraso)."
        )

    # Datos reales de la oferta del catálogo
    oferta_desc = (
        f"- Nombre: {offer.get('nombre_oferta', 'N/A')}\n"
        f"- Tipo: {offer.get('tipo_oferta', 'N/A')}\n"
        f"- Precio mensual: S/ {offer.get('precio_mensual', 'N/A')}\n"
        f"- Ahorro: {offer.get('ahorro_pct', 0)}%\n"
        f"- Datos incluidos: {offer.get('gb_incluidos', 0)} GB\n"
    )
    if offer.get("descripcion_bundle"):
        oferta_desc += f"- Bundle: {offer['descripcion_bundle']}\n"
    if offer.get("descripcion_corta"):
        oferta_desc += f"- Detalle: {offer['descripcion_corta']}\n"

    delta = price_delta if price_delta is not None else _plan_actual_delta(profile, offer)
    delta_str = ""
    if delta.get("diferencia_precio") is not None:
        d = delta["diferencia_precio"]
        if d > 0:
            delta_str += f" El cliente pagaría S/ {d:.2f} más al mes que su plan actual (S/ {delta['precio_actual']:.2f})."
        elif d < 0:
            delta_str += f" La oferta cuesta S/ {abs(d):.2f} MENOS que su plan actual (S/ {delta['precio_actual']:.2f}), un ahorro real para el cliente."
        else:
            delta_str += f" La oferta mantiene el mismo precio que su plan actual (S/ {delta['precio_actual']:.2f})."
    if delta.get("gb_extra"):
        delta_str += f" El cliente ganaría {delta['gb_extra']} GB adicionales de datos."

    alternativas = ""
    if len(offers) > 1:
        otros = ", ".join(
            f"{o.get('nombre_oferta')} (S/ {o.get('precio_mensual')})"
            for o in offers[1:4] if o.get("nombre_oferta") != offer.get("nombre_oferta")
        )
        if otros:
            alternativas = f"\nAlternativas consideradas: {otros}."

    canal_info = ""
    if channel_rec:
        canal_info = (
            f"\nCANAL Y MOMENTO RECOMENDADOS PARA PRESENTAR LA OFERTA:\n"
            f"- Canal sugerido: {channel_rec.get('channel', 'N/A')}\n"
            f"- Momento sugerido: {channel_rec.get('timing', 'N/A')}\n"
            f"- Consejo: {channel_rec.get('advice', 'N/A')}\n"
        )

    return f"""
DATOS DEL CLIENTE:
- ID: {profile.get('cliente_id', 'N/A')}
- Antigüedad: {profile.get('antiguedad_meses', 0)} meses con Movistar
- Ubicación: {profile.get('ubicacion', 'N/A')}
- Rango de edad: {profile.get('edad_rango', 'N/A')}
- Servicios actuales: {servicios_str}
- Plan actual: {profile.get('plan_actual_desc', 'N/A')} (ID {profile.get('plan_actual_id', 'N/A')})
- Consumo datos promedio: {profile.get('consumo_datos_gb_prom', 0):.1f} GB/mes
- Consumo voz promedio: {profile.get('consumo_voz_min_prom', 0):.0f} min/mes
- Factura promedio: S/ {profile.get('monto_facturado_prom', 0):.2f}
- Canal preferido: {profile.get('canal_mas_usado', 'N/A')}
- ¿Usa app Movistar?: {'Sí' if profile.get('es_usuario_app') else 'No'}{mora_info}

ANÁLISIS DE INTELIGENCIA ARTIFICIAL:
- Riesgo de cancelación (Churn): {churn_pct}%
- Propensión a Movistar Total: {mt_pct}%
- Probabilidad de aceptación de esta oferta: {offer.get('p_acceptance', 0) * 100:.0f}%
- Tipo de acción: {'RETENCIÓN - cliente en riesgo' if pitch_type == 'fidelizacion' else 'CRECIMIENTO - oportunidad de upselling'}

OFERTA RECOMENDADA (NBO) — DATOS REALES DEL CATÁLOGO:
{oferta_desc}
Diferencia con el plan actual:{delta_str or ' No se pudo calcular el delta (datos incompletos).'}{alternativas}
{canal_info}
INSTRUCCIÓN:
Genera un guion de venta personalizado para el asesor. 
El guion debe iniciar con un saludo que mencione la antigüedad del cliente, 
presentar la oferta de forma atractiva usando los precios/GB/ahorro EXACTOS indicados arriba, 
destacar un beneficio concreto (si aplica, menciona el ahorro o los GB adicionales), 
adaptarse al CANAL Y MOMENTO recomendados indicados arriba,
y terminar con un llamado a la acción claro.
""".strip()
