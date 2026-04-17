from fastapi import APIRouter
from datetime import datetime, timezone

router = APIRouter()


@router.get("/ai-disclosure")
def get_ai_disclosure():
    return {
        "disclosure": {
            "de": {
                "title": "Hinweis zum Einsatz von Künstlicher Intelligenz",
                "text": (
                    "In unserem Bewerbungsprozess setzen wir ein KI-gestütztes Tool ein, "
                    "das den/die Recruiter:in bei der Vorbereitung von Interviewfragen "
                    "unterstützt. Die KI analysiert die Stellenbeschreibung und Ihren "
                    "Lebenslauf, um passende Interviewfragen vorzuschlagen.\n\n"
                    "Wichtig für Sie:\n"
                    "- Die KI trifft KEINE Einstellungsentscheidungen\n"
                    "- Alle Fragen werden von einem Menschen geprüft\n"
                    "- Ihr Lebenslauf wird vor der KI-Verarbeitung anonymisiert\n"
                    "- Ihre Daten werden NICHT zum Training der KI verwendet\n"
                    "- Sie haben Auskunftsrecht (DSGVO Art. 15) und Widerspruchsrecht (Art. 21)"
                ),
            },
            "en": {
                "title": "Notice regarding the use of Artificial Intelligence",
                "text": (
                    "In our application process, we use an AI-powered tool that supports "
                    "the recruiter in preparing interview questions. The AI analyzes the "
                    "job description and your CV to suggest relevant interview questions.\n\n"
                    "Important:\n"
                    "- The AI does NOT make hiring decisions\n"
                    "- All questions are reviewed by a human\n"
                    "- Your CV is anonymized before AI processing\n"
                    "- Your data is NOT used for AI training\n"
                    "- You have the right to information (GDPR Art. 15) and objection (Art. 21)"
                ),
            }
        },
        "system_info": {
            "system_name": "AI Interview Assistant",
            "version": "0.2.0",
            "ai_provider": "OpenAI (GPT-4o-mini)",
            "risk_classification": "High-Risk (EU AI Act Annex III, Nr. 4a)",
            "architecture": "Multi-Agent (LangGraph): JD Agent → CV Agent → Question Agent",
            "observability": "Langfuse Tracing",
        },
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/candidate-rights")
def get_candidate_rights():
    return {
        "rights": [
            {"article": "Art. 13/14", "right": "Informationsrecht", "implemented": True, "how": "GET /api/ai-disclosure"},
            {"article": "Art. 15", "right": "Auskunftsrecht", "implemented": True, "how": "GET /api/candidates"},
            {"article": "Art. 17", "right": "Recht auf Löschung", "implemented": True, "how": "DELETE /api/candidates/{id}"},
            {"article": "Art. 21", "right": "Widerspruchsrecht", "implemented": True, "how": "Recruiter kann ohne KI arbeiten"},
            {"article": "Art. 22", "right": "Keine rein automatisierte Entscheidung", "implemented": True, "how": "KI = Vorschläge, Mensch entscheidet"},
        ]
    }
