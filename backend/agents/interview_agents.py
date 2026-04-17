"""LangGraph Agent Nodes – each agent is a function that operates on shared state.

Architecture:
  JD Agent → analyzes job description via RAG + LLM
  CV Agent → analyzes anonymized CV via RAG + LLM
  Question Agent → generates interview kit from both analyses
  Quality Review Agent → scores questions, flags discriminatory ones for HITL
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
    QUALITY_REVIEW_SYSTEM, QUALITY_REVIEW_USER,
)
from dotenv import load_dotenv
import os
import json
import logging

load_dotenv()
logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# ── Quality Review Thresholds ───────────────────────────────
QUALITY_SCORE_THRESHOLD = 7.0  # Average of 5 soft criteria must be >= this
MAX_RETRIES_PER_QUESTION = 2  # Max automatic regeneration attempts


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
    """Analyzes the job description and extracts structured requirements."""
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
    No LLM call – sets a fixed jd_analysis marking the mode."""
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
    """Analyzes the anonymized CV and extracts qualifications."""
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
    """Generates interview questions with rubric.
    Branches based on interview_mode."""
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
        user_prompt = INTRODUCTORY_GEN_USER.format(
            total_questions=total_questions,
            cv_analysis=json.dumps(state["cv_analysis"], ensure_ascii=False, indent=2),
            category_instructions=category_instructions,
            consistency_note=consistency_note,
        )
        system_prompt = INTRODUCTORY_GEN_SYSTEM
    else:
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


# ── Quality Review Helpers ───────────────────────────────────

def _score_single_question(question: dict, cv_analysis: dict) -> dict:
    """Runs the Quality Review LLM on a single question.
    Returns the parsed review dict."""
    user_prompt = QUALITY_REVIEW_USER.format(
        question=question.get("question", ""),
        category=question.get("category", ""),
        difficulty=question.get("difficulty", ""),
        rubric=json.dumps(question.get("rubric", {}), ensure_ascii=False),
        cv_analysis=json.dumps(cv_analysis, ensure_ascii=False, indent=2),
    )
    raw = _call_openai(QUALITY_REVIEW_SYSTEM, user_prompt, max_tokens=800)
    return _parse_json(raw)


def _regenerate_replacement_question(
        question: dict,
        jd_analysis: dict,
        cv_analysis: dict,
        is_introductory: bool,
) -> dict:
    """Regenerates a single question using the appropriate template.
    Used when Quality Review fails and we want to retry."""
    # Reuse the single-question replacement flow with appropriate context
    if is_introductory:
        jd_summary = "Kennenlerngespräch ohne Zielrolle"
    else:
        jd_summary = json.dumps(jd_analysis, ensure_ascii=False)[:500]

    user_prompt = SINGLE_QUESTION_USER.format(
        category=question.get("category", ""),
        difficulty=question.get("difficulty", "medium"),
        jd_summary=jd_summary,
        cv_summary=json.dumps(cv_analysis, ensure_ascii=False)[:500],
        old_question=question.get("question", ""),
    )
    raw = _call_openai(SINGLE_QUESTION_SYSTEM, user_prompt, max_tokens=1000)
    return _parse_json(raw)


# ── Quality Review Agent ─────────────────────────────────────

@trace_agent("quality_review_agent")
def quality_review_agent(state: dict) -> dict:
    """Reviews each generated question on 5 soft criteria (1-10) plus a hard
    anti-discrimination pass/fail check (EU AI Act Art. 10, 15).

    Flow per question:
      1. Score the question
      2. If anti_discrimination fails → skip retry, flag for HITL
      3. If avg soft score < threshold → regenerate (up to MAX_RETRIES)
      4. After retries still failing → flag for HITL

    Output state:
      - questions: list of approved questions (with review_score attached)
      - flagged_questions: list of questions needing manual review
    """
    raw_questions_payload = state.get("questions", {})
    questions = raw_questions_payload.get("questions", []) if isinstance(raw_questions_payload, dict) else []
    cv_analysis = state.get("cv_analysis", {})
    jd_analysis = state.get("jd_analysis", {})
    is_introductory = state.get("interview_mode") == "introductory"

    approved: list[dict] = []
    flagged: list[dict] = []

    for q in questions:
        current_q = q
        review = None
        retry_attempts = 0
        discrimination_failed = False

        for attempt in range(MAX_RETRIES_PER_QUESTION + 1):
            try:
                review = _score_single_question(current_q, cv_analysis)
            except Exception as e:
                logger.warning(f"Quality review failed for a question: {e}")
                # On review error, flag the question rather than silently approving
                review = None
                break

            # Hard check first
            if review.get("anti_discrimination_check", "").lower() == "fail":
                discrimination_failed = True
                break

            # Soft check via average
            scores = review.get("scores", {})
            score_values = [v for v in scores.values() if isinstance(v, (int, float))]
            avg_score = sum(score_values) / len(score_values) if score_values else 0.0

            if avg_score >= QUALITY_SCORE_THRESHOLD:
                # Passed: attach review and approve
                current_q["review"] = {
                    "scores": scores,
                    "average_score": round(avg_score, 2),
                    "anti_discrimination_check": "pass",
                    "reasoning": review.get("reasoning", ""),
                    "retry_attempts": retry_attempts,
                }
                break

            # Not good enough yet: retry if we still have attempts left
            if attempt < MAX_RETRIES_PER_QUESTION:
                retry_attempts += 1
                try:
                    current_q = _regenerate_replacement_question(
                        current_q, jd_analysis, cv_analysis, is_introductory
                    )
                except Exception as e:
                    logger.warning(f"Regeneration failed: {e}")
                    break

        # Decide bucket
        if discrimination_failed:
            flagged.append({
                **current_q,
                "status": "needs_review",
                "flag_reason": "Anti-discrimination check failed (EU AI Act)",
                "review": {
                    "scores": review.get("scores", {}) if review else {},
                    "anti_discrimination_check": "fail",
                    "reasoning": review.get("reasoning", "") if review else "",
                    "retry_attempts": retry_attempts,
                },
            })
        elif "review" in current_q:
            approved.append(current_q)
        else:
            # Retries exhausted or review errored
            flagged.append({
                **current_q,
                "status": "needs_review",
                "flag_reason": (
                                   review.get("flag_reason") if review else None
                               ) or "Quality score below threshold after retries",
                "review": {
                    "scores": review.get("scores", {}) if review else {},
                    "anti_discrimination_check": review.get("anti_discrimination_check",
                                                            "pass") if review else "unknown",
                    "reasoning": review.get("reasoning", "") if review else "Review did not complete",
                    "retry_attempts": retry_attempts,
                },
            })

    # Write back: only approved questions in the main list,
    # flagged questions in a separate list for HITL.
    state["questions"] = {"questions": approved}
    state["flagged_questions"] = flagged
    return state


# ── Single Question Replacement (external API) ────────────────

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


