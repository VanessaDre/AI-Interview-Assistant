from openai import OpenAI
from backend.services.rag_service import retrieve_relevant_chunks
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_interview_questions(
        job_description_id: str,
        cv_id: str
) -> dict:
    """Generates interview questions using RAG context from ChromaDB"""

    # Retrieve relevant chunks from ChromaDB
    jd_context = retrieve_relevant_chunks(
        query="job requirements skills responsibilities",
        doc_id=job_description_id
    )
    cv_context = retrieve_relevant_chunks(
        query="candidate experience skills education",
        doc_id=cv_id
    )

    system_prompt = """You are an experienced HR specialist.
    Your task is to create structured interview questions based on a job description and a candidate CV.
    Always respond in German.
    Return your answer exclusively as JSON – no text before or after."""

    user_prompt = f"""Create 6 interview questions based on this job description and candidate CV.

JOB DESCRIPTION CONTEXT:
{jd_context}

CANDIDATE CV CONTEXT:
{cv_context}

Respond ONLY with this JSON format:
{{
  "questions": [
    {{
      "question": "The question here",
      "category": "Soft Skill or Hard Skill or Experience or Motivation",
      "difficulty": "easy or medium or hard"
    }}
  ]
}}"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        temperature=0.7,
        max_tokens=1000
    )

    raw = response.choices[0].message.content
    return json.loads(raw)