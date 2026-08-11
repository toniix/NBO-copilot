"""
outcome_store.py
----------------
Persistencia de outcomes comerciales (trazabilidad) en SQLite.

Almacena cada ofrecimiento y resultado en una tabla local `outcomes`.
SQLite facilita una posterior migración a Postgres (mismo esquema relacional).
"""
from __future__ import annotations

import logging
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_lock = threading.Lock()

VALID_OUTCOMES = {"accepted", "rejected_price", "rejected_no_interest", "ofrecida"}

_SCHEMA = """
CREATE TABLE IF NOT EXISTS outcomes (
    id            TEXT PRIMARY KEY,
    cliente_id    TEXT NOT NULL,
    outcome       TEXT NOT NULL,
    gestion_id    TEXT NOT NULL DEFAULT '',
    oferta_id     TEXT NOT NULL DEFAULT '',
    nombre_oferta TEXT NOT NULL DEFAULT '',
    pitch_type    TEXT NOT NULL DEFAULT '',
    channel       TEXT NOT NULL DEFAULT '',
    canal_actual  TEXT NOT NULL DEFAULT '',
    sales_pitch   TEXT NOT NULL DEFAULT '',
    registrado_en TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_outcomes_cliente ON outcomes (cliente_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_gestion  ON outcomes (gestion_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_result   ON outcomes (outcome);
"""


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _connect() -> sqlite3.Connection:
    path = settings.outcome_store_full
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, timeout=15)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.executescript(_SCHEMA)
    return conn


def record_outcome(
    cliente_id: str,
    outcome: str,
    oferta_id: str = "",
    nombre_oferta: str = "",
    pitch_type: str = "",
    channel: str = "",
    canal_actual: str = "",
    sales_pitch: str = "",
    gestion_id: str = "",
) -> dict:
    """Registra un outcome en SQLite y lo retorna con su ID."""
    if outcome not in VALID_OUTCOMES:
        raise ValueError(
            f"Outcome inválido: '{outcome}'. Válidos: {sorted(VALID_OUTCOMES)}"
        )

    record = {
        "id": uuid.uuid4().hex,
        "cliente_id": cliente_id,
        "outcome": outcome,
        "gestion_id": gestion_id or "",
        "oferta_id": oferta_id,
        "nombre_oferta": nombre_oferta,
        "pitch_type": pitch_type,
        "channel": channel,
        "canal_actual": canal_actual,
        "sales_pitch": sales_pitch,
        "registrado_en": _now_iso(),
    }

    columns = ", ".join(record.keys())
    placeholders = ", ".join("?" for _ in record)

    with _lock:
        conn = _connect()
        try:
            conn.execute(
                f"INSERT INTO outcomes ({columns}) VALUES ({placeholders})",
                tuple(record.values()),
            )
            conn.commit()
        finally:
            conn.close()

    logger.info(f"[OutcomeStore] Registrado {outcome} para {cliente_id}")
    return record


def load_outcomes(limit: int = 0) -> list[dict]:
    """Lee los outcomes registrados (los más recientes primero)."""
    conn = _connect()
    try:
        query = "SELECT * FROM outcomes ORDER BY registrado_en DESC, id DESC"
        if limit > 0:
            query += f" LIMIT {int(limit)}"
        rows = conn.execute(query).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def outcome_summary() -> dict:
    """Agregados para el dashboard de supervisión (trazabilidad)."""
    conn = _connect()
    try:
        row = conn.execute(
            """
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN outcome = 'accepted' THEN 1 ELSE 0 END) AS accepted,
                SUM(CASE WHEN outcome = 'rejected_price' THEN 1 ELSE 0 END) AS rejected_price,
                SUM(CASE WHEN outcome = 'rejected_no_interest' THEN 1 ELSE 0 END) AS rejected_no_interest
            FROM outcomes
            WHERE outcome != 'ofrecida'
            """
        ).fetchone()
    finally:
        conn.close()

    total = row["total"] or 0
    accepted = row["accepted"] or 0
    rejected_price = row["rejected_price"] or 0
    rejected_no_interest = row["rejected_no_interest"] or 0

    return {
        "total_gestiones": total,
        "aceptadas": accepted,
        "rechazadas_precio": rejected_price,
        "rechazadas_sin_interes": rejected_no_interest,
        "conversion_rate": round(accepted / total, 4) if total else 0.0,
    }