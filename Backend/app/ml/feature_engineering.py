"""
feature_engineering.py
-----------------------
Carga el dataset CSV y extrae el perfil del cliente dado un cliente_id / DNI.
Utiliza DuckDB para queries rápidas sobre el CSV sin cargarlo completo en memoria.
"""

from __future__ import annotations

import logging
import duckdb
import pandas as pd
from pathlib import Path
from app.core.config import settings

logger = logging.getLogger(__name__)

# Singleton para el dataset de clientes precargado en memoria
_customers_df: pd.DataFrame | None = None


# ---------------------------------------------------------------------------
# Mapas de referencia: IDs de plan → descripción legible
# (Fallback si el catálogo no está cargado; el catálogo es la fuente de verdad)
# ---------------------------------------------------------------------------
PLAN_DESCRIPTIONS: dict[str, str] = {
    "OF001": "Móvil Básico 10GB",
    "OF002": "Móvil Plus 25GB",
    "OF003": "Móvil Max 50GB",
    "OF004": "Móvil Ilimitado",
    "OF005": "Internet Hogar 100Mb",
    "OF006": "Internet Hogar 200Mb",
    "OF007": "TV Hogar Sola",
    "OF008": "Internet + TV Hogar",
    "OF009": "Internet + Fijo Hogar",
    "OF010": "Internet + TV + Fijo Hogar",
    "OF011": "Upgrade a Plan Plus",
    "OF012": "Upgrade a Plan Max",
    "OF013": "Upgrade Velocidad Hogar",
    "OF014": "Equipo Smartphone Gama Media",
    "OF015": "Equipo Smartphone Gama Alta",
    "OF016": "Router WiFi 6",
    "OF017": "Paquete Streaming Video",
    "OF018": "Paquete Seguridad Digital",
    "OF019": "Paquete Roaming Internacional",
    "OF020": "Movistar Total Basico",
    "OF021": "Movistar Total Plus",
    "OF022": "Movistar Total Max",
}

CHURN_HIGH_THRESHOLD = 0.60  # Por encima → lógica de fidelización

# Umbrales de outlier (percentil 99.5 del training set — datos idénticos a clientes.csv)
MONTO_OUTLIER_THRESHOLD = 245.6
CONSUMO_OUTLIER_THRESHOLD = 74.6

# Categoría para clientes sin línea móvil (imputación del notebook FASE 1)
TIPO_CLIENTE_SIN_LINEA = "sin_linea_movil"
CANAL_SIN_INTERACCION = "sin_interaccion"

# Precio de referencia del plan hogar base para ahorro_potencial_mt (OF005)
HOGAR_BASE_OFFER_ID = "OF005"


def _precio_equivalente(planes: list[dict], consumo_gb: float) -> float:
    """Primer precio del catálogo (ordenado por precio) que cubre el consumo."""
    for row in planes:
        if row["gb_incluidos"] >= consumo_gb:
            return row["precio_mensual"]
    return planes[-1]["precio_mensual"] if planes else 0.0


def _planes_tipo(tipo: str) -> list[dict]:
    """Planes del catálogo de un tipo, ordenados por precio (para equivalencia)."""
    from app.ml.catalog_retriever import get_catalog_df
    catalog = get_catalog_df()
    rows = catalog[catalog["tipo_oferta"].astype(str) == tipo].copy()
    rows["_precio"] = pd.to_numeric(rows["precio_mensual"], errors="coerce").fillna(0)
    rows["_gb"] = pd.to_numeric(rows["gb_incluidos"], errors="coerce").fillna(0)
    rows["_gb"] = rows["_gb"].replace(9999, float("inf"))
    rows = rows.sort_values("_precio")
    return [{"gb_incluidos": r["_gb"], "precio_mensual": r["_precio"]} for _, r in rows.iterrows()]


def _precio_hogar_base() -> float:
    from app.ml.catalog_retriever import get_catalog_df
    catalog = get_catalog_df()
    row = catalog[catalog["oferta_id"].astype(str) == HOGAR_BASE_OFFER_ID]
    if not row.empty:
        return float(pd.to_numeric(row.iloc[0]["precio_mensual"], errors="coerce") or 0)
    return 0.0


def _costo_ahorro_mt(consumo_gb: float, es_mt: bool, elegible_mt: bool) -> tuple[float | None, int]:
    """
    Calcula ahorro_potencial_mt y su flag _aplica replicando FASE 2:
      costo_separado = precio_movil_equivalente(consumo) + precio_hogar_base
      ahorro_potencial_mt = costo_separado - precio_mt_equivalente(consumo)
    Solo aplica si elegible_mt y NO es Movistar Total; si no, NaN / _aplica=0.
    """
    if not elegible_mt or es_mt:
        return None, 0
    planes_movil = _planes_tipo("plan_movil")
    mt_variantes = _planes_tipo("movistar_total")
    if not planes_movil or not mt_variantes:
        return None, 0
    costo_separado = _precio_equivalente(planes_movil, consumo_gb) + _precio_hogar_base()
    precio_mt = _precio_equivalente(mt_variantes, consumo_gb)
    return round(costo_separado - precio_mt, 4), 1


