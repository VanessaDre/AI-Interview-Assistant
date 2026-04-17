from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from backend.services.rag_service import extract_text_from_pdf, store_document
from backend.services.gdpr_service import anonymize_cv_text, format_anonymization_report
from backend.agents.interview_agents import jd_analysis_agent, cv_analysis_agent
from backend.database import get_db, JobDescription, Candidate, InterviewRound
import uuid
import os
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── Security Limits ───────────────────────────────────────────
MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB
PDF_MAGIC_BYTES = b"%PDF-"
MAX_TITLE_LEN = 200
MAX_COMPANY_LEN = 200
MAX_NAME_LEN = 100


# ── Helpers ───────────────────────────────────────────────────

async def _read_and_validate_pdf(file: UploadFile) -> bytes:
    """Reads an uploaded file and validates:
    - Size is within MAX_PDF_SIZE_BYTES
    - Content starts with PDF magic bytes (not just .pdf extension)
    Returns the file bytes, ready to be written to disk.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are allowed",
        )

    content = await file.read()

    if len(content) > MAX_PDF_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {MAX_PDF_SIZE_BYTES // (1024*1024)} MB",
        )

    if len(content) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    if not content.startswith(PDF_MAGIC_BYTES):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File is not a valid PDF (invalid file signature)",
        )

    return content


def _validate_text_field(value: str, field_name: str, max_len: int) -> str:
    """Strips and validates a required text form field."""
    cleaned = (value or "").strip()
    if not cleaned:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field '{field_name}' is required",
        )
    if len(cleaned) > max_len:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Field '{field_name}' exceeds maximum length of {max_len} characters",
        )
    return cleaned


def _safe_analyze(agent_func, doc_id: str, doc_type: str) -> Optional[dict]:
    """Runs a LangGraph agent function safely and returns the analysis dict.

    If the analysis fails (e.g. OpenAI outage, malformed JSON), we log the
    error and return None so the upload itself still succeeds. The frontend
    can check whether analysis is present and display a fallback message.
    """
    try:
        if doc_type == "jd":
            state = {"jd_doc_id": doc_id}
            result_state = agent_func(state)
            return result_state.get("jd_analysis")
        else:
            state = {"cv_doc_id": doc_id}
            result_state = agent_func(state)
            return result_state.get("cv_analysis")
    except Exception as e:
        logger.warning(f"{doc_type.upper()} analysis failed for doc_id={doc_id}: {e}")
        return None


# ── Upload Routes ─────────────────────────────────────────────

@router.post("/upload/job-description")
async def upload_job_description(
    file: UploadFile = File(...),
    title: str = Form(...),
    company: str = Form(...),
    db: Session = Depends(get_db),
):
    """Uploads a job description PDF, extracts text, stores in vector DB and SQL DB.
    Runs the JD Analyst agent to extract structured requirements and returns
    them in the response for immediate frontend display.
    """
    title = _validate_text_field(title, "title", MAX_TITLE_LEN)
    company = _validate_text_field(company, "company", MAX_COMPANY_LEN)
    content = await _read_and_validate_pdf(file)

    doc_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{doc_id}.pdf"
    with open(file_path, "wb") as f:
        f.write(content)

    text = extract_text_from_pdf(file_path)
    store_document(text=text, doc_type="job_description", doc_id=doc_id)

    # Run JD analysis agent for immediate structured feedback
    jd_analysis = _safe_analyze(jd_analysis_agent, doc_id, "jd")

    jd = JobDescription(
        id=str(uuid.uuid4()),
        title=title,
        company=company,
        doc_id=doc_id,
        file_path=file_path,
    )
    db.add(jd)
    db.commit()
    db.refresh(jd)
    return {
        "id": jd.id,
        "title": jd.title,
        "company": jd.company,
        "doc_id": jd.doc_id,
        "message": "Job Description stored",
        "analysis": jd_analysis,
    }


@router.post("/upload/cv")
async def upload_cv(
    file: UploadFile = File(...),
    candidate_name: str = Form(...),
    interview_round_id: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    """Uploads a CV PDF. The interview_round_id is optional:
    - If provided: candidate is immediately assigned to the given round.
    - If empty: candidate is created standalone (Talent Pool entry).
    Runs the CV Analyst agent to extract structured qualifications and returns
    them in the response for immediate frontend display.
    """
    candidate_name = _validate_text_field(candidate_name, "candidate_name", MAX_NAME_LEN)

    round_obj = None
    if interview_round_id:
        round_obj = db.query(InterviewRound).filter(InterviewRound.id == interview_round_id).first()
        if not round_obj:
            raise HTTPException(status_code=404, detail="Interview Round not found")

    content = await _read_and_validate_pdf(file)

    doc_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{doc_id}.pdf"
    with open(file_path, "wb") as f:
        f.write(content)

    raw_text = extract_text_from_pdf(file_path)
    anonymized_text, gdpr_report = anonymize_cv_text(raw_text)
    store_document(text=anonymized_text, doc_type="cv", doc_id=doc_id)

    # Run CV analysis agent on the anonymized content
    cv_analysis = _safe_analyze(cv_analysis_agent, doc_id, "cv")

    candidate = Candidate(
        id=str(uuid.uuid4()),
        name=candidate_name,
        doc_id=doc_id,
        file_path=file_path,
    )
    if round_obj:
        candidate.interview_rounds.append(round_obj)

    db.add(candidate)
    db.commit()
    db.refresh(candidate)

    return {
        "id": candidate.id,
        "name": candidate.name,
        "interview_round_id": interview_round_id,
        "assigned_rounds": [r.id for r in candidate.interview_rounds],
        "doc_id": candidate.doc_id,
        "message": "CV stored (GDPR anonymized)" + (" and assigned to round" if round_obj else " as standalone candidate"),
        "gdpr": {
            "anonymized": True,
            "report": format_anonymization_report(gdpr_report),
            "details": gdpr_report,
        },
        "analysis": cv_analysis,
    }


@router.post("/candidates/{candidate_id}/assign/{round_id}")
def assign_candidate_to_round(candidate_id: str, round_id: str, db: Session = Depends(get_db)):
    """Assigns an existing candidate to an interview round.
    Useful for the Talent Pool workflow: upload candidate first, assign later."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    if round_obj in candidate.interview_rounds:
        return {"message": "Candidate already assigned to this round", "already_assigned": True}
    candidate.interview_rounds.append(round_obj)
    db.commit()
    return {
        "message": f"Candidate '{candidate.name}' assigned to round '{round_obj.title}'",
        "candidate_id": candidate.id,
        "round_id": round_obj.id,
    }


