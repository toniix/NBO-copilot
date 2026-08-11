"""
graph.py
--------
Compila el grafo LangGraph del pipeline NBO de Movistar.

Flujo:
  START → feature_eng_node → ml_scoring_node → catalog_retrieval_node → llm_pitch_node → END
"""

from __future__ import annotations

from langgraph.graph import StateGraph, START, END

from app.agents.state import AgentState
from app.agents.nodes import (
    feature_eng_node,
    ml_scoring_node,
    catalog_retrieval_node,
    llm_pitch_node,
)


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

    # Agregar nodos
    workflow.add_node("feature_eng_node", feature_eng_node)
    workflow.add_node("ml_scoring_node", ml_scoring_node)
    workflow.add_node("catalog_retrieval_node", catalog_retrieval_node)
    workflow.add_node("llm_pitch_node", llm_pitch_node)

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


# Instancia compilada — importar desde aquí
nbo_graph = build_nbo_graph()
