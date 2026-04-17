"""LangGraph Interview Pipeline – orchestrates JD, CV, and Question agents.

Graph flow:
  START → jd_analysis → cv_analysis → question_generation → END

State flows through all nodes, each agent enriches it.
Langfuse traces the entire pipeline run.
"""

from langgraph.graph import StateGraph, START, END
from backend.agents.interview_agents import (
    jd_analysis_agent,
    cv_analysis_agent,
    question_generator_agent,
)
from backend.services.langfuse_service import create_trace
from datetime import datetime, timezone
from typing import TypedDict, Any


# ── State Schema ──────────────────────────────────────────────

class InterviewState(TypedDict, total=False):
    # Input
    jd_doc_id: str
    cv_doc_id: str
    categories: list[dict]
    existing_questions: dict | None
    # Intermediate (filled by agents)
    jd_analysis: dict
    cv_analysis: dict
    # Output
    questions: dict


# ── Graph Definition ──────────────────────────────────────────

def build_interview_graph() -> StateGraph:
    """Builds and compiles the LangGraph interview pipeline."""
    
    graph = StateGraph(InterviewState)
    
    graph.add_node("jd_analysis", jd_analysis_agent)
    graph.add_node("cv_analysis", cv_analysis_agent)
    graph.add_node("question_generation", question_generator_agent)
    
    graph.add_edge(START, "jd_analysis")
    graph.add_edge("jd_analysis", "cv_analysis")
    graph.add_edge("cv_analysis", "question_generation")
    graph.add_edge("question_generation", END)
    
    return graph.compile()


# ── Pipeline Runner ───────────────────────────────────────────

# Compile once at module level for reuse
interview_pipeline = build_interview_graph()


def run_interview_pipeline(
    jd_doc_id: str,
    cv_doc_id: str,
    categories: list[dict],
    existing_questions: dict | None = None,
) -> dict:
    """Runs the complete interview pipeline.
    
    Args:
        jd_doc_id: ChromaDB doc_id of the job description
        cv_doc_id: ChromaDB doc_id of the anonymized CV
        categories: List of category configs with count, difficulty, weight
        existing_questions: Optional template for consistency
    
    Returns:
        dict with jd_analysis, cv_analysis, questions, and compliance metadata
    """
    request_timestamp = datetime.now(timezone.utc).isoformat()
    
    # Create Langfuse trace for entire pipeline
    create_trace(
        name="interview_pipeline",
        metadata={
            "jd_doc_id": jd_doc_id,
            "cv_doc_id": cv_doc_id,
            "categories_count": len(categories),
            "timestamp": request_timestamp,
        }
    )
    
    # Run the graph
    initial_state: InterviewState = {
        "jd_doc_id": jd_doc_id,
        "cv_doc_id": cv_doc_id,
        "categories": categories,
        "existing_questions": existing_questions,
    }
    
    result = interview_pipeline.invoke(initial_state)
    response_timestamp = datetime.now(timezone.utc).isoformat()
    
    # Attach compliance metadata
    result["compliance"] = {
        "human_oversight_disclaimer": (
            "Hinweis: Dieses Interviewkit wurde KI-gestützt erstellt. "
            "Die endgültige Entscheidung über Fragen, Bewertung und "
            "Einstellung trifft ausschließlich der/die Recruiter:in."
        ),
        "ai_act_metadata": {
            "system_type": "high_risk_hr_ai",
            "regulation": "EU AI Act (Regulation 2024/1689) – Annex III, Nr. 4a",
            "risk_category": "high_risk",
            "human_oversight_required": True,
            "automated_decision": False,
            "emotion_recognition": False,
            "data_training_opt_out": True,
        },
        "audit": {
            "model_used": "gpt-4o-mini",
            "agents_executed": ["jd_analysis_agent", "cv_analysis_agent", "question_generator_agent"],
            "request_timestamp": request_timestamp,
            "response_timestamp": response_timestamp,
            "pii_anonymized": True,
            "langfuse_traced": True,
        }
    }
    
    return result