@router.delete("/candidates/{candidate_id}/assign/{round_id}")
def unassign_candidate_from_round(candidate_id: str, round_id: str, db: Session = Depends(get_db)):
    """Removes the assignment between a candidate and a round.
    The candidate and round themselves are not deleted."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    if round_obj not in candidate.interview_rounds:
        raise HTTPException(status_code=404, detail="Assignment not found")
    candidate.interview_rounds.remove(round_obj)
    db.commit()
    return {
        "message": f"Candidate '{candidate.name}' unassigned from round '{round_obj.title}'",
        "candidate_id": candidate.id,
        "round_id": round_obj.id,
    }


@router.get("/job-descriptions")
def list_job_descriptions(db: Session = Depends(get_db)):
    return [
        {
            "id": jd.id,
            "title": jd.title,
            "company": jd.company,
            "doc_id": jd.doc_id,
            "created_at": jd.created_at,
        }
        for jd in db.query(JobDescription).all()
    ]


@router.get("/job-descriptions/{jd_id}/pdf")
def get_jd_pdf(jd_id: str, db: Session = Depends(get_db)):
    """Serve the original JD PDF for viewing."""
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    if not os.path.exists(jd.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    return FileResponse(jd.file_path, media_type="application/pdf")


@router.get("/candidates/{candidate_id}/pdf")
def get_candidate_pdf(candidate_id: str, db: Session = Depends(get_db)):
    """Serve the original CV PDF for viewing."""
    c = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Candidate not found")
    if not os.path.exists(c.file_path):
        raise HTTPException(status_code=404, detail="PDF file not found")
    return FileResponse(c.file_path, media_type="application/pdf")


@router.get("/interview-rounds")
def list_interview_rounds(job_description_id: str = None, db: Session = Depends(get_db)):
    query = db.query(InterviewRound)
    if job_description_id:
        query = query.filter(InterviewRound.job_description_id == job_description_id)
    return [
        {
            "id": r.id,
            "title": r.title,
            "job_description_id": r.job_description_id,
            "has_questions": r.questions is not None,
            "candidate_count": len(r.candidates),
            "created_at": r.created_at,
        }
        for r in query.all()
    ]


@router.get("/candidates")
def list_candidates(interview_round_id: str = None, db: Session = Depends(get_db)):
    """Lists candidates. If interview_round_id is provided, only candidates
    assigned to that round are returned. Without filter, returns ALL candidates
    including unassigned ones (Talent Pool)."""
    if interview_round_id:
        round_obj = db.query(InterviewRound).filter(InterviewRound.id == interview_round_id).first()
        if not round_obj:
            return []
        candidates = round_obj.candidates
    else:
        candidates = db.query(Candidate).all()

    return [
        {
            "id": c.id,
            "name": c.name,
            "assigned_rounds": [{"id": r.id, "title": r.title} for r in c.interview_rounds],
            "is_unassigned": len(c.interview_rounds) == 0,
            "created_at": c.created_at,
        }
        for c in candidates
    ]