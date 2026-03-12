from fastapi import FastAPI
from dotenv import load_dotenv
import os

# Lädt .env Datei
load_dotenv()

# FastAPI App erstellen
app = FastAPI(
    title="AI Interview Assistant",
    description="RAG-based Interview Tool for Recruiters",
    version="0.1.0"
)

# Health Check Endpoint – Server
@app.get("/")
def root():
    return {"status": "running", "message": "AI Interview Assistant API is up!"}

@app.get("/health")
def health_check():
    api_key = os.getenv("OPENAI_API_KEY")
    return {
        "status": "healthy",
        "openai_key_loaded": bool(api_key)
    }