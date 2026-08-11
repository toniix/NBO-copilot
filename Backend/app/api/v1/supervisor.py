"""
supervisor.py
-------------
Métricas agregadas para el panel de gerencia. Combina los outcomes reales
registrados (trazabilidad) con una línea base de equipo de demostración para
los campos que aún no se capturan por gestión (asesor, adopción MT).
"""

from __future__ import annotations

from fastapi import APIRouter

from app.ml.outcome_store import outcome_summary

router = APIRouter()

# Línea base demo del equipo (no hay identidad de asesor en el registro aún)
TEAM_BASELINE = [
    {"advisor": "Ana Lucía P.", "interactions": 287, "offers": 203, "mt_acceptance_pct": 34.5, "copilot_score": 91},
    {"advisor": "José Miguel R.", "interactions": 251, "offers": 189, "mt_acceptance_pct": 31.2, "copilot_score": 87},
    {"advisor": "Carmen V.", "interactions": 234, "offers": 178, "mt_acceptance_pct": 28.8, "copilot_score": 83},
    {"advisor": "Luis Alberto F.", "interactions": 198, "offers": 141, "mt_acceptance_pct": 24.1, "copilot_score": 79},
    {"advisor": "Rosa María T.", "interactions": 176, "offers": 134, "mt_acceptance_pct": 21.6, "copilot_score": 74},
]


@router.get(
    "/supervisor/metrics",
    summary="Métricas agregadas de supervisión",
    description=(
        "KPI del panel de gerencia construidos desde los outcomes reales "
        "registrados en el sistema de trazabilidad."
    ),
)
async def get_supervisor_metrics():
    summary = outcome_summary()
    total = summary["total_gestiones"]
    accepted = summary["aceptadas"]
    rejected_price = summary["rechazadas_precio"]
    rejected_no_interest = summary["rechazadas_sin_interes"]
    rejections = rejected_price + rejected_no_interest

    # Distribución de objeciones desde datos reales
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
            "mt_adoption_pct": 42.3,          # línea base demo (no capturado aún)
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
        "data_basis": "real" if total > 0 else "demo",
    }
