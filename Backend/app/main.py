"""
main.py
-------
Punto de entrada principal de la aplicación FastAPI.
Configura CORS, lifespan (carga de modelos) y registra los routers.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.ml.production_contract import load_contract
from app.ml.model_loader import load_models
from app.ml.catalog_retriever import load_catalog
from app.ml.feature_engineering import load_customers
from app.agents.graph import get_nbo_graph
from app.api.v1.recommendation import router as recommendation_router
from app.api.v1.outcome import router as outcome_router
from app.api.v1.supervisor import router as supervisor_router

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — carga los modelos ML al arrancar el servidor
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Iniciando servidor Movistar NBO Advisor Copilot...")
    try:
        load_contract()
        logger.info("✅ Contrato de producción (constantes/categorías) cargado.")
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        raise

    try:
        load_models()
        logger.info("✅ Modelos ML cargados correctamente.")
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        logger.error("Ejecuta: python scripts/generate_models.py")
        raise  # Falla el arranque si no hay modelos

    try:
        load_catalog()
        logger.info("✅ Catálogo de ofertas (RAG) cargado correctamente.")
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        logger.error("Ejecuta: python scripts/build_catalog_index.py")
        raise  # Falla el arranque si no hay índice de catálogo

    try:
        load_customers()
        logger.info("✅ Dataset de clientes cargado en memoria.")
    except FileNotFoundError as e:
        logger.error(f"❌ {e}")
        raise

    get_nbo_graph()
    logger.info("✅ Grafo LangGraph NBO compilado correctamente.")

    yield  # El servidor está activo aquí

    logger.info("🛑 Cerrando servidor...")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Movistar NBO Advisor Copilot API",
    description=(
        "Backend de IA para el sistema de recomendación Next Best Offer (NBO). "
        "Powered by FastAPI + LangGraph + GPT-4o-mini."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — permite peticiones desde el Frontend React (Vite dev server)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(
    recommendation_router,
    prefix="/api/v1",
    tags=["Recomendación NBO"],
)

app.include_router(
    outcome_router,
    prefix="/api/v1",
    tags=["Trazabilidad"],
)

app.include_router(
    supervisor_router,
    prefix="/api/v1",
    tags=["Supervisión"],
)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/health", tags=["Sistema"])
async def health_check():
    return {"status": "ok", "service": "Movistar NBO Advisor Copilot"}


@app.get("/", tags=["Sistema"])
async def root():
    return {
        "message": "Movistar NBO Advisor Copilot API",
        "docs": "/docs",
        "health": "/health",
    }
