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
from app.ml.feature_engineering import get_customer_profile, necesita_estrategia_retencion
from app.ml.model_loader import (
    score_customer_full,
    score_offers_acceptance,
    build_rebate_prepared,
)
from app.ml.channel_recommender import recomendar_canal
from app.ml.catalog_retriever import (
    get_all_catalog_offers,
    filter_by_business_rules,
    prefer_mt,
    MT_PROPENSITY_BOOST,
    MT_PROPENSITY_THRESHOLD,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuración del decisor (FASE 7)
# ---------------------------------------------------------------------------
# El ranking del NBO es ML-primary: la predicción p_acceptance (modelo FASE 7)
# decide el orden con precisión completa (sin redondeos que creen empates
# artificiales). El RAG actúa como memoria semántica para el desempate residual
# y para las alternativas que se muestran al asesor, no como compuerta ni como
# criterio principal.
# A clientes en plan de entrada (base) se les prioriza el paso natural de
# mejora (ofertas "upgrade") en lugar de saltos a planes premium.
PLAN_BASE_TIER = "OF001"
STEP_UP_BOOST = 0.05

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
    pitch_type = (
        "fidelizacion"
        if necesita_estrategia_retencion(churn_risk, profile)
        else "upselling"
    )

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
    Selecciona el Next Best Offer con scoring ML global del catálogo.

    Flujo (optimizador, no compuerta RAG):
      1. TODAS las ofertas del catálogo se puntúan con el modelo de aceptación
         p_acceptance (una pasada de predict_proba).
      2. Se aplican las reglas de negocio (asequibilidad, segmento, anti-downgrade,
         elegibilidad MT).
      3. El ranking es ML-primary con precisión completa: p_acceptance + boost MT
         suave + boost step-up. El score semántico del RAG solo desempata en casos
         residuales y nutre las alternativas que se muestran al asesor.
    """
    profile = state["customer_profile"]
    scores = state["ml_scores"]
    logger.info(f"[catalog_retrieval_node] Recuperando ofertas para: {profile.get('cliente_id')}")

    # 1) Catálogo completo (el RAG ya no acota el conjunto a decidir).
    try:
        offers = get_all_catalog_offers()
    except Exception as exc:
        logger.error(f"[catalog_retrieval_node] Error cargando catálogo: {exc}")
        return {"error": f"Error cargando catálogo: {exc}", "offers_retrieved": []}

    if not offers:
        return {"error": "No se encontraron ofertas aplicables para el cliente."}

    # 2) Reglas de negocio primero (asequibilidad 1.5/1.25, segmento, anti-downgrade).
    offers = filter_by_business_rules(offers, profile, scores)

    # 3) p_acceptance en batch sobre las candidatas elegibles.
    canal_rec = recomendar_canal(profile)
    canal_uso = canal_rec.get("canal_recomendado", "Digital")
    try:
        p_accepted = score_offers_acceptance(profile, offers, canal_uso)
    except Exception as exc:
        logger.error(f"[catalog_retrieval_node] Error en p_acceptance: {exc}")
        return {"error": f"Error en p_acceptance: {exc}", "offers_retrieved": []}
    for offer, p in zip(offers, p_accepted):
        offer["p_acceptance"] = p

    if not offers:
        return {"error": "No se encontraron ofertas aplicables para el cliente."}

    # 4) Ranking ML-primary (precisión completa) + desempate semántico residual.
    selected, justification, ranked = _select_best_offer(offers, profile, scores)
    channel_recommendation = _build_channel_recommendation(profile, scores)
    price_delta = _plan_actual_delta(profile, selected)

    # La oferta ganadora lidera la lista devuelta (el resto, ordenado por ML)
    offers = ranked

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
    rec = recomendar_canal(profile)
    canal_rec_nombre = rec.get("canal_recomendado") or str(profile.get("canal_mas_usado", "") or "Digital")
    confianza = rec.get("confianza", "media")
    canal_actual = rec.get("canal_actual") or str(profile.get("canal_mas_usado", "") or "Digital")

    churn = float(scores.get("churn_risk", 0) or 0)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)

    es_urgente = necesita_estrategia_retencion(churn, profile)

    # Canal sugerido según el modelo de canal óptimo
    if canal_rec_nombre == "Tienda":
        channel = "Tienda (atención presencial)"
    elif canal_rec_nombre in ("Call In", "Call Out"):
        channel = f"{canal_rec_nombre} (Call Center)"
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
    if mt_prop > MT_PROPENSITY_THRESHOLD:
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
        "canal_actual": canal_actual,
        "confianza": confianza,
    }



def _final_offer_score(offer: dict, profile: dict, scores: dict) -> float:
    """
    Score decisor del NBO (ML-primary, precisión completa).

    p_acceptance del modelo FASE 7 ordena las ofertas SIN redondear: el round(p, 2)
    anterior creaba empates artificiales de ±1 p.p. que dejaba decidir al RAG.
    Se añade el boost suave de Movistar Total (λ·I_mt, solo clientes elegibles) y
    el refuerzo del paso natural de mejora para clientes en plan de entrada.
    """
    ml = float(offer.get("p_acceptance", 0) or 0)
    ml += _boost_mt_score(offer, profile)
    if (
        str(profile.get("plan_actual_id", "") or "") == PLAN_BASE_TIER
        and str(offer.get("tipo_oferta", "") or "") == "upgrade"
    ):
        ml += STEP_UP_BOOST
    return ml


def _boost_mt_score(offer: dict, profile: dict) -> float:
    """Boost MT suave: MT_PROPENSITY_BOOST si el cliente es elegible MT y la oferta es MT."""
    if not is_mt_offer(offer):
        return 0.0
    if not profile.get("elegible_mt", False):
        return 0.0
    return float(MT_PROPENSITY_BOOST)


def _select_best_offer(offers: list[dict], profile: dict, scores: dict) -> tuple[dict, str, list[dict]]:
    """
    Selecciona la oferta final entre las candidatas del catálogo puntuadas por ML.

    Ranking ML-primary honesto: ordena por `_final_offer_score` (p_acceptance en
    precisión completa + prior MT + step-up). El score semántico del RAG solo
    desempata en el caso residual de empate de precisión completa.

    Returns:
        (offer_selected, justification, ranked_offers)
    """
    churn = float(scores.get("churn_risk", 0) or 0)
    mt_prop = float(scores.get("mt_propensity", 0) or 0)
    es_mt = profile.get("es_movistar_total", False)
    elegible_mt = profile.get("elegible_mt", False)
    tiene_movil = profile.get("tiene_movil", False)
    tiene_hogar = profile.get("tiene_hogar", False)

    prefer = prefer_mt(profile, scores)

    ranked = sorted(
        offers,
        key=lambda o: (
            _final_offer_score(o, profile, scores),
            float(o.get("score", 0) or 0),  # desempate residual: relevancia semántica
        ),
        reverse=True,
    )

    selected = ranked[0]
    reasons = []

    if es_mt:
        reasons.append("el cliente ya es Movistar Total, se ofrece un upgrade premium")
    if necesita_estrategia_retencion(churn, profile):
        reasons.append("riesgo de cancelación alto, la oferta busca retención")
    if elegible_mt and mt_prop > MT_PROPENSITY_THRESHOLD and prefer:
        reasons.append("alta propensión a convergencia Movistar Total según el modelo")
    if is_mt_offer(selected):
        reasons.append("producto convergente con mayor ahorro y blindaje de permanencia")
    if selected.get("tipo_oferta") == "upgrade":
        reasons.append("es el paso natural de mejora sobre su plan actual sin saltar a un plan premium")
    if selected.get("p_acceptance") is not None:
        reasons.append(f"mayor probabilidad de aceptación según el modelo ({(selected.get('p_acceptance') or 0) * 100:.1f}%)")

    # Señales de negocio del perfil (explicabilidad tipo FASE 8)
    brecha = profile.get("brecha_datos")
    if (
        profile.get("brecha_datos_aplica")
        and isinstance(brecha, (int, float))
        and brecha > 0
    ):
        reasons.append(
            f"el cliente consume {brecha:.0f} GB más de lo que cubre su plan actual, la oferta cierra esa brecha"
        )
    ahorro_mt = profile.get("ahorro_potencial_mt")
    if (
        profile.get("ahorro_potencial_mt_aplica")
        and isinstance(ahorro_mt, (int, float))
        and ahorro_mt > 0
    ):
        reasons.append(f"la convergencia le generaría un ahorro estimado de S/ {ahorro_mt:.0f} al mes")

    # Señales de mora (FASE 8: explicar_recomendacion) usando el nivel del
    # contrato (terciles de constantes_produccion.json)
    nivel_mora = profile.get("riesgo_mora_nivel")
    if nivel_mora == "bajo":
        reasons.append("historial de pago estable (riesgo de mora bajo), buen momento para un upgrade")
    elif nivel_mora == "alto":
        reasons.append("riesgo de mora alto, se prioriza una oferta conservadora en precio")

    # Relación consolidada (FASE 8: antigüedad >= 60 meses)
    antiguedad = profile.get("antiguedad_meses", 0) or 0
    if antiguedad >= 60:
        reasons.append(f"cliente de {int(antiguedad)} meses de antigüedad, relación consolidada")

    if not tiene_hogar and selected.get("segmento_objetivo") == "hogar":
        reasons.append("cliente sin servicio hogar, oportunidad de cross-selling")
    if not tiene_movil and selected.get("segmento_objetivo") == "movil":
        reasons.append("cliente sin servicio móvil, oportunidad de cross-selling")

    if not reasons:
        reasons.append(f"mayor probabilidad de aceptación según el modelo ({(selected.get('p_acceptance') or 0) * 100:.1f}%)")

    justification = "Se recomienda esta oferta porque " + "; ".join(reasons) + "."
    return selected, justification, ranked


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

    # Resiliencia del LLM: el NBO ya está decidido y rankeado por el ML; el
    # pitch es un refuerzo del asesor. Si el LLM falla (timeout, auth, quota),
    # se degrada la respuesta (sales_pitch="") SIN marcar error en el estado,
    # para no convertir una caída del LLM en un 500/422 de toda la recomendación.
    if not settings.OPENAI_API_KEY:
        logger.warning("[llm_pitch_node] OPENAI_API_KEY no configurada; omitiendo generación de pitch.")
        return {"sales_pitch": ""}

    system_prompt = _build_system_prompt(pitch_type)
    user_prompt = _build_user_prompt(profile, scores, offer, offers, channel_rec, pitch_type, price_delta)

    try:
        response = await _llm.ainvoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
        )
        pitch = response.content.strip()
    except Exception as exc:
        logger.warning(f"[llm_pitch_node] LLM no disponible, se degrada el pitch: {exc}")
        return {"sales_pitch": ""}

    logger.info(f"[llm_pitch_node] Pitch generado ({len(pitch)} chars)")
    return {"sales_pitch": pitch}


def _build_system_prompt(pitch_type: str) -> str:
    base = (
        "Eres un asesor comercial SENIOR de Movistar Perú con más de 10 años de "
        "experiencia en venta consultiva y retención de clientes de telecomunicaciones. "
        "Hablas en español peruano, con frases cortas, naturales y fáciles de leer en voz alta; "
        "tratas al cliente con cercanía y respeto, y vendes el VALOR de la oferta, no el precio.\n"
        "\n"
        "REGLAS INVIOLABLES:\n"
        "1. Nunca reveles información interna: no menciones scores, probabilidades, el modelo, "
        "'el sistema', 'la IA' ni términos como 'churn', 'riesgo de cancelación' o 'fuga'.\n"
        "2. Nunca menciones la mora o deudas del cliente de forma directa; no lo hagas sentir "
        "culpable ni lo presiones por su historial de pago.\n"
        "3. Usa SIEMPRE los precios, GB y ahorros EXACTOS del catálogo. Si un dato no se te "
        "entrega, no lo inventes.\n"
        "4. No te refieras a esto como 'guion', 'script' ni 'oferta del sistema'; debe sonar a "
        "conversación real de venta.\n"
        "5. Salida en texto plano, sin markdown ni emojis, de máximo 5 oraciones breves.\n"
        "6. Adáptate al CANAL y al MOMENTO indicados: en WhatsApp o SMS usa un tono escrito y "
        "muy breve; en llamada, tono de voz cálido y natural. Si el momento es 'hoy' u 'urgente', "
        "genera urgencia legítima (por ejemplo un beneficio por tiempo limitado), pero nunca "
        "inventes plazos que no vengan en los datos.\n"
        "7. Personaliza con lo que sabes del cliente: antigüedad, ciudad, plan y consumo actuales. "
        "Cierra con un único llamado a la acción claro y de baja presión.\n"
        "\n"
        "FÓRMULA DE VENTA SENIOR:\n"
        "a) Apertura empática que reconozca al cliente (su lealtad y antigüedad, o la necesidad "
        "concreta que muestra su consumo).\n"
        "b) Un gancho de valor con cifra exacta: el ahorro real en soles o los GB adicionales.\n"
        "c) Un beneficio secundario que reafirme la decisión (servicios que ya disfruta, "
        "exclusividad, mejor experiencia).\n"
        "d) Un llamado a la acción natural y claro."
    )
    if pitch_type == "fidelizacion":
        return base + (
            "\n\nCONTEXTO DE LA GESTIÓN — RETENCIÓN:\n"
            "El cliente tiene alto riesgo de cancelar y hoy la prioridad es retenerlo.\n"
            "- Reconoce primero su lealtad y antigüedad con Movistar; hazlo sentir valorado y escuchado.\n"
            "- Presenta la oferta como un beneficio EXCLUSIVO disponible para él/ella hoy, diseñado "
            "para cuidar su relación con nosotros.\n"
            "- Enfatiza lo que gana al quedarse (ahorro real o más beneficios) y la tranquilidad de "
            "conservar su número, su plan y sus servicios.\n"
            "- Tono cálido, pausado y seguro; evita cualquier presión comercial."
        )
    return base + (
        "\n\nCONTEXTO DE LA GESTIÓN — CRECIMIENTO (UPSELLING/CROSS-SELLING):\n"
        "El cliente tiene una relación sólida con nosotros y hay una oportunidad real de mejorar "
        "su experiencia.\n"
        "- Conéctalo con su vida real: menciona su consumo de datos o voz y cómo la nueva oferta "
        "lo supera o lo beneficia.\n"
        "- Presenta la mejora como el 'siguiente nivel' natural de lo que ya disfruta, siempre con "
        "el ahorro o los GB extra en cifras exactas.\n"
        "- Si la oferta cuesta menos que su plan actual, destácalo como ahorro real; si cuesta lo "
        "mismo o más, justifica el valor (más datos, mejores beneficios) sin ocultar el precio.\n"
        "- Entusiasmo profesional y confianza: vendes una mejora de experiencia, no un plan más caro."
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
- ¿Usa app Movistar?: {'Sí' if profile.get('es_usuario_app') else 'No'}
- ¿Es cliente Movistar Total?: {'Sí' if profile.get('es_movistar_total') else 'No'}
- Reclamos recientes: {profile.get('n_reclamos', 0)}{mora_info}

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
