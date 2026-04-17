from sqlalchemy import create_engine, Column, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

DATABASE_URL = "sqlite:///./backend/interview_assistant.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(String, primary_key=True)
    title = Column(String, nullable=False)
    company = Column(String, nullable=False)
    doc_id = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview_rounds = relationship(
        "InterviewRound",
        back_populates="job_description",
        cascade="all, delete"
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
        back_populates="interview_round",
        cascade="all, delete"
    )


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    interview_round_id = Column(String, ForeignKey("interview_rounds.id"), nullable=False)
    doc_id = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    interview_round = relationship("InterviewRound", back_populates="candidates")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
