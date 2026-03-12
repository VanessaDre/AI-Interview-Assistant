from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, Candidate, JobDescription, InterviewRound
from backend.services.rag_service import delete_document
import os

router = APIRouter()


@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: str, db: Session = Depends(get_db)):
    """Delete a candidate CV – removes file, vectors and DB entry (GDPR)"""

    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Delete vectors from ChromaDB
    delete_document(doc_id=candidate.doc_id)

    # Delete PDF file
    if os.path.exists(candidate.file_path):
        os.remove(candidate.file_path)

    # Delete from DB
    db.delete(candidate)
    db.commit()

    return {"message": f"Candidate '{candidate.name}' deleted successfully"}


@router.delete("/interview-rounds/{round_id}/candidates")
def delete_all_candidates_in_round(round_id: str, db: Session = Depends(get_db)):
    """Delete ALL candidate CVs in an Interview Round (GDPR – position filled)"""

    round = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round:
        raise HTTPException(status_code=404, detail="Interview Round not found")

    deleted = []
    for candidate in round.candidates:
        # Delete vectors
        delete_document(doc_id=candidate.doc_id)
        # Delete PDF
        if os.path.exists(candidate.file_path):
            os.remove(candidate.file_path)
        deleted.append(candidate.name)
        db.delete(candidate)

    db.commit()

    return {
        "message": f"All CVs deleted for round '{round.title}'",
        "deleted_candidates": deleted
    }


@router.delete("/job-descriptions/{jd_id}")
def delete_job_description(jd_id: str, db: Session = Depends(get_db)):
    """Delete a Job Description and all linked Interview Rounds and CVs"""

    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")

    # Delete all CVs in all rounds
    for round in jd.interview_rounds:
        for candidate in round.candidates:
            delete_document(doc_id=candidate.doc_id)
            if os.path.exists(candidate.file_path):
                os.remove(candidate.file_path)

    # Delete JD vectors and file
    delete_document(doc_id=jd.doc_id)
    if os.path.exists(jd.file_path):
        os.remove(jd.file_path)

    # DB cascade deletes rounds + candidates automatically
    db.delete(jd)
    db.commit()

    return {"message": f"Job Description '{jd.title}' and all linked data deleted successfully"}