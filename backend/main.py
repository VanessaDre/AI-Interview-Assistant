from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from backend.routes.questions import router as questions_router
from backend.routes.upload import router as upload_router
from backend.routes.rounds import router as rounds_router
from backend.routes.delete import router as delete_router
from backend.routes.compliance import router as compliance_router
from backend.routes.export import router as export_router
from backend.services import langfuse_service
from backend.database import create_tables, seed_system_data
import os
import logging

load_dotenv()

# ── Security config check ─────────────────────────────────────
# Fail-fast on missing critical secrets to avoid running an insecure MVP.
REQUIRED_SECRETS = ["OPENAI_API_KEY"]
missing = [k for k in REQUIRED_SECRETS if not os.getenv(k)]
if missing:
    raise RuntimeError(
        f"Missing required environment variables: {', '.join(missing)}. "
        f"Add them to .env before starting the server."
    )

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# ── Rate Limiter ──────────────────────────────────────────────
# Global default protects every route; stricter limits can be added per-route
# with @limiter.limit("5/minute") decorators if needed later.
# Uses client IP as key (get_remote_address).
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    headers_enabled=True,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    seed_system_data()
    yield
    langfuse_service.flush()


app = FastAPI(
    title="AI Interview Assistant",
    description="Multi-Agent RAG Interview Tool – EU AI Act & DSGVO compliant",
    version="0.2.0",
    lifespan=lifespan
)

# Register limiter with the app
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────
# Explicit allow-list; no wildcard. For production, read from env.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "PATCH"],
    allow_headers=["*"],
)

# ── Global exception handlers ────────────────────────────────
# Never leak stack traces to the client. Log internally, return sanitized responses.

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handles Pydantic validation errors with a clean, non-leaking response."""
    logger.warning(f"Validation error at {request.url.path}: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid request data", "errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catches any uncaught exception. Logs full details, returns generic message."""
    logger.exception(f"Unhandled exception at {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# ── Routes ────────────────────────────────────────────────────
# NOTE: For Phase 3 (Multi-User), add a JWT auth middleware here and protect
# routes via Depends(get_current_user).
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
        "rate_limiting_enabled": True,
        "version": "0.2.0",
        "architecture": "LangGraph Multi-Agent",
        "compliance": {"gdpr": True, "ai_act": True, "data_training_opt_out": True}
    }


