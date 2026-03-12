from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db, InterviewRound, Candidate
from backend.services.openai_service import generate_interview_questions
import json

router = APIRouter()


class CategoryConfig(BaseModel):
    category: str    # e.g. "Hard Skill"
    count: int       # e.g. 2


class GenerateQuestionsRequest(BaseModel):
    interview_round_id: str
    cv_id: str
    difficulty: str = "medium"          # "easy", "medium", "hard"
    categories: Optional[list[CategoryConfig]] = None  # if None → default config


@router.post("/generate-questions")
def generate_questions(
        request: GenerateQuestionsRequest,
        db: Session = Depends(get_db)
):
    """Generate interview questions for a candidate in an Interview Round"""

    # Check interview round exists
    round = db.query(InterviewRound).filter(
        InterviewRound.id == request.interview_round_id
    ).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview Round not found")

    # Check candidate exists
    candidate = db.query(Candidate).filter(
        Candidate.id == request.cv_id
    ).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Default categories if none provided
    categories = request.categories or [
        CategoryConfig(category="Hard Skill", count=2),
        CategoryConfig(category="Soft Skill", count=2),
        CategoryConfig(category="Experience", count=1),
        CategoryConfig(category="Motivation", count=1),
    ]

    # If round already has questions → use existing template
    # Only generate CV-specific questions on top
    existing_questions = None
    if round.questions:
        existing_questions = json.loads(round.questions)

    result = generate_interview_questions(
        job_description_id=round.job_description.doc_id,
        cv_id=candidate.doc_id,
        difficulty=request.difficulty,
        categories=categories,
        existing_questions=existing_questions
    )

    # Save questions to round if not already saved (first candidate = template)
    if not round.questions:
        round.questions = json.dumps(result)
        db.commit()

    return {
        "interview_round_id": request.interview_round_id,
        "candidate_id": request.cv_id,
        "candidate_name": candidate.name,
        "difficulty": request.difficulty,
        "questions": result["questions"]
    }