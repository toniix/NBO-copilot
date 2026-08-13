"""
verify_models.py
----------------
Suite de verificación del contrato ML (equipo de Estadística · FASE 8).

Valida que los artefactos de producción copiados al backend cumplan con el
contrato que el código del servicio espera:

  1. Carga de los .pkl (propensión = Pipeline XGBoost; churn = bundle KMeans).
  2. Propensión: variables del ColumnTransformer y categorías del OneHotEncoder
     == categorias_produccion.json.
  3. Churn: orden de bundle['features'] == orden esperado por
     _churn_features_vector; etiquetas del mapa dentro del vocabulario de riesgo.
  4. Contrato: constantes leídas por production_contract == constantes_produccion.json.
  5. Sanidad: terciles de mora re-calculados sobre clientes.csv vs JSON (warning).
  6. Predicciones de humo: p_acceptance en [0,1] y segmento de churn válido
     para una muestra de clientes del dataset.

Uso (desde Backend/):
    python scripts/verify_models.py [--source "../ModelosML/FASE 8"] [--clientes 25]

Exit code 0 = sin errores (puede haber warnings); 1 = errores de contrato.
"""

from __future__ import annotations

import argparse
import hashlib
import sys
import warnings
from pathlib import Path

# Asegura que el módulo app sea importable desde cualquier CWD
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")

from app.core.config import settings
from app.ml.production_contract import (
    contract_sources,
    get_categorias,
    get_riesgo_mora_cortes,
    get_outliers_pctl995,
    get_oferta_hogar_base_id,
    get_umbral_decision,
)
from app.ml.model_loader import _churn_features_vector, _build_propension_row_values

# ---------------------------------------------------------------------------
# Contrato esperado (definiciones del pipeline de Estadística, FASE 7 actualizada)
# ---------------------------------------------------------------------------
CHURN_FEATURES_ESPERADAS = [
    "antiguedad_meses", "uso_app_movistar_prom", "monto_facturado_prom",
    "n_reclamos", "n_actividad_canal", "riesgo_mora_score",
    "tiene_movil", "tiene_hogar", "tiene_internet_hogar", "elegible_mt",
]

# Esquema FASE 7 actualizada: n_reclamos_bin y antiguedad_intervalo reemplazan
# a las versiones numéricas crudas (antiguedad_meses, n_reclamos).
NUM_COLS = [
    "monto_facturado_prom", "riesgo_mora_score", "n_actividad_canal",
    "uso_app_movistar_prom", "diferencia_gasto", "brecha_datos",
    "ahorro_potencial_mt", "precio_mensual", "ahorro_pct", "gb_incluidos",
    "brecha_datos_aplica", "ahorro_potencial_mt_aplica",
]
CAT_COLS = [
    "canal", "tipo_cliente", "edad_rango", "ubicacion_departamento",
    "canal_mas_usado", "oferta_tipo", "segmento_objetivo",
    "antiguedad_intervalo",
]
BOOL_COLS = [
    "monto_facturado_prom_outlier", "consumo_datos_gb_prom_outlier",
    "tiene_movil", "tiene_hogar", "tiene_internet_hogar", "elegible_mt",
    "n_reclamos_bin",
]

CHURN_LABELS = {"riesgo_bajo", "riesgo_medio_bajo", "riesgo_medio_alto", "riesgo_alto"}


def _antiguedad_intervalos_esperadas() -> list[str]:
    """Categorías de antiguedad_intervalo derivadas de los bins 0..180 (paso 6).
    Formato idéntico al de pd.cut(..., right=True).astype(str)."""
    edges = list(range(0, 186, 6))
    return sorted(f"({edges[i]}, {edges[i + 1]}]" for i in range(len(edges) - 1))

# Oferta sintética de prueba (usada solo para puntuar el pipeline)
OFFER_PRUEBA = {
    "tipo_oferta": "movistar_total",
    "segmento_objetivo": "ambos",
    "precio_mensual": 129.0,
    "ahorro_pct": 40.0,
    "gb_incluidos": 39.9,
}

# ---------------------------------------------------------------------------
# Utilidades de reporte
# ---------------------------------------------------------------------------
_ERRORS: list[str] = []
_WARNINGS: list[str] = []


def error(msg: str) -> None:
    _ERRORS.append(msg)
    print(f"  ✗ {msg}")


def warning(msg: str) -> None:
    _WARNINGS.append(msg)
    print(f"  ⚠ {msg}")


def ok(msg: str) -> None:
    print(f"  ✓ {msg}")


