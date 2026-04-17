from sqlalchemy import create_engine, Column, String, DateTime, ForeignKey, Text, Table
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./backend/interview_assistant.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


candidate_rounds = Table(
    "candidate_rounds",
    Base.metadata,
    Column("candidate_id", String, ForeignKey("candidates.id", ondelete="CASCADE"), primary_key=True),
    Column("interview_round_id", String, ForeignKey("interview_rounds.id", ondelete="CASCADE"), primary_key=True),
    Column("assigned_at", DateTime, default=datetime.utcnow),
)


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    doc_id = Column(String, nullable=False)
    file_path = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview_rounds = relationship(
        "InterviewRound",
        back_populates="job_description",
        cascade="all, delete-orphan"
    )


class InterviewRound(Base):
    __tablename__ = "interview_rounds"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    job_description_id = Column(String, ForeignKey("job_descriptions.id"), nullable=False)
    questions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    job_description = relationship("JobDescription", back_populates="interview_rounds")
    candidates = relationship(
        "Candidate",
        secondary=candidate_rounds,
        back_populates="interview_rounds"
    )


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    doc_id = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview_rounds = relationship(
        "InterviewRound",
        secondary=candidate_rounds,
        back_populates="candidates"
    )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)


def seed_system_data():
    """Creates system-level default data on first app start.

    Seeds two resources:
    1. A generic 'Kennenlerngespraech' Job Description with prompt instructions
       for open-ended exploratory questions.
    2. A generic Interview Round 'Kennenlerngespraech' linked to the JD.

    Both enable the headhunter workflow: upload a candidate without a specific
    role, assign to the generic round, generate exploratory questions.

    Both resources are protected from deletion.
    """
    from backend.services.rag_service import store_document

    SYSTEM_JD_ID = "SYSTEM_KENNENLERN_DEFAULT"
    SYSTEM_JD_DOC_ID = "SYSTEM_KENNENLERN_DOC"
    SYSTEM_ROUND_ID = "SYSTEM_KENNENLERN_ROUND_DEFAULT"

    db = SessionLocal()
    try:
        existing_jd = db.query(JobDescription).filter(JobDescription.id == SYSTEM_JD_ID).first()
        if not existing_jd:
            kennenlern_text = (
                "This is a general introductory conversation between a recruiter or headhunter "
                "and a potential candidate. There is no specific position yet. "
                "The focus is on getting to know the candidate's background, motivations, and career goals. "
                "Topics to explore: motivation and career goals, professional background and experiences, "
                "personal strengths and work style, expectations for the next role, "
                "industries and fields of interest, preferred working environment and team setup. "
                "Generate open-ended, exploratory questions that help understand the candidate's personality "
                "and career path without committing to a specific role. "
                "Questions should be conversational, not technical or role-specific."
            )
            store_document(text=kennenlern_text, doc_type="job_description", doc_id=SYSTEM_JD_DOC_ID)
            system_jd = JobDescription(
                id=SYSTEM_JD_ID,
                title="Kennenlerngespraech (generisch)",
                company="System Default",
                doc_id=SYSTEM_JD_DOC_ID,
                file_path=None,
            )
            db.add(system_jd)
            db.commit()
            print("System JD 'Kennenlerngespraech' seeded.")

        existing_round = db.query(InterviewRound).filter(InterviewRound.id == SYSTEM_ROUND_ID).first()
        if not existing_round:
            system_round = InterviewRound(
                id=SYSTEM_ROUND_ID,
                title="Kennenlerngespraech",
                job_description_id=SYSTEM_JD_ID,
                questions=None,
            )
            db.add(system_round)
            db.commit()
            print("System Round 'Kennenlerngespraech' seeded.")
    finally:
        db.close()