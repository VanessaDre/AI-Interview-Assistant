from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.database import get_db, InterviewRound, JobDescription
import uuid
import json

router = APIRouter()


class CreateRoundRequest(BaseModel):
    title: str
    job_description_id: str


@router.post("/interview-rounds")
def create_interview_round(request: CreateRoundRequest, db: Session = Depends(get_db)):
    jd = db.query(JobDescription).filter(JobDescription.id == request.job_description_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    round_obj = InterviewRound(id=str(uuid.uuid4()), title=request.title, job_description_id=request.job_description_id)
    db.add(round_obj)
    db.commit()
    db.refresh(round_obj)
    return {"id": round_obj.id, "title": round_obj.title, "job_description_id": round_obj.job_description_id, "message": "Interview Round created"}


@router.get("/interview-rounds/{round_id}")
def get_interview_round(round_id: str, db: Session = Depends(get_db)):
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    return {
        "id": round_obj.id, "title": round_obj.title, "job_description_id": round_obj.job_description_id,
        "has_questions": round_obj.questions is not None,
        "candidates": [{"id": c.id, "name": c.name, "created_at": c.created_at} for c in round_obj.candidates],
        "created_at": round_obj.created_at
    }


@router.get("/interview-rounds/{round_id}/questions")
def get_questions_for_round(round_id: str, db: Session = Depends(get_db)):
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    if not round_obj.questions:
        raise HTTPException(status_code=404, detail="No questions generated yet")
    return {"interview_round_id": round_id, "title": round_obj.title, "questions": json.loads(round_obj.questions)}


@router.delete("/interview-rounds/{round_id}/questions")
def delete_round_questions(round_id: str, db: Session = Depends(get_db)):
    """Deletes only the generated questions for a round, keeps CVs intact."""
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    if not round_obj.questions:
        raise HTTPException(status_code=404, detail="No questions to delete")
    round_obj.questions = None
    db.commit()
    return {"message": f"Questions deleted for round '{round_obj.title}'. CVs and candidates are preserved."}