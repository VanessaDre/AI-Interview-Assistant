from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, Candidate, JobDescription, InterviewRound
from backend.services.rag_service import delete_document
import os

router = APIRouter()

SYSTEM_PROTECTED_JD_IDS = {"SYSTEM_KENNENLERN_DEFAULT"}
SYSTEM_PROTECTED_ROUND_IDS = {"SYSTEM_KENNENLERN_ROUND_DEFAULT"}


@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: str, db: Session = Depends(get_db)):
    """Deletes a candidate completely (DSGVO Art. 17).
    All assignments in candidate_rounds are removed automatically via cascade.
    Interview rounds and job descriptions are not affected."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    delete_document(doc_id=candidate.doc_id)
    if candidate.file_path and os.path.exists(candidate.file_path):
        os.remove(candidate.file_path)
    db.delete(candidate)
    db.commit()
    return {"message": f"Candidate '{candidate.name}' deleted"}


@router.delete("/interview-rounds/{round_id}/candidates")
def unassign_all_candidates_from_round(round_id: str, db: Session = Depends(get_db)):
    """Removes ALL candidate assignments from a round.
    The candidates themselves stay in the system (Talent Pool).
    The round stays, only the links in candidate_rounds are removed."""
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    unassigned_names = [c.name for c in round_obj.candidates]
    round_obj.candidates = []
    db.commit()
    return {
        "message": f"All candidate assignments removed from round '{round_obj.title}'",
        "unassigned_candidates": unassigned_names,
        "note": "Candidates themselves were not deleted and remain in the system.",
    }


@router.delete("/interview-rounds/{round_id}")
def delete_interview_round(round_id: str, db: Session = Depends(get_db)):
    """Deletes an interview round.
    Assignments in candidate_rounds are removed automatically via cascade.
    Candidates themselves stay in the system.

    System-level rounds are protected from deletion.
    """
    if round_id in SYSTEM_PROTECTED_ROUND_IDS:
        raise HTTPException(
            status_code=403,
            detail="System-level Interview Rounds cannot be deleted. They are required for core functionality."
        )

    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    round_title = round_obj.title
    db.delete(round_obj)
    db.commit()
    return {
        "message": f"Round '{round_title}' deleted. Candidates remain in the system.",
    }


@router.delete("/job-descriptions/{jd_id}")
def delete_job_description(jd_id: str, db: Session = Depends(get_db)):
    """Deletes a job description.
    Cascade deletes all linked interview rounds, which cascades to
    the candidate_rounds assignments. Candidates themselves are preserved.

    System-level JDs are protected from deletion.
    """
    if jd_id in SYSTEM_PROTECTED_JD_IDS:
        raise HTTPException(
            status_code=403,
            detail="System-level Job Descriptions cannot be deleted. They are required for core functionality."
        )

    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")

    delete_document(doc_id=jd.doc_id)
    if jd.file_path and os.path.exists(jd.file_path):
        os.remove(jd.file_path)

    jd_title = jd.title
    db.delete(jd)
    db.commit()
    return {
        "message": f"Job Description '{jd_title}' and all its rounds deleted. Candidates remain in the system.",
    }