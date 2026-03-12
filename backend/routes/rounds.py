from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database import get_db, InterviewRound, JobDescription
import uuid

router = APIRouter()


class CreateRoundRequest(BaseModel):
    title: str               # e.g. "Python Dev - Januar 2026"
    job_description_id: str


@router.post("/interview-rounds")
def create_interview_round(
        request: CreateRoundRequest,
        db: Session = Depends(get_db)
):
    """Create a new Interview Round linked to a Job Description"""

    # Check if JD exists
    jd = db.query(JobDescription).filter(
        JobDescription.id == request.job_description_id
    ).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")

    round = InterviewRound(
        id=str(uuid.uuid4()),
        title=request.title,
        job_description_id=request.job_description_id
    )
    db.add(round)
    db.commit()
    db.refresh(round)

    return {
        "id": round.id,
        "title": round.title,
        "job_description_id": round.job_description_id,
        "message": "Interview Round created successfully"
    }


@router.get("/interview-rounds/{round_id}")
def get_interview_round(round_id: str, db: Session = Depends(get_db)):
    """Get details of a specific Interview Round including candidates"""

    round = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview Round not found")

    return {
        "id": round.id,
        "title": round.title,
        "job_description_id": round.job_description_id,
        "has_questions": round.questions is not None,
        "candidates": [
            {"id": c.id, "name": c.name, "created_at": c.created_at}
            for c in round.candidates
        ],
        "created_at": round.created_at
    }