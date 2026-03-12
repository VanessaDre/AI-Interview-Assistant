from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.openai_service import generate_interview_questions

router = APIRouter()

class InterviewRequest(BaseModel):
    job_description_id: str # doc_id from upload
    cv_id: str # doc_id from upload

@router.post("/generate-questions")
def generate_questions(request: InterviewRequest):
    """Generates interview questions from uploaded JD and CV documents"""
    result = generate_interview_questions(
        job_description_id=request.job_description_id,
        cv_id=request.cv_id
    )
    return result