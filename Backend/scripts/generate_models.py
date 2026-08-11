"""
generate_models.py
------------------
Script one-shot para generar y exportar los modelos XGBoost (.pkl)
entrenados con el dataset sintético de clientes de Movistar.

Ejecutar desde la raíz del proyecto backend:
    python scripts/generate_models.py

Genera:
    app/ml/models/churn_model.pkl
    app/ml/models/mt_propensity_model.pkl
"""

from __future__ import annotations

import sys
import logging
from pathlib import Path

# Asegura que el módulo app sea importable desde cualquier CWD
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score
from xgboost import XGBClassifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Rutas
# ---------------------------------------------------------------------------
DATA_PATH = ROOT / "app" / "data" / "clientes.csv"
MODELS_DIR = ROOT / "app" / "ml" / "models"
CHURN_MODEL_PATH = MODELS_DIR / "churn_model.pkl"
MT_MODEL_PATH = MODELS_DIR / "mt_propensity_model.pkl"

MODELS_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Feature columns — DEBEN coincidir con model_loader.py: _build_feature_vector
# ---------------------------------------------------------------------------
FEATURE_COLS = [
    "antiguedad_meses",
    "consumo_datos_gb_prom",
    "consumo_voz_min_prom",
    "consumo_sms_prom",
    "uso_app_movistar_prom",
    "monto_facturado_prom",
    "monto_facturado_prom_6m",
    "dias_mora_prom",
    "meses_moroso",
    "n_reclamos",
    "n_actividad_canal",
    "ratio_uso_datos",
    "historial_mora",
    "tiene_movil_num",
    "tiene_hogar_num",
    "tiene_internet_hogar_num",
    "es_usuario_app_num",
    "elegible_mt_num",
]


def load_and_prepare_data() -> pd.DataFrame:
    logger.info(f"Cargando dataset: {DATA_PATH}")
    df = pd.read_csv(DATA_PATH, low_memory=False)
    logger.info(f"Registros cargados: {len(df):,}")

    # --- Booleanos → int ---
    bool_cols = {
        "tiene_movil": "tiene_movil_num",
        "tiene_hogar": "tiene_hogar_num",
        "tiene_internet_hogar": "tiene_internet_hogar_num",
        "es_usuario_app": "es_usuario_app_num",
        "elegible_mt": "elegible_mt_num",
    }
    for src, dst in bool_cols.items():
        df[dst] = df[src].map(
            lambda x: 1 if str(x).strip().upper() == "TRUE" else 0
        )

    # --- Features derivadas ---
    df["consumo_datos_gb_prom"] = pd.to_numeric(df["consumo_datos_gb_prom"], errors="coerce").fillna(0)
    df["ratio_uso_datos"] = (df["consumo_datos_gb_prom"] / 50.0).clip(upper=1.0)

    df["dias_mora_prom"] = pd.to_numeric(df["dias_mora_prom"], errors="coerce").fillna(0)
    df["meses_moroso"] = pd.to_numeric(df["meses_moroso"], errors="coerce").fillna(0)
    df["historial_mora"] = (
        df["meses_moroso"] * 0.5 + (df["dias_mora_prom"] / 30.0).clip(upper=1.0) * 0.5
    )

    # Limpiar numéricas restantes
    numeric_cols = [
        "antiguedad_meses", "consumo_voz_min_prom", "consumo_sms_prom",
        "uso_app_movistar_prom", "monto_facturado_prom", "monto_facturado_prom_6m",
        "n_reclamos", "n_actividad_canal",
    ]
    for col in numeric_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    df = df.dropna(subset=FEATURE_COLS)
    logger.info(f"Registros tras limpieza: {len(df):,}")
    return df


def generate_churn_label(df: pd.DataFrame) -> pd.Series:
    """
    Genera una etiqueta de churn sintética basada en reglas de negocio:
    - Alta mora + muchos reclamos + baja antigüedad = churn probable
    """
    churn_score = (
        (df["meses_moroso"] >= 3).astype(int) * 3
        + (df["dias_mora_prom"] > 20).astype(int) * 2
        + (df["n_reclamos"] >= 2).astype(int) * 2
        + (df["antiguedad_meses"] < 12).astype(int) * 1
        + (df["consumo_datos_gb_prom"] < 5).astype(int) * 1
        + np.random.default_rng(42).integers(0, 2, size=len(df))
    )
    return (churn_score >= 5).astype(int)


def generate_mt_propensity_label(df: pd.DataFrame) -> pd.Series:
    """
    Genera etiqueta de propensión a Movistar Total:
    - Alta antigüedad + ambos servicios + poco mora + elegible_mt = alta propensión
    """
    mt_score = (
        df["elegible_mt_num"] * 4
        + (df["antiguedad_meses"] > 24).astype(int) * 2
        + df["tiene_movil_num"] * 1
        + df["tiene_hogar_num"] * 1
        + (df["meses_moroso"] == 0).astype(int) * 1
        + (df["consumo_datos_gb_prom"] > 20).astype(int) * 1
        + np.random.default_rng(99).integers(0, 2, size=len(df))
    )
    return (mt_score >= 6).astype(int)


def train_model(X_train, y_train, X_test, y_test, name: str) -> XGBClassifier:
    logger.info(f"\n{'='*50}")
    logger.info(f"Entrenando modelo: {name}")
    logger.info(f"Distribución de clases: {dict(zip(*np.unique(y_train, return_counts=True)))}")

    model = XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        verbose=False,
    )

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = model.predict(X_test)
    auc = roc_auc_score(y_test, y_pred_proba)

    logger.info(f"\n{classification_report(y_test, y_pred)}")
    logger.info(f"ROC-AUC: {auc:.4f}")

    return model


def main():
    # 1. Cargar datos
    df = load_and_prepare_data()

    # 2. Generar etiquetas sintéticas
    df["churn_label"] = generate_churn_label(df)
    df["mt_label"] = generate_mt_propensity_label(df)

    logger.info(f"\nChurn positivos: {df['churn_label'].sum():,} ({df['churn_label'].mean()*100:.1f}%)")
    logger.info(f"MT positivos:    {df['mt_label'].sum():,} ({df['mt_label'].mean()*100:.1f}%)")

    X = df[FEATURE_COLS].values

    # 3. Entrenar modelo CHURN
    X_train, X_test, y_train, y_test = train_test_split(
        X, df["churn_label"].values, test_size=0.2, random_state=42, stratify=df["churn_label"]
    )
    churn_model = train_model(X_train, y_train, X_test, y_test, "Churn Risk Model")
    joblib.dump(churn_model, CHURN_MODEL_PATH)
    logger.info(f"✅ Modelo guardado: {CHURN_MODEL_PATH}")

    # 4. Entrenar modelo MT PROPENSITY
    X_train, X_test, y_train, y_test = train_test_split(
        X, df["mt_label"].values, test_size=0.2, random_state=42, stratify=df["mt_label"]
    )
    mt_model = train_model(X_train, y_train, X_test, y_test, "MT Propensity Model")
    joblib.dump(mt_model, MT_MODEL_PATH)
    logger.info(f"✅ Modelo guardado: {MT_MODEL_PATH}")

    logger.info("\n🎉 ¡Modelos generados exitosamente!")
    logger.info(f"   → {CHURN_MODEL_PATH}")
    logger.info(f"   → {MT_MODEL_PATH}")


if __name__ == "__main__":
    main()
