from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.services.rag_service import extract_text_from_pdf, store_document
from backend.database import get_db, JobDescription, Candidate, InterviewRound
import uuid
import os

router = APIRouter()

UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload/job-description")
async def upload_job_description(
        file: UploadFile = File(...),
        title: str = Form(...),
        company: str = Form(...),
        db: Session = Depends(get_db)
):
    """Upload and store a Job Description PDF"""

    doc_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{doc_id}.pdf"
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    text = extract_text_from_pdf(file_path)
    store_document(text=text, doc_type="job_description", doc_id=doc_id)

    jd = JobDescription(
        id=str(uuid.uuid4()),
        title=title,
        company=company,
        doc_id=doc_id,
        file_path=file_path
    )
    db.add(jd)
    db.commit()
    db.refresh(jd)

    return {
        "id": jd.id,
        "title": jd.title,
        "company": jd.company,
        "doc_id": jd.doc_id,
        "message": "Job Description successfully stored"
    }


@router.post("/upload/cv")
async def upload_cv(
        file: UploadFile = File(...),
        candidate_name: str = Form(...),
        interview_round_id: str = Form(...),
        db: Session = Depends(get_db)
):
    """Upload and store a Candidate CV – linked to an Interview Round"""

    # Check if interview round exists
    round = db.query(InterviewRound).filter(
        InterviewRound.id == interview_round_id
    ).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview Round not found")

    doc_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{doc_id}.pdf"
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    text = extract_text_from_pdf(file_path)
    store_document(text=text, doc_type="cv", doc_id=doc_id)

    candidate = Candidate(
        id=str(uuid.uuid4()),
        name=candidate_name,
        interview_round_id=interview_round_id,
        doc_id=doc_id,
        file_path=file_path
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return {
        "id": candidate.id,
        "name": candidate.name,
        "interview_round_id": candidate.interview_round_id,
        "doc_id": candidate.doc_id,
        "message": "CV successfully stored"
    }


@router.get("/job-descriptions")
def list_job_descriptions(db: Session = Depends(get_db)):
    """List all stored Job Descriptions"""
    jds = db.query(JobDescription).all()
    return [
        {
            "id": jd.id,
            "title": jd.title,
            "company": jd.company,
            "created_at": jd.created_at
        }
        for jd in jds
    ]


@router.get("/interview-rounds")
def list_interview_rounds(
        job_description_id: str = None,
        db: Session = Depends(get_db)
):
    """List all Interview Rounds, optionally filtered by Job Description"""
    query = db.query(InterviewRound)
    if job_description_id:
        query = query.filter(InterviewRound.job_description_id == job_description_id)
    rounds = query.all()
    return [
        {
            "id": r.id,
            "title": r.title,
            "job_description_id": r.job_description_id,
            "has_questions": r.questions is not None,
            "created_at": r.created_at
        }
        for r in rounds
    ]


@router.get("/candidates")
def list_candidates(
        interview_round_id: str = None,
        db: Session = Depends(get_db)
):
    """List all candidates, optionally filtered by Interview Round"""
    query = db.query(Candidate)
    if interview_round_id:
        query = query.filter(Candidate.interview_round_id == interview_round_id)
    candidates = query.all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "interview_round_id": c.interview_round_id,
            "created_at": c.created_at
        }
        for c in candidates
    ]