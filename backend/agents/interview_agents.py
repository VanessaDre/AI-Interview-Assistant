"""LangGraph Agent Nodes – each agent is a function that operates on shared state.

Architecture:
  JD Agent → analyzes job description via RAG + LLM
  CV Agent → analyzes anonymized CV via RAG + LLM
  Question Agent → generates interview kit from both analyses
  Introductory Passthrough → deterministic placeholder for CV-only mode

All agents are traced via Langfuse for observability.
"""

from openai import OpenAI
from backend.services.rag_service import retrieve_relevant_chunks
from backend.services.langfuse_service import trace_agent
from backend.prompts.templates import (
    JD_ANALYSIS_SYSTEM, JD_ANALYSIS_USER,
    CV_ANALYSIS_SYSTEM, CV_ANALYSIS_USER,
    QUESTION_GEN_SYSTEM, QUESTION_GEN_USER,
    INTRODUCTORY_GEN_SYSTEM, INTRODUCTORY_GEN_USER,
    SINGLE_QUESTION_SYSTEM, SINGLE_QUESTION_USER,
)
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def _call_openai(system: str, user: str, max_tokens: int = 2000) -> str:
    """Shared OpenAI call with store=False for GDPR/AI Act compliance."""
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user}
        ],
        temperature=0.7,
        max_tokens=max_tokens,
        store=False
    )
    return response.choices[0].message.content


def _parse_json(raw: str) -> dict:
    """Parse JSON from LLM response, handling markdown wrappers."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


# ── JD Analysis Agent ─────────────────────────────────────────

@trace_agent("jd_analysis_agent")
def jd_analysis_agent(state: dict) -> dict:
    """Analyzes the job description and extracts structured requirements.

    Reads from state: jd_doc_id
    Writes to state: jd_analysis
    """
    jd_context = retrieve_relevant_chunks(
        query="job requirements skills responsibilities qualifications",
        doc_id=state["jd_doc_id"]
    )

    user_prompt = JD_ANALYSIS_USER.format(jd_context=jd_context)
    raw = _call_openai(JD_ANALYSIS_SYSTEM, user_prompt, max_tokens=1500)

    state["jd_analysis"] = _parse_json(raw)
    return state


# ── Introductory Passthrough Agent ────────────────────────────

@trace_agent("introductory_passthrough_agent")
def introductory_passthrough_agent(state: dict) -> dict:
    """Deterministic placeholder for introductory conversations.

    No LLM call, no JD context – sets a fixed jd_analysis marking the mode.
    This saves an OpenAI call and guarantees no misinterpretation of a
    non-existent target role.

    Reads from state: (nothing)
    Writes to state: jd_analysis
    """
    state["jd_analysis"] = {
        "role_title": "Kennenlerngespräch",
        "interview_mode": "introductory",
        "key_responsibilities": [],
        "required_hard_skills": [],
        "required_soft_skills": [],
        "experience_level": "not_applicable",
        "nice_to_have": [],
        "note": (
            "Generisches Kennenlerngespräch ohne Zielrolle. Fragen werden "
            "ausschliesslich auf Basis des Kandidaten-Werdegangs generiert."
        ),
    }
    return state


# ── CV Analysis Agent ─────────────────────────────────────────

@trace_agent("cv_analysis_agent")
def cv_analysis_agent(state: dict) -> dict:
    """Analyzes the anonymized CV and extracts qualifications.

    Reads from state: cv_doc_id
    Writes to state: cv_analysis
    """
    cv_context = retrieve_relevant_chunks(
        query="candidate experience skills education projects achievements",
        doc_id=state["cv_doc_id"]
    )

    user_prompt = CV_ANALYSIS_USER.format(cv_context=cv_context)
    raw = _call_openai(CV_ANALYSIS_SYSTEM, user_prompt, max_tokens=1500)

    state["cv_analysis"] = _parse_json(raw)
    return state


# ── Question Generator Agent ─────────────────────────────────

@trace_agent("question_generator_agent")
def question_generator_agent(state: dict) -> dict:
    """Generates interview questions with rubric from CV analysis (and JD if present).

    Branches based on interview_mode:
    - "standard"     → JD + CV based questions (QUESTION_GEN_SYSTEM)
    - "introductory" → CV-only introductory questions (INTRODUCTORY_GEN_SYSTEM)

    Reads from state: interview_mode, jd_analysis, cv_analysis, categories, existing_questions
    Writes to state: questions
    """
    categories = state.get("categories", [])

    category_instructions = "\n".join([
        f"- {cat['category']}: {cat['count']} Frage(n), "
        f"Schwierigkeit: {cat['difficulty']}, "
        f"Gewichtung: {int(cat['weight'] * 100)}%"
        for cat in categories
    ])

    total_questions = sum(cat["count"] for cat in categories)

    consistency_note = ""
    if state.get("existing_questions"):
        consistency_note = (
            "WICHTIG – KONSISTENZ:\n"
            "Behalte die Grundstruktur bei für Kandidatenvergleichbarkeit.\n"
            f"Template: {json.dumps(state['existing_questions'], ensure_ascii=False)}"
        )

    is_introductory = state.get("interview_mode") == "introductory"

    if is_introductory:
        # CV-only mode: no JD content, special introductory prompt
        user_prompt = INTRODUCTORY_GEN_USER.format(
            total_questions=total_questions,
            cv_analysis=json.dumps(state["cv_analysis"], ensure_ascii=False, indent=2),
            category_instructions=category_instructions,
            consistency_note=consistency_note,
        )
        system_prompt = INTRODUCTORY_GEN_SYSTEM
    else:
        # Standard mode: full JD + CV based questions
        user_prompt = QUESTION_GEN_USER.format(
            total_questions=total_questions,
            jd_analysis=json.dumps(state["jd_analysis"], ensure_ascii=False, indent=2),
            cv_analysis=json.dumps(state["cv_analysis"], ensure_ascii=False, indent=2),
            category_instructions=category_instructions,
            consistency_note=consistency_note,
        )
        system_prompt = QUESTION_GEN_SYSTEM

    raw = _call_openai(system_prompt, user_prompt, max_tokens=4000)

    state["questions"] = _parse_json(raw)
    return state


# ── Single Question Replacement ───────────────────────────────

def regenerate_single_question(jd_doc_id: str, cv_doc_id: str, old_question: str, category: str,
                               difficulty: str) -> dict:
    """Generates a single replacement question without re-running the full pipeline."""
    jd_context = retrieve_relevant_chunks(
        query="job requirements skills responsibilities",
        doc_id=jd_doc_id
    ) if jd_doc_id else ""
    cv_context = retrieve_relevant_chunks(
        query="candidate experience skills education",
        doc_id=cv_doc_id
    )
    user_prompt = SINGLE_QUESTION_USER.format(
        category=category,
        difficulty=difficulty,
        jd_summary=jd_context[:500] if jd_context else "Kennenlerngespräch ohne Zielrolle",
        cv_summary=cv_context[:500],
        old_question=old_question,
    )
    raw = _call_openai(SINGLE_QUESTION_SYSTEM, user_prompt, max_tokens=1000)
    return _parse_json(raw)