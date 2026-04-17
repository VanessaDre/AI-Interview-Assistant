from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.database import get_db, Candidate, JobDescription, InterviewRound
from backend.services.rag_service import delete_document
import os

router = APIRouter()


@router.delete("/candidates/{candidate_id}")
def delete_candidate(candidate_id: str, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    delete_document(doc_id=candidate.doc_id)
    if os.path.exists(candidate.file_path):
        os.remove(candidate.file_path)
    db.delete(candidate)
    db.commit()
    return {"message": f"Candidate '{candidate.name}' deleted"}


@router.delete("/interview-rounds/{round_id}/candidates")
def delete_all_candidates_in_round(round_id: str, db: Session = Depends(get_db)):
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    deleted = []
    for c in round_obj.candidates:
        delete_document(doc_id=c.doc_id)
        if os.path.exists(c.file_path):
            os.remove(c.file_path)
        deleted.append(c.name)
        db.delete(c)
    db.commit()
    return {"message": f"All CVs deleted for round '{round_obj.title}'", "deleted": deleted}


@router.delete("/interview-rounds/{round_id}")
def delete_interview_round(round_id: str, db: Session = Depends(get_db)):
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    for c in round_obj.candidates:
        delete_document(doc_id=c.doc_id)
        if os.path.exists(c.file_path):
            os.remove(c.file_path)
    db.delete(round_obj)
    db.commit()
    return {"message": f"Round '{round_obj.title}' and all candidates deleted"}


@router.delete("/job-descriptions/{jd_id}")
def delete_job_description(jd_id: str, db: Session = Depends(get_db)):
    jd = db.query(JobDescription).filter(JobDescription.id == jd_id).first()
    if not jd:
        raise HTTPException(status_code=404, detail="Job Description not found")
    for r in jd.interview_rounds:
        for c in r.candidates:
            delete_document(doc_id=c.doc_id)
            if os.path.exists(c.file_path):
                os.remove(c.file_path)
    delete_document(doc_id=jd.doc_id)
    if os.path.exists(jd.file_path):
        os.remove(jd.file_path)
    db.delete(jd)
    db.commit()
    return {"message": f"Job Description '{jd.title}' and all linked data deleted"}