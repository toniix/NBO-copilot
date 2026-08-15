"""
supervisor.py
-------------
Métricas agregadas para el panel de gerencia. Combina los outcomes reales
registrados (trazabilidad) con una línea base de equipo de demostración para
los campos que aún no se capturan por gestión (asesor, adopción MT).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from fastapi import APIRouter
from app.ml.outcome_store import outcome_summary
from app.ml.production_contract import get_umbral_decision

logger = logging.getLogger(__name__)

router = APIRouter()

# Línea base demo del equipo (no hay identidad de asesor en el registro aún)
TEAM_BASELINE = [
    {"advisor": "Ana Lucía P.", "interactions": 287, "offers": 203, "mt_acceptance_pct": 34.5, "copilot_score": 91},
    {"advisor": "José Miguel R.", "interactions": 251, "offers": 189, "mt_acceptance_pct": 31.2, "copilot_score": 87},
    {"advisor": "Carmen V.", "interactions": 234, "offers": 178, "mt_acceptance_pct": 28.8, "copilot_score": 83},
    {"advisor": "Luis Alberto F.", "interactions": 198, "offers": 141, "mt_acceptance_pct": 24.1, "copilot_score": 79},
    {"advisor": "Rosa María T.", "interactions": 176, "offers": 134, "mt_acceptance_pct": 21.6, "copilot_score": 74},
]


def _load_fase8_kpis() -> dict:
    """Carga supervisor_kpis.json de FASE 8 si existe."""
    paths = [
        Path("../ModelosML/FASE 8/supervisor_kpis.json"),
        Path("app/ml/models/supervisor_kpis.json"),
        Path("../ModelosML/supervisor_kpis.json"),
    ]
    for p in paths:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    # Forzar umbral de decisión oficial del contrato (0.3508312)
                    if "metricas_modelo" in data:
                        data["metricas_modelo"]["umbral_decision"] = round(get_umbral_decision(), 4)
                    return data
            except Exception as exc:
                logger.warning(f"Error leyendo {p}: {exc}")

    # Fallback si el archivo no está accesible
    return {
        "funnel": {
            "total_ofrecimientos_historicos": 254618,
            "contactados": 254618,
            "no_contactados_pendientes": 0,
            "tasa_contactabilidad": 1.0,
            "aceptadas": 95414,
            "rechazadas": 159204,
            "tasa_aceptacion_global": 0.3747,
        },
        "tasa_por_tipo_oferta": {
            "equipo": 0.3425,
            "movistar_total": 0.697,
            "paquete_adicional": 0.3377,
            "plan_hogar": 0.3397,
            "plan_movil": 0.3426,
            "upgrade": 0.3425,
        },
        "tasa_por_canal": {
            "Call In": 0.373,
            "Call Out": 0.3744,
            "Digital": 0.3745,
            "Tienda": 0.3763,
        },
        "metricas_modelo": {
            "modelo": "XGBoost",
            "umbral_decision": round(get_umbral_decision(), 4),
            "auc_test": 0.585,
            "auc_cv_5fold_promedio": 0.584,
            "auc_cv_5fold_std": 0.0014,
            "f1_score": 0.547,
            "recall": 0.978,
            "nota": "Validado con 5-fold CV en Fase 7 -- fuente de verdad constante produccion",
        },
        "distribucion_riesgo_churn": {
            "riesgo_medio_bajo": 0.5777,
            "riesgo_alto": 0.2185,
            "riesgo_medio_alto": 0.1365,
            "riesgo_bajo": 0.0673,
        },
        "arpu_proxy_por_riesgo_churn": {
            "riesgo_alto": 110.63,
            "riesgo_bajo": 109.84,
            "riesgo_medio_alto": 69.82,
            "riesgo_medio_bajo": 69.41,
        },
        "oportunidad_mt": {
            "clientes_elegibles_sin_mt": 13650,
            "total_clientes": 100000,
        },
    }


@router.get(
    "/supervisor/metrics",
    summary="Métricas agregadas de supervisión",
    description=(
        "KPI del panel de gerencia construidos desde los outcomes reales "
        "registrados en el sistema de trazabilidad y enriquecidos con la "
        "información oficial de FASE 8."
    ),
)
async def get_supervisor_metrics():
    summary = outcome_summary()
    fase8_kpis = _load_fase8_kpis()

    total = summary["total_gestiones"]
    accepted = summary["aceptadas"]
    rejected_price = summary["rechazadas_precio"]
    rejected_no_interest = summary["rechazadas_sin_interes"]
    rejections = rejected_price + rejected_no_interest

    # Distribución de objeciones desde datos reales (con fallback si no hay gestiones aún)
    rejection_reasons = []
    if rejections > 0:
        reasons = [
            ("Precio percibido alto", rejected_price),
            ("Sin interés en el producto", rejected_no_interest),
        ]
        rejection_reasons = [
            {"reason": name, "count": count, "pct": round(count / rejections * 100)}
            for name, count in reasons
            if count > 0
        ]

    return {
        "kpis": {
            "mt_adoption_pct": 42.3,          # línea base demo
            "mt_adoption_goal": 50,
            "churn_prevented": 142,           # línea base demo
            "churn_prevented_delta": 18,
            "conversion_rate": round(summary["conversion_rate"] * 100, 1),
            "conversion_delta": 0,
            "total_interactions": total,
            "interactions_today": total,
        },
        "rejection_reasons": rejection_reasons,
        "team_performance": TEAM_BASELINE,
        "fase8_kpis": fase8_kpis,
        "data_basis": "real" if total > 0 else "demo",
    }