def md5(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
def check_contract_sources() -> None:
    print("\n[1] Contrato de producción")
    src = contract_sources()
    for nombre in ("constantes", "categorias"):
        flag = f"{nombre}_cargado"
        ruta = src[f"{nombre}_path"]
        if src[flag]:
            ok(f"{nombre} ({ruta})")
        else:
            error(f"{nombre}: falta el JSON — {ruta}")
    if _ERRORS:
        return
    ok(f"umbral_decision = {get_umbral_decision()}"
       f" | oferta_hogar_base = {get_oferta_hogar_base_id()}"
       f" | cortes mora = {get_riesgo_mora_cortes()}")
    ok(f"outliers pctl995 = {get_outliers_pctl995()}")


def check_churn_bundle() -> None:
    print("\n[2] Churn (churn_segmentacion.pkl, KMeans)")
    path = settings.churn_model_path_full
    if not path.exists():
        error(f"no existe {path}")
        return
    bundle = joblib.load(path)
    if not isinstance(bundle, dict):
        error("no es un bundle dict")
        return
    for k in ("scaler", "kmeans", "features", "mapa_cluster_a_etiqueta"):
        if k not in bundle:
            error(f"falta la clave '{k}' en el bundle")
    if "features" in bundle:
        if bundle["features"] != CHURN_FEATURES_ESPERADAS:
            error(
                "order de features NO coincide.\n"
                f"    esperado : {CHURN_FEATURES_ESPERADAS}\n"
                f"    en bundle: {bundle['features']}"
            )
        else:
            ok("features y orden == contrato (_churn_features_vector)")
    mapa = bundle.get("mapa_cluster_a_etiqueta", {})
    labels = set(mapa.values())
    if labels - CHURN_LABELS:
        error(f"etiquetas fuera de vocabulario: {labels - CHURN_LABELS}")
    else:
        ok(f"etiquetas del mapa válidas ({len(mapa)} clusters): {sorted(labels)}")
    ok(f"scaler mean shape = {bundle['scaler'].mean_.shape} | n_clusters = {bundle['kmeans'].n_clusters}")


def check_propension_pipeline() -> None:
    print("\n[3] Propensión (modelo_propension.pkl, Pipeline XGBoost)")
    path = settings.propension_model_path_full
    if not path.exists():
        error(f"no existe {path}")
        return
    pipeline = joblib.load(path)
    if not hasattr(pipeline, "named_steps") or "prep" not in pipeline.named_steps:
        error("no es un Pipeline con el step 'prep'")
        return

    ct = pipeline.named_steps["prep"]
    actual: dict[str, list] = {}
    for name, _trans, cols in ct.transformers_:
        actual[name] = list(cols)

    esperado = {"num": NUM_COLS, "cat": CAT_COLS, "bool": BOOL_COLS}
    problemas = False
    for name, exp in esperado.items():
        if name in actual and set(actual[name]) == set(exp):
            ok(f"transformador '{name}': {len(exp)} variables == contrato")
        else:
            problemas = True
            error(f"transformador '{name}': esperado {exp}, actual {(actual.get(name))}")

    n_cat = len(actual.get("cat", []))
    if not problemas and len(CAT_COLS) == n_cat:
        # Categorías OHE == categorias_produccion.json
        categorias = get_categorias()
        ohe_cats: dict[str, list] = {}
        for name, trans, cols in ct.transformers_:
            if name == "cat":
                for col, cats in zip(cols, trans.categories_):
                    ohe_cats[col] = list(cats)
        for col in CAT_COLS:
            ee = ohe_cats.get(col)
            if ee is None:
                error(f"'{col}' no está en el OneHotEncoder del modelo")
                continue
            if col == "antiguedad_intervalo":
                esperado = _antiguedad_intervalos_esperadas()
                if ee == esperado:
                    ok(f"'{col}': {len(ee)} categorías == bins 0..180 (paso 6)")
                else:
                    error(
                        f"'{col}': categorías del pickle difieren de los bins esperados.\n"
                        f"    esperados: {esperado}\n"
                        f"    pickle   : {ee}"
                    )
                ej_adoc = categorias.get(col)
                if ej_adoc is None:
                    warning(
                        "'antiguedad_intervalo' NO está documentada en "
                        "categorias_produccion.json del paquete (inconsistencia de "
                        "Estadística) — se valida contra el modelo"
                    )
                elif ej_adoc != ee:
                    error(f"'{col}': categorias_produccion.json != pickle")
                else:
                    ok(f"'{col}': documentada en el JSON con las mismas categorías")
                continue
            ej = categorias.get(col)
            if ej is None:
                error(f"categoría '{col}' no está en categorias_produccion.json")
            elif ee != ej:
                error(
                    f"'{col}': categorías difieren.\n"
                    f"    JSON : {ej}\n"
                    f"    pickle: {ee}"
                )
            else:
                ok(f"'{col}': {len(ee)} categorías coinciden con el JSON")


def check_constantes_consistency() -> None:
    print("\n[4] Consistencia constantes (production_contract vs JSON crudo)")
    import json as _json

    path = settings.constantes_path_full
    if not path.exists():
        error("no existe constantes_produccion.json")
        return
    raw = _json.loads(path.read_text(encoding="utf-8"))

    checks = [
        ("corte_33", get_riesgo_mora_cortes()["corte_33"], raw["riesgo_mora_score"]["corte_33"]),
        ("corte_66", get_riesgo_mora_cortes()["corte_66"], raw["riesgo_mora_score"]["corte_66"]),
        ("umbral_decision", get_umbral_decision(), raw["umbral_decision_modelo"]),
        ("oferta_hogar_base", get_oferta_hogar_base_id(), raw["oferta_hogar_base_id"]),
    ]
    for nombre, leido, crudo in checks:
        igual = _valores_iguales(leido, crudo)
        if igual:
            ok(f"{nombre} == JSON ({crudo})")
        else:
            error(f"{nombre}: contrato={leido}, JSON={crudo}")

    # Outliers: el JSON puede traer null (consumo) -> se resuelve al default
    pctl = get_outliers_pctl995()
    for k in ("monto_facturado_prom", "consumo_datos_gb_prom"):
        v_json = raw["outliers_percentil_995"][k]
        if v_json is not None and float(pctl[k]) != float(v_json):
            error(f"outlier {k}: contrato={pctl[k]}, JSON={v_json}")
        elif v_json is None:
            warning(f"outlier {k}: JSON trae null -> se usa default {pctl[k]} (pedir a Estadística completar)")


def _valores_iguales(a, b) -> bool:
    if a == b:
        return True
    try:
        return float(a) == float(b)
    except (TypeError, ValueError):
        return False


def check_mora_terciles_sanity() -> None:
    print("\n[5] Sanidad: terciles de mora re-calculados sobre clientes.csv (warning)")
    data_path = settings.data_path_full
    if not data_path.exists():
        warning(f"dataset no encontrado para re-calcular terciles: {data_path}")
        return
    df = pd.read_csv(data_path, low_memory=False, usecols=["dias_mora_prom", "meses_moroso"])
    df["_score"] = df["dias_mora_prom"].fillna(0) + df["meses_moroso"].fillna(0) * 30.0
    try:
        _, bins = pd.qcut(df["_score"], 3, retbins=True)
    except Exception as exc:  # noqa: BLE001
        warning(f"no se pudieron recalcular los terciles: {exc}")
        return
    cortes = get_riesgo_mora_cortes()
    for nombre, valor in (("corte_33", bins[1]), ("corte_66", bins[2])):
        tol = max(abs(valor) * 0.05, 1.0)
        if abs(valor - cortes[nombre]) <= tol:
            ok(f"{nombre} re-calculado={valor:.4f} ≈ JSON={cortes[nombre]}")
        else:
            warning(f"{nombre} re-calculado={valor:.4f} != JSON={cortes[nombre]} — verificar con Estadística")


def _parse_bool(v) -> bool:
    if isinstance(v, bool):
        return v
    return str(v).strip().upper() == "TRUE"


def check_predictions(clientes_n: int) -> None:
    print(f"\n[6] Predicciones de humo ({clientes_n} clientes)")
    data_path = settings.data_path_full
    if not data_path.exists():
        error(f"dataset no encontrado: {data_path}")
        return
    df = pd.read_csv(data_path, low_memory=False)
    if clientes_n > len(df):
        clientes_n = len(df)

    churn_path, prop_path = settings.churn_model_path_full, settings.propension_model_path_full
    churn_bundle = joblib.load(churn_path) if churn_path.exists() else None
    pipeline = joblib.load(prop_path) if prop_path.exists() else None

    totals = {"ok": 0, "bad": 0}
    for i in range(clientes_n):
        raw = df.iloc[i]
        try:
            perfil = _minimal_profile(raw)
        except Exception as exc:  # noqa: BLE001
            error(f"cliente {raw['cliente_id']}: perfil → {exc}")
            totals["bad"] += 1
            continue

        # Churn
        if churn_bundle is not None:
            X = _churn_features_vector(perfil)
            X_s = churn_bundle["scaler"].transform(X)
            cluster = int(churn_bundle["kmeans"].predict(X_s)[0])
            etiqueta = churn_bundle["mapa_cluster_a_etiqueta"].get(cluster)
            if etiqueta not in CHURN_LABELS:
                error(f"cliente {raw['cliente_id']}: etiqueta churn inválida '{etiqueta}'")
                totals["bad"] += 1
                continue

        # Propensión
        if pipeline is not None:
            fila = _build_propension_row_values(perfil, OFFER_PRUEBA, canal="Digital")
            p = float(pipeline.predict_proba(pd.DataFrame([fila]))[:, 1][0])
            if not (0.0 <= p <= 1.0):
                error(f"cliente {raw['cliente_id']}: p_acceptance fuera de rango = {p}")
                totals["bad"] += 1
                continue

        totals["ok"] += 1

    if totals["bad"] == 0:
        ok(f"{totals['ok']} clientes puntuados sin errores (churn válido + p_acceptance ∈ [0,1])")
    else:
        error(f"{totals['bad']} clientes con errores, {totals['ok']} OK")


def _minimal_profile(raw: pd.Series) -> dict:
    """Perfil mínimo para puntuar sin tocar el catálogo (solo dataset + fórmulas FASE 2)."""
    meses_moroso = int(raw.get("meses_moroso") or 0)
    dias_mora = float(raw.get("dias_mora_prom") or 0)
    monto = float(raw.get("monto_facturado_prom") or 0)
    monto_6m = float(raw.get("monto_facturado_prom_6m") or 0)

    def _cat(key: str, default: str) -> str:
        v = raw.get(key)
        return str(v).strip() if pd.notna(v) and str(v).strip() not in ("", "nan") else default

    return {
        "antiguedad_meses": float(raw.get("antiguedad_meses") or 0),
        "monto_facturado_prom": monto,
        "monto_facturado_prom_6m": monto_6m,
        "riesgo_mora_score": dias_mora + meses_moroso * 30.0,
        "n_reclamos": int(raw.get("n_reclamos") or 0),
        "n_actividad_canal": int(raw.get("n_actividad_canal") or 0),
        "uso_app_movistar_prom": float(raw.get("uso_app_movistar_prom") or 0),
        "diferencia_gasto": monto - monto_6m,
        "tiene_movil": _parse_bool(raw.get("tiene_movil")),
        "tiene_hogar": _parse_bool(raw.get("tiene_hogar")),
        "tiene_internet_hogar": _parse_bool(raw.get("tiene_internet_hogar")),
        "es_movistar_total": _parse_bool(raw.get("es_movistar_total")),
        "elegible_mt": _parse_bool(raw.get("elegible_mt")),
        "tipo_cliente": _cat("tipo_cliente", "sin_linea_movil"),
        "edad_rango": _cat("edad_rango", "18-25"),
        "ubicacion_departamento": _cat("ubicacion_departamento", "Lima"),
        "canal_mas_usado": _cat("canal_mas_usado", "sin_interaccion"),
    }


def check_source_md5(source: str | None) -> None:
    print("\n[7] Comparación con la entrega de Estadística (md5)")
    if not source:
        print("  (omitido — usa --source ModelosML/FASE 8 para comparar)")
        return
    src = Path(source)
    if not src.is_dir():
        error(f"--source no es un directorio: {src}")
        return
    parejas = [
        ("churn_model.pkl", settings.churn_model_path_full),
        ("modelo_final_validado.pkl", settings.propension_model_path_full),
        ("constantes_produccion.json", settings.constantes_path_full),
        ("categorias_produccion.json", settings.categorias_path_full),
        ("catalogo_rebate.json", settings.rebate_catalog_path_full),
    ]
    for nombre_src, destino in parejas:
        f_src = src / nombre_src
        if not f_src.exists():
            warning(f"no existe {f_src.name} en la entrega")
            continue
        if not destino.exists():
            error(f"{destino.name} no copiado al backend")
            continue
        if md5(f_src) == md5(destino):
            ok(f"{nombre_src} == backend (md5 coincide)")
        else:
            error(f"{nombre_src} DIFFIERE del backend — re-sincronizar")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica el contrato de modelos ML (FASE 8).")
    parser.add_argument("--source", default=None, help="Carpeta de entrega de Estadística (p. ej. ../ModelosML/FASE 8)")
    parser.add_argument("--clientes", type=int, default=25, help="Número de clientes para las predicciones de humo")
    args = parser.parse_args()

    print("=" * 72)
    print("VERIFICACIÓN DEL CONTRATO ML — Movistar NBO Advisor Copilot")
    print("=" * 72)

    check_contract_sources()
    check_churn_bundle()
    check_propension_pipeline()
    check_constantes_consistency()
    check_mora_terciles_sanity()
    check_predictions(args.clientes)
    if args.source:
        check_source_md5(args.source)

    print("\n" + "=" * 72)
    print(f"RESULTADO: {len(_ERRORS)} error(es), {len(_WARNINGS)} warning(s)")
    if _WARNINGS:
        for w in _WARNINGS:
            print(f"  ⚠ {w}")
    if _ERRORS:
        for e in _ERRORS:
            print(f"  ✗ {e}")
        return 1
    print("✓ Contrato ML validado correctamente.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())