def load_customers() -> None:
    """Carga el dataset CSV en memoria. Llamar desde lifespan."""
    global _customers_df
    csv_path = settings.data_path_full
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset de clientes no encontrado en: {csv_path}")
    
    conn = duckdb.connect()
    _customers_df = conn.execute(
        f"SELECT * FROM read_csv_auto('{str(csv_path)}', header=True, nullstr='')"
    ).fetchdf()
    conn.close()
    logger.info(f"✅ Dataset de clientes cargado en memoria: {len(_customers_df)} registros.")


def get_customer_profile(cliente_id: str) -> dict | None:
    """
    Busca al cliente en el dataset precargado y devuelve su perfil con features derivadas.
    Retorna None si no existe.
    """
    global _customers_df
    if _customers_df is None:
        load_customers()

    df_cliente = _customers_df[_customers_df["cliente_id"] == cliente_id]
    if df_cliente.empty:
        return None

    row = df_cliente.iloc[0].to_dict()

    # --- Variables derivadas (Feature Engineering) ---
    antiguedad_meses = float(row.get("antiguedad_meses", 0) or 0)
    consumo_datos = float(row.get("consumo_datos_gb_prom", 0) or 0)
    consumo_voz = float(row.get("consumo_voz_min_prom", 0) or 0)
    dias_mora = float(row.get("dias_mora_prom", 0) or 0)
    meses_moroso = int(row.get("meses_moroso", 0) or 0)
    monto_factura = float(row.get("monto_facturado_prom", 0) or 0)
    n_reclamos = int(row.get("n_reclamos", 0) or 0)
    n_actividad = int(row.get("n_actividad_canal", 0) or 0)
    uso_app = float(row.get("uso_app_movistar_prom", 0) or 0)

    # ratio_uso_datos: qué tan intensivo es el uso de datos (normalizado sobre consumo típico ~50GB)
    ratio_uso_datos = round(min(consumo_datos / 50.0, 1.0), 4)

    # historial_mora: combinación de frecuencia y magnitud de mora
    historial_mora = round(
        (meses_moroso * 0.5 + min(dias_mora / 30.0, 1.0) * 0.5), 4
    )

    plan_actual_id = str(row.get("plan_actual_id", "") or "")
    oferta_hogar_id = str(row.get("oferta_hogar_id", "") or "")

    plan_desc = _resolve_plan_description(plan_actual_id)

    # --- Imputaciones del notebook FASE 1 (necesarias para el OneHotEncoder) ---
    tipo_cliente_raw = str(row.get("tipo_cliente", "") or "").strip()
    canal_mas_usado_raw = str(row.get("canal_mas_usado", "") or "").strip()
    tipo_cliente = tipo_cliente_raw or TIPO_CLIENTE_SIN_LINEA
    canal_mas_usado = canal_mas_usado_raw or CANAL_SIN_INTERACCION

    # --- Features derivadas (FASE 2 / FASE 3) ---
    riesgo_mora_score = dias_mora + meses_moroso * 30.0
    diferencia_gasto = monto_factura - float(row.get("monto_facturado_prom_6m", 0) or 0)

    # gb_plan_actual desde el catálogo (por plan_actual_id)
    gb_plan_actual = _plan_gb(plan_actual_id)

    tiene_movil = _parse_bool(row.get("tiene_movil"))
    es_mt = _parse_bool(row.get("es_movistar_total"))
    elegible_mt = _parse_bool(row.get("elegible_mt"))

    # brecha_datos: NaN si sin línea móvil; 0 si plan ilimitado (>= 9999)
    if not tiene_movil:
        brecha_datos = None
    elif gb_plan_actual is not None and gb_plan_actual >= 9999:
        brecha_datos = 0.0
    elif gb_plan_actual is not None:
        brecha_datos = consumo_datos - gb_plan_actual
    else:
        brecha_datos = None
    brecha_datos_aplica = int(brecha_datos is not None)
    brecha_datos_val = round(brecha_datos, 4) if brecha_datos is not None else 0.0

    # ahorro_potencial_mt: solo elegibles sin MT
    ahorro_mt, ahorro_mt_aplica = _costo_ahorro_mt(consumo_datos, es_mt, elegible_mt)

    # Outlier flags (percentil 99.5 del training set)
    monto_outlier = monto_factura > MONTO_OUTLIER_THRESHOLD
    consumo_outlier = consumo_datos > CONSUMO_OUTLIER_THRESHOLD

    # --- Categorías interpretables para el dashboard (pedido de Sistemas, FASE 8) ---
    n_reclamos_categoria = "3+" if n_reclamos >= 3 else str(n_reclamos)

    bins_antiguedad = list(range(0, 186, 6))
    etiquetas_antiguedad = [f"{i}-{i+6}m" for i in bins_antiguedad[:-1]]
    antiguedad_categoria = pd.cut(
        [antiguedad_meses], bins=bins_antiguedad, labels=etiquetas_antiguedad, right=True
    )[0]
    antiguedad_categoria = str(antiguedad_categoria) if pd.notna(antiguedad_categoria) else "60m+"

    antiguedad_categoria_simple = pd.cut(
        [antiguedad_meses],
        bins=[0, 6, 24, 60, 181],
        labels=["Nuevo (0-6m)", "Reciente (6-24m)", "Establecido (24-60m)", "Fiel (60m+)"],
        right=True,
    )[0]
    antiguedad_categoria_simple = (
        str(antiguedad_categoria_simple) if pd.notna(antiguedad_categoria_simple) else "Establecido (24-60m)"
    )

    profile = {
        # Identidad
        "cliente_id": str(row.get("cliente_id", "")),
        "tipo_cliente": tipo_cliente,
        "edad_rango": str(row.get("edad_rango", "").strip() or "18-25"),
        "ubicacion": str(row.get("ubicacion_departamento", "") or ""),
        "ubicacion_departamento": str(row.get("ubicacion_departamento", "") or ""),
        # Servicios actuales
        "tiene_movil": tiene_movil,
        "tiene_hogar": _parse_bool(row.get("tiene_hogar")),
        "tiene_internet_hogar": _parse_bool(row.get("tiene_internet_hogar")),
        "es_movistar_total": es_mt,
        "elegible_mt": elegible_mt,
        "plan_actual_id": plan_actual_id,
        "plan_actual_desc": plan_desc,
        "oferta_hogar_id": oferta_hogar_id,
        "es_usuario_app": _parse_bool(row.get("es_usuario_app")),
        "canal_mas_usado": canal_mas_usado,
        # Consumo
        "consumo_datos_gb_prom": round(consumo_datos, 2),
        "consumo_voz_min_prom": round(consumo_voz, 2),
        "consumo_sms_prom": round(float(row.get("consumo_sms_prom", 0) or 0), 2),
        "uso_app_prom": round(uso_app, 2),
        "uso_app_movistar_prom": round(uso_app, 2),
        # Facturación
        "monto_facturado_prom": round(monto_factura, 2),
        "monto_facturado_prom_6m": round(
            float(row.get("monto_facturado_prom_6m", 0) or 0), 2
        ),
        # Comportamiento de riesgo
        "dias_mora_prom": round(dias_mora, 2),
        "meses_moroso": meses_moroso,
        "n_reclamos": n_reclamos,
        "n_actividad_canal": n_actividad,
        # Features derivadas (modelo de aceptación — pipeline de Estadística)
        "antiguedad_meses": int(antiguedad_meses),
        "ratio_uso_datos": ratio_uso_datos,
        "historial_mora": historial_mora,
        "riesgo_mora_score": round(riesgo_mora_score, 4),
        "diferencia_gasto": round(diferencia_gasto, 4),
        "gb_plan_actual": gb_plan_actual,
        "brecha_datos": brecha_datos_val,
        "brecha_datos_aplica": brecha_datos_aplica,
        "ahorro_potencial_mt": ahorro_mt if ahorro_mt is not None else 0.0,
        "ahorro_potencial_mt_aplica": ahorro_mt_aplica,
        "monto_facturado_prom_outlier": monto_outlier,
        "consumo_datos_gb_prom_outlier": consumo_outlier,
        # Categorías interpretables (FASE 8 — pedido de Sistemas)
        "n_reclamos_categoria": n_reclamos_categoria,
        "antiguedad_categoria": antiguedad_categoria,
        "antiguedad_categoria_simple": antiguedad_categoria_simple,
    }

    return profile


