from fastapi import APIRouter
from pydantic import BaseModel
from backend.services.openai_service import generate_interview_questions

router = APIRouter()

# Definiert wie der Request aussehen soll
class InterviewRequest(BaseModel):
    job_description: str
    cv_text: str

@router.post("/generate-questions")
def generate_questions(request: InterviewRequest):
    result = generate_interview_questions(
        job_description=request.job_description,
        cv_text=request.cv_text
    )
    return result