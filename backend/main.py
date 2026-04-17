from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from backend.routes.questions import router as questions_router
from backend.routes.upload import router as upload_router
from backend.routes.rounds import router as rounds_router
from backend.routes.delete import router as delete_router
from backend.routes.compliance import router as compliance_router
from backend.routes.export import router as export_router
from backend.services import langfuse_service
from backend.database import create_tables
import os

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield
    langfuse_service.flush()


app = FastAPI(
    title="AI Interview Assistant",
    description="Multi-Agent RAG Interview Tool – EU AI Act & DSGVO compliant",
    version="0.2.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(questions_router, prefix="/api", tags=["Questions"])
app.include_router(upload_router, prefix="/api", tags=["Upload"])
app.include_router(rounds_router, prefix="/api", tags=["Interview Rounds"])
app.include_router(delete_router, prefix="/api", tags=["Delete / GDPR"])
app.include_router(compliance_router, prefix="/api", tags=["Compliance / AI Act"])
app.include_router(export_router, prefix="/api", tags=["Export"])


@app.get("/")
def root():
    return {"status": "running", "message": "AI Interview Assistant API is up!"}


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "openai_key_loaded": bool(os.getenv("OPENAI_API_KEY")),
        "langfuse_enabled": langfuse_service.is_enabled(),
        "version": "0.2.0",
        "architecture": "LangGraph Multi-Agent",
        "compliance": {"gdpr": True, "ai_act": True, "data_training_opt_out": True}
    }
