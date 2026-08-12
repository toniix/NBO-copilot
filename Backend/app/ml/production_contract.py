"""
production_contract.py
----------------------
Fuente única de verdad para las constantes y categorías de producción que
el equipo de Estadística exporta en FASE 8:

  - constantes_produccion.json
      * riesgo_mora_score -> corte_33 / corte_66  (terciles de mora usados por
        el recomendador de canal y los niveles de riesgo)
      * outliers_percentil_995 -> umbrales de outlier de facturación/consumo
      * oferta_hogar_base_id  -> plan hogar base para ahorro_potencial_mt
      * umbral_decision_modelo -> corte p_acceptance >= X => "acepta" (decisión)

  - categorias_produccion.json -> valores exactos de cada variable categórica
    del OneHotEncoder. El encoder ignora valores fuera de esta lista
    (handle_unknown='ignore'): la fila no crashea, pero pierde señal en
    silencio. verify_models.py valida que coincidan.

Si el JSON existe, el backend usa SUS valores; si falta, se degrada a los
valores por defecto (que replican el código previo) con un warning.
verify_models.py reporta la ausencia como error.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Defaults (fallback si falta el JSON) — replican los valores hardcodeados previos
# ---------------------------------------------------------------------------
DEFAULT_RISGO_MORA_CORTES: dict[str, float] = {
    "corte_33": 33.33333333333333,
    "corte_66": 42.5,
}
DEFAULT_OUTLIERS_PCTL995: dict[str, float | None] = {
    "monto_facturado_prom": 245.6,
    "consumo_datos_gb_prom": 74.6,
}
DEFAULT_OFERTA_HOGAR_BASE_ID = "OF005"
DEFAULT_UMBRAL_DECISION = 0.3507315

# Cache en memoria (singleton)
_constantes: dict | None = None
_categorias: dict | None = None


# ---------------------------------------------------------------------------
# Carga
# ---------------------------------------------------------------------------
def _read_json(path: Path) -> dict:
    if not path.exists():
        logger.warning(f"⚠ Archivo de contrato no encontrado: {path}")
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def load_contract() -> None:
    """Carga (y cachea) los JSON de producción. Llamar desde el lifespan."""
    global _constantes, _categorias
    _constantes = _read_json(settings.constantes_path_full)
    _categorias = _read_json(settings.categorias_path_full)
    if not _constantes or not _categorias:
        logger.warning(
            "Contrato de producción incompleto — se usarán valores por defecto. "
            "Se espera constantes_produccion.json y categorias_produccion.json en: "
            f"{settings.churn_model_path_full.parent}"
        )
    else:
        logger.info(
            "✅ Contrato de producción cargado: "
            f"{settings.constantes_path_full.name} + {settings.categorias_path_full.name}."
        )


# ---------------------------------------------------------------------------
# Accesores
# ---------------------------------------------------------------------------
def _constantes_() -> dict:
    global _constantes
    if _constantes is None:
        load_contract()
    return _constantes or {}


def get_riesgo_mora_cortes() -> dict[str, float]:
    """Terciles de riesgo_mora_score (FASE 4): corte_33 y corte_66."""
    data = _constantes_().get("riesgo_mora_score", {}) or {}
    return {
        "corte_33": float(data.get("corte_33", DEFAULT_RISGO_MORA_CORTES["corte_33"])),
        "corte_66": float(data.get("corte_66", DEFAULT_RISGO_MORA_CORTES["corte_66"])),
    }


def get_outliers_pctl995() -> dict[str, float | None]:
    """
    Percentil 99.5 del training set para marcar outliers de facturación y consumo.
    Si el JSON trae null (consumo), se usa el default del pipeline previo.
    """
    data = _constantes_().get("outliers_percentil_995", {}) or {}
    monto = data.get("monto_facturado_prom")
    consumo = data.get("consumo_datos_gb_prom")
    return {
        "monto_facturado_prom": (
            float(monto) if monto is not None else DEFAULT_OUTLIERS_PCTL995["monto_facturado_prom"]
        ),
        "consumo_datos_gb_prom": (
            float(consumo) if consumo is not None else DEFAULT_OUTLIERS_PCTL995["consumo_datos_gb_prom"]
        ),
    }


def get_oferta_hogar_base_id() -> str:
    """Plan hogar base usado para calcular ahorro_potencial_mt (FASE 2)."""
    base = _constantes_().get("oferta_hogar_base_id")
    return str(base) if base else DEFAULT_OFERTA_HOGAR_BASE_ID


def get_umbral_decision() -> float:
    """
    Corte de decisión p_acceptance >= X => "acepta" (FASE 7 / constantes_produccion.json).
    Se expone en la API como metadata y se valida en verify_models.py; no modifica
    la lógica de selección del NBO.
    """
    umbral = _constantes_().get("umbral_decision_modelo")
    try:
        return float(umbral) if umbral is not None else DEFAULT_UMBRAL_DECISION
    except (TypeError, ValueError):
        return DEFAULT_UMBRAL_DECISION


def get_categorias() -> dict[str, list[str]]:
    """Categorías exactas de cada variable categórica del OneHotEncoder."""
    global _categorias
    if _categorias is None:
        load_contract()
    return _categorias or {}


def contract_sources() -> dict:
    """Estado de carga para scripts de verificación/diagnóstico."""
    return {
        "constantes_path": str(settings.constantes_path_full),
        "categorias_path": str(settings.categorias_path_full),
        "constantes_cargado": settings.constantes_path_full.exists(),
        "categorias_cargado": settings.categorias_path_full.exists(),
        "usando_defaults": _constantes is None or not _constantes,
    }