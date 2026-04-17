from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional
from backend.database import get_db, InterviewRound, Candidate
from backend.graphs.interview_graph import run_interview_pipeline
from backend.agents.interview_agents import regenerate_single_question
import json

router = APIRouter()

# ── System-level constants ─────────────────────────────────────

SYSTEM_INTRODUCTORY_ROUND_ID = "SYSTEM_KENNENLERN_ROUND_DEFAULT"


class CategoryConfig(BaseModel):
    category: str
    count: int = Field(ge=1, le=5, default=2)
    difficulty: str = "medium"
    weight: float = Field(ge=0.0, le=1.0, default=0.25)


class GenerateQuestionsRequest(BaseModel):
    interview_round_id: str
    cv_id: str
    categories: Optional[list[CategoryConfig]] = None


class RegenerateOneRequest(BaseModel):
    interview_round_id: str
    cv_id: str
    question_index: int
    old_question: str
    category: str
    difficulty: str


DEFAULT_CATEGORIES = [
    CategoryConfig(category="Hard Skill", count=2, difficulty="medium", weight=0.30),
    CategoryConfig(category="Soft Skill", count=2, difficulty="medium", weight=0.25),
    CategoryConfig(category="Erfahrung", count=1, difficulty="medium", weight=0.25),
    CategoryConfig(category="Motivation", count=1, difficulty="easy", weight=0.20),
]

# Categories tuned for introductory conversations (no target role)
INTRODUCTORY_DEFAULT_CATEGORIES = [
    CategoryConfig(category="Motivation", count=2, difficulty="easy", weight=0.30),
    CategoryConfig(category="Werdegang", count=2, difficulty="medium", weight=0.30),
    CategoryConfig(category="Staerken", count=1, difficulty="medium", weight=0.20),
    CategoryConfig(category="Entwicklung", count=1, difficulty="medium", weight=0.20),
]


def validate_weights(categories: list[CategoryConfig]) -> list[CategoryConfig]:
    total_weight = sum(cat.weight for cat in categories)
    if abs(total_weight - 1.0) <= 0.01:
        return categories
    for cat in categories:
        cat.weight = round(cat.weight / total_weight, 2)
    diff = 1.0 - sum(cat.weight for cat in categories)
    categories[0].weight = round(categories[0].weight + diff, 2)
    return categories


def _is_introductory_round(round_obj: InterviewRound) -> bool:
    """Returns True if this round is the system-level introductory conversation round.
    Detection is deterministic (by ID), not LLM-based, to avoid misinterpretation."""
    return round_obj.id == SYSTEM_INTRODUCTORY_ROUND_ID


@router.post("/generate-questions")
def generate_questions(request: GenerateQuestionsRequest, db: Session = Depends(get_db)):
    """Generates interview questions via LangGraph multi-agent pipeline.

    Detects introductory conversation rounds and routes to CV-only mode:
    - Introductory mode: skips JD analysis, uses CV-based introductory prompts
    - Standard mode: full JD + CV pipeline

    After generation, a Quality Review Agent scores every question on 5 soft
    criteria (1-10) plus an anti-discrimination pass/fail check (EU AI Act).
    Failing questions are moved to `flagged_questions` for Human-in-the-Loop review.

    Also saves category settings to the round for later reuse.
    """

    round_obj = db.query(InterviewRound).filter(InterviewRound.id == request.interview_round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")

    candidate = db.query(Candidate).filter(Candidate.id == request.cv_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Detect mode deterministically (by round ID, not LLM interpretation)
    is_introductory = _is_introductory_round(round_obj)
    interview_mode = "introductory" if is_introductory else "standard"

    # Pick appropriate default categories if none provided
    if request.categories:
        categories = request.categories
    elif is_introductory:
        categories = [cat.model_copy() for cat in INTRODUCTORY_DEFAULT_CATEGORIES]
    else:
        categories = [cat.model_copy() for cat in DEFAULT_CATEGORIES]

    categories = validate_weights(categories)

    existing_questions = None
    if round_obj.questions:
        existing_questions = json.loads(round_obj.questions)

    # JD doc_id only in standard mode; introductory skips JD analysis entirely
    jd_doc_id = None
    if not is_introductory:
        if not round_obj.job_description:
            raise HTTPException(
                status_code=400,
                detail="Standard round has no job description attached"
            )
        jd_doc_id = round_obj.job_description.doc_id

    result = run_interview_pipeline(
        jd_doc_id=jd_doc_id,
        cv_doc_id=candidate.doc_id,
        categories=[cat.model_dump() for cat in categories],
        existing_questions=existing_questions,
        interview_mode=interview_mode,
    )

    weight_map = {cat.category.lower(): cat.weight for cat in categories}
    questions = result.get("questions", {}).get("questions", [])
    for q in questions:
        cat_lower = q.get("category", "").lower()
        matched_weight = weight_map.get(cat_lower)
        if matched_weight is None:
            for k, v in weight_map.items():
                if k in cat_lower or cat_lower in k:
                    matched_weight = v
                    break
        q["category_weight"] = matched_weight or 0.0

    if not round_obj.questions:
        save_data = {
            "questions": questions,
            "category_settings": [cat.model_dump() for cat in categories],
            "interview_mode": interview_mode,
        }
        round_obj.questions = json.dumps(save_data, ensure_ascii=False)
        db.commit()

    return {
        "interview_round_id": request.interview_round_id,
        "candidate_id": request.cv_id,
        "candidate_name": candidate.name,
        "interview_mode": interview_mode,
        "category_weights": {cat.category: cat.weight for cat in categories},
        "total_questions": sum(cat.count for cat in categories),
        "approved_count": len(questions),
        "flagged_count": len(result.get("flagged_questions", [])),
        "jd_analysis": result.get("jd_analysis"),
        "cv_analysis": result.get("cv_analysis"),
        "questions": questions,
        "flagged_questions": result.get("flagged_questions", []),
        "compliance": result.get("compliance", {}),
    }


@router.post("/regenerate-question")
def regenerate_one_question(request: RegenerateOneRequest, db: Session = Depends(get_db)):
    """Regenerates a single question without regenerating the entire kit."""

    round_obj = db.query(InterviewRound).filter(InterviewRound.id == request.interview_round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")

    candidate = db.query(Candidate).filter(Candidate.id == request.cv_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # For introductory rounds, no JD doc_id is passed
    jd_doc_id = None
    if not _is_introductory_round(round_obj) and round_obj.job_description:
        jd_doc_id = round_obj.job_description.doc_id

    new_q = regenerate_single_question(
        jd_doc_id=jd_doc_id,
        cv_doc_id=candidate.doc_id,
        old_question=request.old_question,
        category=request.category,
        difficulty=request.difficulty,
    )

    return {"question": new_q, "replaced_index": request.question_index}


@router.get("/default-categories")
def get_default_categories():
    return {
        "categories": [cat.model_dump() for cat in DEFAULT_CATEGORIES],
        "introductory_categories": [cat.model_dump() for cat in INTRODUCTORY_DEFAULT_CATEGORIES],
        "difficulty_options": ["easy", "medium", "hard"],
    }


@router.get("/round-settings/{round_id}")
def get_round_settings(round_id: str, db: Session = Depends(get_db)):
    """Returns saved category settings for a round (for reuse with new candidates)."""
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    if not round_obj.questions:
        return {"settings": None}
    data = json.loads(round_obj.questions)
    return {"settings": data.get("category_settings"), "interview_mode": data.get("interview_mode", "standard")}


