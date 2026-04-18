# AI Interview Assistant

A Multi-Agent AI system that generates structured interview questions from Job Descriptions and CVs — built with GDPR and EU AI Act compliance in mind.

---

## What it does

Upload a Job Description (PDF) and a candidate's CV (PDF). A 4-agent pipeline analyzes both documents, generates role-specific interview questions, and runs an anti-discrimination quality check with Human-in-the-Loop fallback.

### Features

- Multi-Agent Pipeline (JD Analyst · CV Analyst · Question Generator · Quality Review)
- RAG-based context retrieval via ChromaDB
- Talent Pool — candidates reusable across job openings
- DOCX export for interview kits
- Full observability via Langfuse
- GDPR- and EU AI Act-compliant by design

---

## Tech Stack

**Backend:** Python 3.13 · FastAPI · LangGraph · LangChain · OpenAI GPT-4o-mini · ChromaDB · SQLAlchemy · SQLite · pdfplumber · Pydantic · slowapi · Langfuse v4

**Frontend:** React · Vite · Tailwind CSS · Node.js (DOCX export)

---

## Quick Start

### Prerequisites

- Python 3.13+
- Node.js 18+
- OpenAI API key

### Installation

Clone the repository:

​```bash
git clone git@github.com:YOUR-USERNAME/AI-interview-assistant.git
cd AI-interview-assistant
​```

Create virtual environment and install backend dependencies:

​```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
​```

Install frontend dependencies:

​```bash
cd frontend
npm install
cd ..
​```

Install Node.js DOCX library (from project root):

​```bash
npm install docx
​```

### Environment Variables

Create a `.env` file in the project root:

​```
OPENAI_API_KEY=your-openai-key
ADMIN_API_KEY=your-admin-key

# Optional
LANGFUSE_PUBLIC_KEY=your-public-key
LANGFUSE_SECRET_KEY=your-secret-key
LANGFUSE_HOST=https://cloud.langfuse.com
​```

### Run

Backend (Terminal 1):

​```bash
uvicorn backend.main:app --reload
​```

Frontend (Terminal 2):

​```bash
cd frontend
npm run dev
​```

Open `http://localhost:5173` in your browser.

---

## Usage

1. Create a Job Description (upload PDF)
2. Create an Interview Round
3. Add a candidate (upload CV — PII is anonymized locally before processing)
4. Assign the candidate to the round
5. Generate interview questions
6. Review, refine, and export as DOCX

---

## Compliance & Security

**GDPR**
- PII anonymization via regex before any external API call
- `store=False` on all OpenAI calls — no training, no retention
- Cascade-delete endpoints for Right to be Forgotten (Art. 17)

**EU AI Act**
- Transparency endpoints (`/api/ai-disclosure`, `/api/candidate-rights`)
- Human-in-the-Loop review for flagged questions

**Security**
- Pydantic input validation
- PDF magic-bytes verification
- 50,000 character input cap
- Rate limiting via slowapi
- Sanitized error responses

---

## Roadmap

- Microsoft Presidio + spaCy NER (replacing regex-based anonymization)
- Dynamic RAG queries derived from JD skill extraction
- PostgreSQL migration
- Alembic schema migrations
- Automated test suite
- Docker Compose setup