"""
train_acceptance_model.py
-------------------------
Entrena el modelo de propensión de aceptación (p_acceptance) por oferta
usando el historial de campañas (historial_campanias.csv).

Se entrena SOLO con ofrecimientos donde el cliente fue contactado
(contactabilidad == 'contactado') y la meta es `resultado == 'aceptada'`.

Features usadas:
  - Cliente : tipo_cliente, antiguedad_meses, elegible_mt, es_movistar_total
  - Oferta  : oferta_id, tipo_oferta, oferta_es_mt
  - Canal   : canal (el canal más usado del cliente)

Ejecutar desde la raíz del backend:
    python scripts/train_acceptance_model.py

Genera:
    app/ml/models/acceptance_model.pkl   (Pipeline sklearn: OHE + XGBoost)
"""

from __future__ import annotations

import sys
import logging
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = ROOT.parent
sys.path.insert(0, str(ROOT))

import numpy as np
import pandas as pd
import joblib
from sklearn.compose import ColumnTransformer
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")
logger = logging.getLogger(__name__)

CAMPAIGN_PATH = PROJECT_ROOT / "historial_campanias.csv"
MODEL_PATH = ROOT / "app" / "ml" / "models" / "acceptance_model.pkl"

CAT_COLS = ["tipo_cliente", "canal", "oferta_id", "tipo_oferta"]
NUM_COLS = ["antiguedad_meses", "elegible_mt", "es_movistar_total", "oferta_es_mt"]
FEATURE_COLS = CAT_COLS + NUM_COLS


def load_and_prepare_data() -> pd.DataFrame:
    logger.info(f"Cargando historial de campañas: {CAMPAIGN_PATH}")
    df = pd.read_csv(CAMPAIGN_PATH, low_memory=False)
    logger.info(f"Registros totales: {len(df):,}")

    # Solo ofrecimientos donde el cliente fue contactado
    df = df[df["contactabilidad"] == "contactado"].copy()
    logger.info(f"Contactados: {len(df):,}")

    # Target binario: aceptada = 1
    df["target"] = (df["resultado"] == "aceptada").astype(int)
    logger.info(f"Tasa de aceptación: {df['target'].mean()*100:.2f}%")

    # Normalizar booleanos a 0/1
    for col in ["elegible_mt", "es_movistar_total", "oferta_es_mt"]:
        df[col] = df[col].astype(str).str.strip().str.upper().eq("TRUE").astype(int)

    df["antiguedad_meses"] = pd.to_numeric(df["antiguedad_meses"], errors="coerce").fillna(0)
    df["tipo_cliente"] = df["tipo_cliente"].astype(str).str.strip().fillna("desconocido")
    df["canal"] = df["canal"].astype(str).str.strip().fillna("desconocido")
    df["oferta_id"] = df["oferta_id"].astype(str).str.strip()
    df["tipo_oferta"] = df["tipo_oferta"].astype(str).str.strip().fillna("desconocido")

    df = df.dropna(subset=FEATURE_COLS)
    logger.info(f"Registros finales: {len(df):,}")
    return df


def main():
    df = load_and_prepare_data()

    X = df[FEATURE_COLS]
    y = df["target"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    logger.info(f"Train: {len(X_train):,} | Test: {len(X_test):,}")
    logger.info(f"Tasa aceptación train: {y_train.mean()*100:.2f}% | test: {y_test.mean()*100:.2f}%")

    preprocessor = ColumnTransformer(
        transformers=[
            ("cat", OneHotEncoder(handle_unknown="ignore", dtype=np.float32), CAT_COLS),
            ("num", "passthrough", NUM_COLS),
        ]
    )

    model = XGBClassifier(
        n_estimators=300,
        max_depth=3,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )

    pipeline = Pipeline([("prep", preprocessor), ("clf", model)])
    pipeline.fit(X_train, y_train)

    y_pred_proba = pipeline.predict_proba(X_test)[:, 1]
    y_pred = pipeline.predict(X_test)
    auc = roc_auc_score(y_test, y_pred_proba)

    logger.info(f"\n{classification_report(y_test, y_pred)}")
    logger.info(f"ROC-AUC: {auc:.4f}")

    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_PATH)
    logger.info(f"✅ Modelo guardado: {MODEL_PATH}")


if __name__ == "__main__":
    main()
