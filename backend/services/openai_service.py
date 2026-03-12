from openai import OpenAI
from dotenv import load_dotenv
import os

load_dotenv()

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def generate_interview_questions(job_description: str, cv_text: str) -> dict:
    system_prompt = """Du bist ein erfahrener HR-Spezialist. 
    Deine Aufgabe ist es, strukturierte Interviewfragen zu erstellen.
    Antworte immer auf Deutsch.
    Gib deine Antwort ausschließlich als JSON zurück – kein Text davor oder danach."""

    user_prompt = f"""Erstelle 6 Interviewfragen basierend auf dieser Job Description und diesem CV.

JOB DESCRIPTION:
{job_description}

CV:
{cv_text}

Antworte NUR mit diesem JSON-Format:
{{
  "questions": [
    {{
      "question": "Die Frage hier",
      "category": "Soft Skill oder Hard Skill oder Erfahrung oder Motivation",
      "difficulty": "leicht oder mittel oder schwer"
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

    import json
    raw = response.choices[0].message.content
    return json.loads(raw)