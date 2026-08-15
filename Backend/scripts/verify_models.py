"""
verify_models.py
----------------
Suite de verificación del contrato ML (equipo de Estadística · FASE 8).

Valida que los artefactos de producción copiados al backend cumplan con el
contrato que el código del servicio espera:

  1. Carga de los .pkl (propensión = Pipeline XGBoost; churn = bundle KMeans).
  2. Propensión: variables del ColumnTransformer y categorías del OneHotEncoder
     == categorias_produccion.json.
  3. Churn: bundle['features'] == orden esperado por _churn_features_vector
     (7 features, FASE 8 corregida); tipo_modelo válido; el artefacto KMeans es
     de referencia. El score individual + cuartiles (churn_score de
     constantes_produccion.json) se valida contra el fixture ground-truth de
     Estadística y la etiqueta debe caer en el vocabulario de riesgo.
  4. Contrato: constantes leídas por production_contract == constantes_produccion.json.
  5. Sanidad: terciles de mora re-calculados sobre clientes.csv vs JSON (warning).
  6. Predicciones de humo: p_acceptance en [0,1] y etiqueta de churn válida
     (score + cuartiles) para una muestra de clientes del dataset.

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
    get_churn_score_config,
    get_riesgo_mora_cortes,
    get_outliers_pctl995,
    get_oferta_hogar_base_id,
    get_umbral_decision,
)
from app.ml.model_loader import (
    _build_propension_row_values,
    _churn_label_from_score,
    get_churn_label,
)

# ---------------------------------------------------------------------------
# Contrato esperado (definiciones del pipeline de Estadística, FASE 7 actualizada)
# ---------------------------------------------------------------------------
CHURN_FEATURES_ESPERADAS = [
    "antiguedad_meses", "uso_app_movistar_prom", "monto_facturado_prom",
    "n_reclamos", "n_actividad_canal", "riesgo_mora_score", "elegible_mt",
]

# Features del score individual de churn (FASE 8 corregida) y pesos esperados.
CHURN_SCORE_FEATURES = [
    "riesgo_mora_score", "n_reclamos", "n_actividad_canal", "uso_app_movistar_prom",
]
CHURN_SCORE_PESOS_ESPERADOS = {
    "riesgo_mora_score": 1.0,
    "n_reclamos": 5.0,
    "n_actividad_canal": -1.0,
    "uso_app_movistar_prom": -1.0,
}
CHURN_FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "churn_contract.csv"
CHURN_REWEIGHT_ESPERADO = {"riesgo_mora_score": 2.5, "n_reclamos": 1.5}
CHURN_MORA_ESPERADA = {
    "riesgo_bajo": 0.4,
    "riesgo_medio_bajo": 28.37,
    "riesgo_medio_alto": 48.66,
    "riesgo_alto": 98.74,
}

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
    print("\n[2] Churn (churn_segmentacion.pkl, artefacto FASE 8 corregida)")
    path = settings.churn_model_path_full
    if not path.exists():
        error(f"no existe {path}")
        return
    bundle = joblib.load(path)
    if not isinstance(bundle, dict):
        error("no es un bundle dict")
        return
    for k in ("scaler", "kmeans", "features", "tipo_modelo"):
        if k not in bundle:
            error(f"falta la clave '{k}' en el bundle")
    tipo = bundle.get("tipo_modelo")
    if tipo == "no_supervisado_segmentacion_corregido":
        ok("tipo_modelo == no_supervisado_segmentacion_corregido")
    elif tipo is None:
        error("falta 'tipo_modelo' en el bundle")
    else:
        error(f"tipo_modelo inesperado: {tipo!r}")
    if bundle.get("features") != CHURN_FEATURES_ESPERADAS:
        error(
            "order de features NO coincide.\n"
            f"    esperado : {CHURN_FEATURES_ESPERADAS}\n"
            f"    en bundle: {bundle.get('features')}"
        )
    else:
        ok("features y orden == contrato (_churn_features_vector)")
    try:
        ok(
            f"scaler mean shape = {bundle['scaler'].mean_.shape}"
            f" | n_clusters = {bundle['kmeans'].n_clusters}"
            f" | n_features_in_ = {bundle['kmeans'].n_features_in_}"
        )
    except (KeyError, AttributeError) as exc:
        error(f"scaler/kmeans malformados: {exc}")
    mapa = bundle.get("mapa_cluster_a_etiqueta")
    if mapa:
        labels = set(mapa.values())
        if labels - CHURN_LABELS:
            error(f"etiquetas fuera de vocabulario: {labels - CHURN_LABELS}")
        else:
            ok(f"etiquetas del mapa válidas ({len(mapa)} clusters): {sorted(labels)}")
    else:
        ok("mapa_cluster_a_etiqueta ausente — el KMeans es artefacto de referencia; "
           "la etiqueta se asigna por score individual + cuartiles")


def check_churn_contract(source: str | None = None) -> None:
    print("\n[3] Churn — score individual + cuartiles vs ground-truth de Estadística")
    try:
        cfg = get_churn_score_config()
    except Exception as exc:  # noqa: BLE001
        error(f"no se pudo leer churn_score desde constantes: {exc}")
        return

    pesos = cfg.get("pesos")
    if pesos != CHURN_SCORE_PESOS_ESPERADOS:
        error(f"pesos del score NO coinciden\n    esperado: {CHURN_SCORE_PESOS_ESPERADOS}\n    en JSON : {pesos}")
    else:
        ok(f"pesos del score == contrato ({pesos})")

    cuartiles = cfg.get("cuartiles")
    etiquetas = cfg.get("etiquetas")
    if cuartiles != [-3.0, 30.33333333333334, 65.16666666666667]:
        error(f"cuartiles NO coinciden con la entrega: {cuartiles}")
    else:
        ok("cuartiles == [-3.0, 30.33..., 65.17...]")
    if etiquetas != ["riesgo_bajo", "riesgo_medio_bajo", "riesgo_medio_alto", "riesgo_alto"]:
        error(f"etiquetas NO coinciden: {etiquetas}")
    else:
        ok("etiquetas y orden == contrato")

    fixture = CHURN_FIXTURE_PATH
    if not fixture.exists():
        warning(f"fixture de ground-truth no encontrado: {fixture} (se omite la validación de etiquetas)")
        return
    df = pd.read_csv(fixture)
    extra = set(df.columns) - set(CHURN_SCORE_FEATURES + ["cliente_id", "churn_risk_label"])
    if extra:
        error(f"columnas inesperadas en el fixture: {extra}")
        return

    score = sum(
        float(pesos.get(f, 0.0)) * df[f].astype(float)
        for f in CHURN_SCORE_FEATURES
    )
    prediccion = score.map(_churn_label_from_score)
    match = (prediccion == df["churn_risk_label"]).mean()
    total = len(df)
    if match == 1.0:
        ok(f"{total} filas del fixture: etiqueta (score+cuartiles) == etiqueta oficial (100%)")
    else:
        err = int((prediccion != df["churn_risk_label"]).sum())
        error(
            f"etiqueta NO reproduce al oficial en {err} de {total} filas del fixture "
            f"(concordancia {match:.6f})"
        )

    if "score_crudo" in df.columns:
        error("el fixture NO debe almacenar scores redondeados (rompe los cortes); "
              "solo las features + etiqueta oficial")

    # ---- Constantes extra del equipo (2026-08-14): reponderación KMeans + mora esperada ----
    reweight = cfg.get("kmeans_reponderacion_input")
    if reweight != CHURN_REWEIGHT_ESPERADO:
        error(f"kmeans_reponderacion_input NO coincide\n    esperado: {CHURN_REWEIGHT_ESPERADO}\n    en JSON : {reweight}")
    else:
        ok(f"kmeans_reponderacion_input == {CHURN_REWEIGHT_ESPERADO}")

    mora_esp = cfg.get("mora_media_esperada_por_etiqueta")
    if mora_esp != CHURN_MORA_ESPERADA:
        error(f"mora_media_esperada_por_etiqueta NO coincide\n    esperado: {CHURN_MORA_ESPERADA}\n    en JSON : {mora_esp}")
    else:
        ok("mora_media_esperada_por_etiqueta == {0.4 / 28.37 / 48.66 / 98.74}")

    dataset = _churn_dataset(source)
    if dataset is None:
        warning("sin CSV de features (entrega o clientes.csv) para validar reponderación y mora — se omite")
        return
    autoritativo = dataset.attrs.get("autoritativo", False)

    # Scaler del bundle == medias poblacionales × reponderación (mora·2.5, reclamos·1.5)
    path = settings.churn_model_path_full
    if path.exists():
        bundle = joblib.load(path)
        mean = np.asarray(bundle["scaler"].mean_)
        pos = {f: i for i, f in enumerate(bundle["features"])}
        for feat, peso in CHURN_REWEIGHT_ESPERADO.items():
            esperado = float(dataset[feat].mean()) * peso
            actual = float(mean[pos[feat]])
            if np.isclose(esperado, actual, rtol=1e-3):
                ok(f"scaler.mean_[{feat}] == μ·{peso} ({actual:.4f})")
            else:
                error(f"scaler.mean_[{feat}]={actual:.4f} != μ({feat})·{peso}={esperado:.4f}")

    # Mora media por etiqueta (pipeline completo score+cuartiles) == esperado del equipo
    score_pop = sum(
        float(pesos.get(f, 0.0)) * dataset[f].astype(float)
        for f in CHURN_SCORE_FEATURES
    )
    etq = score_pop.map(_churn_label_from_score)
    med = pd.DataFrame({"etq": etq, "mora": dataset["riesgo_mora_score"].astype(float)})
    med = med.groupby("etq")["mora"].mean()
    for lab, esperado in CHURN_MORA_ESPERADA.items():
        if lab not in med:
            error(f"etiqueta '{lab}' sin datos")
            continue
        actual = float(med.loc[lab])
        if abs(actual - esperado) <= 0.05:
            ok(f"mora media {lab} = {actual:.2f} ≈ esperado {esperado}")
        elif autoritativo:
            error(f"mora media {lab} = {actual:.2f} != esperado {esperado}")
        else:
            warning(
                f"mora media {lab} = {actual:.2f} vs esperado {esperado} "
                "(clientes.csv ≈ entrega; validación estricta requiere --source)"
            )


def _churn_dataset(source: str | None) -> pd.DataFrame | None:
    """DataFrame con las 4 features del score + cliente_id, desde el CSV de la
    entrega (clientes_features_modelo.csv) o, si no está disponible, derivándolo
    de clientes.csv del backend (riesgo_mora_score = dias_mora_prom + meses_moroso·30).
    El CSV de la entrega es la fuente autoritativa (attrs['autoritativo']=True)."""
    if source:
        fcsv = Path(source) / "clientes_features_modelo.csv"
        if fcsv.exists():
            df = pd.read_csv(fcsv, usecols=["cliente_id"] + CHURN_SCORE_FEATURES)
            df.attrs["autoritativo"] = True
            return df
    data_path = settings.data_path_full
    if data_path.exists():
        usecols = [
            "cliente_id", "dias_mora_prom", "meses_moroso", "n_reclamos",
            "n_actividad_canal", "uso_app_movistar_prom",
        ]
        df = pd.read_csv(data_path, low_memory=False, usecols=usecols)
        df["riesgo_mora_score"] = df["dias_mora_prom"].fillna(0) + df["meses_moroso"].fillna(0) * 30.0
        df = df[["cliente_id"] + CHURN_SCORE_FEATURES]
        df.attrs["autoritativo"] = False
        return df
    return None


def check_propension_pipeline() -> None:
    print("\n[4] Propensión (modelo_propension.pkl, Pipeline XGBoost)")
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
    print("\n[5] Consistencia constantes (production_contract vs JSON crudo)")
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
    print("\n[6] Sanidad: terciles de mora re-calculados sobre clientes.csv (warning)")
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
    print(f"\n[7] Predicciones de humo ({clientes_n} clientes)")
    data_path = settings.data_path_full
    if not data_path.exists():
        error(f"dataset no encontrado: {data_path}")
        return
    df = pd.read_csv(data_path, low_memory=False)
    if clientes_n > len(df):
        clientes_n = len(df)

    prop_path = settings.propension_model_path_full
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

        # Churn (score individual + cuartiles; sin KMeans en runtime)
        try:
            etiqueta = get_churn_label(perfil)
        except Exception as exc:  # noqa: BLE001
            error(f"cliente {raw['cliente_id']}: churn score → {exc}")
            totals["bad"] += 1
            continue
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
    print("\n[8] Comparación con la entrega de Estadística (md5)")
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
    check_churn_contract(args.source)
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