def _plan_gb(plan_id: str) -> float | None:
    """GB del plan actual desde el catálogo (gb_incluidos), o None si no existe."""
    try:
        from app.ml.catalog_retriever import get_catalog_df
        catalog = get_catalog_df()
        row = catalog[catalog["oferta_id"].astype(str) == str(plan_id)]
        if row.empty:
            return None
        value = pd.to_numeric(row.iloc[0]["gb_incluidos"], errors="coerce")
        return float(value) if pd.notna(value) else None
    except Exception:
        return None


def _resolve_plan_description(plan_id: str) -> str:
    """
    Resuelve la descripción del plan usando el catálogo (fuente de verdad)
    con fallback al mapa estático PLAN_DESCRIPTIONS si el catálogo no está cargado.
    """
    try:
        from app.ml.catalog_retriever import get_catalog_df
        catalog = get_catalog_df()
        row = catalog[catalog["oferta_id"].astype(str) == plan_id]
        if not row.empty and str(row.iloc[0]["nombre_oferta"]) not in ("", "nan"):
            return str(row.iloc[0]["nombre_oferta"])
    except Exception:
        pass  # catálogo aún no cargado → fallback estático
    return PLAN_DESCRIPTIONS.get(plan_id, plan_id)


def _parse_bool(value) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().upper() == "TRUE"
    return bool(value)
