"""
outcome.py
----------
Endpoints de trazabilidad: registrar el resultado de una gestión comercial
y consultar el historial de ofrecimientos (Desafío 2).
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.ml.outcome_store import (
    VALID_OUTCOMES,
    load_outcomes,
    outcome_summary,
    record_outcome,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class OutcomeRequest(BaseModel):
    dni: str = Field(..., min_length=1, max_length=20)
    outcome: str = Field(...)
    gestion_id: str = Field(default="")


class OutcomeResponse(BaseModel):
    success: bool
    outcome: str
    gestion_id: str
    cliente_id: str


@router.post(
    "/outcome",
    response_model=OutcomeResponse,
    summary="Registrar resultado de una gestión comercial",
    description=(
        "Persiste el resultado (accepted / rejected_price / rejected_no_interest) "
        "de una oferta ofrecida al cliente, vinculada a su gestion_id."
    ),
)
async def register_outcome(payload: OutcomeRequest):
    if payload.outcome not in VALID_OUTCOMES or payload.outcome == "ofrecida":
        raise HTTPException(
            status_code=422,
            detail=(
                f"Outcome inválido: '{payload.outcome}'. "
                f"Válidos: accepted, rejected_price, rejected_no_interest."
            ),
        )

    record = record_outcome(
        cliente_id=payload.dni.strip(),
        outcome=payload.outcome,
        gestion_id=payload.gestion_id.strip(),
    )

    return OutcomeResponse(
        success=True,
        outcome=record["outcome"],
        gestion_id=record["gestion_id"],
        cliente_id=record["cliente_id"],
    )


@router.get(
    "/outcomes",
    summary="Historial de gestiones registradas",
    description="Devuelve los ofrecimientos y resultados registrados (los más recientes primero).",
)
async def get_outcomes(limit: int = 100):
    return {"total": len(load_outcomes()), "gestiones": load_outcomes(limit=limit)}


@router.get(
    "/outcomes/summary",
    summary="Resumen de resultados para supervisión",
    description="Agregados de trazabilidad: conversión, aceptaciones y rechazos.",
)
async def get_outcomes_summary():
    return outcome_summary()
