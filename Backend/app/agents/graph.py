"""
graph.py
--------
Compila el grafo LangGraph del pipeline NBO de Movistar.

Flujo:
  START → feature_eng_node → ml_scoring_node → catalog_retrieval_node → llm_pitch_node → END
"""

from __future__ import annotations

import asyncio
import logging
import time
from functools import wraps

from langgraph.graph import StateGraph, START, END

from app.agents.state import AgentState
from app.agents.nodes import (
    feature_eng_node,
    ml_scoring_node,
    catalog_retrieval_node,
    llm_pitch_node,
)

logger = logging.getLogger(__name__)


def _timed_node(name: str, fn):
    """
    Envuelve un nodo del grafo para medir su tiempo de ejecución.

    Registra el tiempo por nodo en el estado (`node_timings`) y en el log,
    para identificar el cuello de botella del pipeline. Soporta nodos síncronos
    y asíncronos.
    """
    is_async = asyncio.iscoroutinefunction(fn)

    def _finish(state, updates, start):
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.info(f"[perf] nodo {name}: {elapsed_ms:.1f} ms")
        if updates is None:
            updates = {}
        if isinstance(updates, dict):
            timings = dict(state.get("node_timings") or {})
            timings[name] = round(elapsed_ms, 2)
            updates["node_timings"] = timings
        return updates

    if is_async:

        @wraps(fn)
        async def wrapper(state):
            start = time.perf_counter()
            try:
                updates = await fn(state)
            except Exception:
                raise
            return _finish(state, updates, start)

    else:

        @wraps(fn)
        def wrapper(state):
            start = time.perf_counter()
            updates = fn(state)
            return _finish(state, updates, start)

    return wrapper


def _should_continue(state: AgentState) -> str:
    """
    Arista condicional post feature_eng_node:
    Si hay un error (cliente no encontrado), termina el flujo.
    """
    if state.get("error"):
        return END
    return "ml_scoring_node"


def build_nbo_graph():
    """Construye y compila el grafo LangGraph del pipeline NBO."""
    workflow = StateGraph(AgentState)

    # Agregar nodos (envueltos para medir tiempo de ejecución por nodo)
    workflow.add_node("feature_eng_node", _timed_node("feature_eng_node", feature_eng_node))
    workflow.add_node("ml_scoring_node", _timed_node("ml_scoring_node", ml_scoring_node))
    workflow.add_node(
        "catalog_retrieval_node", _timed_node("catalog_retrieval_node", catalog_retrieval_node)
    )
    workflow.add_node("llm_pitch_node", _timed_node("llm_pitch_node", llm_pitch_node))

    # Aristas
    workflow.add_edge(START, "feature_eng_node")

    # Arista condicional: si hay error → END, si no → ml_scoring
    workflow.add_conditional_edges(
        "feature_eng_node",
        _should_continue,
        {
            "ml_scoring_node": "ml_scoring_node",
            END: END,
        },
    )

    workflow.add_edge("ml_scoring_node", "catalog_retrieval_node")
    workflow.add_edge("catalog_retrieval_node", "llm_pitch_node")
    workflow.add_edge("llm_pitch_node", END)

    return workflow.compile()


_nbo_graph = None


def get_nbo_graph():
    """Devuelve la instancia compilada del grafo (singleton)."""
    global _nbo_graph
    if _nbo_graph is None:
        _nbo_graph = build_nbo_graph()
    return _nbo_graph

