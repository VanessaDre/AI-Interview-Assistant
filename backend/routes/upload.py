from fastapi import APIRouter, UploadFile, File, Form
from backend.services.rag_service import extract_text_from_pdf, store_document
import uuid
import os

router = APIRouter()

UPLOAD_DIR = "backend/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_document(
        file: UploadFile = File(...),
        doc_type: str = Form(...)  # "cv" or "job_description"
):
    # Save file locally
    doc_id = str(uuid.uuid4())
    file_path = f"{UPLOAD_DIR}/{doc_id}.pdf"

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Extract text from PDF
    text = extract_text_from_pdf(file_path)

    # Store embeddings in ChromaDB
    store_document(text=text, doc_type=doc_type, doc_id=doc_id)

    return {
        "doc_id": doc_id,
        "doc_type": doc_type,
        "characters_extracted": len(text),
        "message": "Document successfully stored"
    }