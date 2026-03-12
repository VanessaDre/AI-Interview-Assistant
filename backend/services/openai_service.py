from openai import OpenAI
from backend.services.rag_service import retrieve_relevant_chunks
from dotenv import load_dotenv
import os
import json

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_interview_questions(
        job_description_id: str,
        cv_id: str,
        difficulty: str,
        categories: list,
        existing_questions: dict = None
) -> dict:
    """Generates structured interview questions using RAG context"""

    # Retrieve relevant chunks from ChromaDB
    jd_context = retrieve_relevant_chunks(
        query="job requirements skills responsibilities",
        doc_id=job_description_id
    )
    cv_context = retrieve_relevant_chunks(
        query="candidate experience skills education",
        doc_id=cv_id
    )

    # Build category instructions
    category_instructions = "\n".join([
        f"- {cat.category}: {cat.count} question(s)"
        for cat in categories
    ])

    total_questions = sum(cat.count for cat in categories)

    # If template exists → instruct to keep core questions consistent
    consistency_note = ""
    if existing_questions:
        consistency_note = f"""
IMPORTANT – CONSISTENCY:
This interview round already has questions from a previous candidate.
Keep the same core structure and topics so all candidates are comparable.
Existing template:
{json.dumps(existing_questions, ensure_ascii=False, indent=2)}
Adapt only the CV-specific details to this new candidate.
"""

    system_prompt = """You are an experienced HR specialist.
    Your task is to create structured interview questions based on a job description and candidate CV.
    Always respond in German.
    Return your answer exclusively as JSON – no text before or after."""

    user_prompt = f"""Create exactly {total_questions} interview questions based on this job description and CV.

JOB DESCRIPTION CONTEXT:
{jd_context}

CANDIDATE CV CONTEXT:
{cv_context}

REQUIREMENTS:
- Overall difficulty: {difficulty}
- Questions per category:
{category_instructions}
{consistency_note}

Respond ONLY with this JSON format:
{{
  "questions": [
    {{
      "question": "The question here",
      "category": "Hard Skill or Soft Skill or Experience or Motivation",
      "difficulty": "{difficulty}"
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
        max_tokens=1500
    )

    raw = response.choices[0].message.content
    return json.loads(raw)