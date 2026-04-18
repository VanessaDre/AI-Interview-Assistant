from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from backend.database import get_db, InterviewRound
import json
import os
import subprocess
import tempfile

router = APIRouter()

# Must match the IDs used elsewhere (delete.py, seed, Dashboard)
SYSTEM_INTRODUCTORY_ROUND_ID = "SYSTEM_KENNENLERN_ROUND_DEFAULT"


@router.get("/export/interview-kit/{round_id}")
def export_interview_kit(round_id: str, db: Session = Depends(get_db)):
    round_obj = db.query(InterviewRound).filter(InterviewRound.id == round_id).first()
    if not round_obj:
        raise HTTPException(status_code=404, detail="Interview Round not found")
    if not round_obj.questions:
        raise HTTPException(status_code=404, detail="No questions generated yet")

    data = json.loads(round_obj.questions)
    questions = data.get("questions", [])

    # Detect introductory mode deterministically (by ID).
    # In this mode there is no real JD, so the generic system strings
    # ("Kennenlerngespräch" / "System Default") must not leak into the kit header.
    is_introductory = round_obj.id == SYSTEM_INTRODUCTORY_ROUND_ID

    if is_introductory:
        jd_title = "Kennenlerngespräch"
        jd_company = ""   # suppressed in template
        round_title = ""  # suppressed in template
    else:
        jd_title = round_obj.job_description.title if round_obj.job_description else "Unknown"
        jd_company = round_obj.job_description.company if round_obj.job_description else ""
        round_title = round_obj.title

    js_code = _build_docx_script(questions, jd_title, jd_company, round_title, is_introductory)

    tmp_dir = os.path.join(os.getcwd(), "backend", "tmp_export")
    os.makedirs(tmp_dir, exist_ok=True)
    js_path = os.path.join(tmp_dir, "gen.cjs")
    docx_path = os.path.join(tmp_dir, "interview_kit.docx")

    with open(js_path, "w") as f:
        f.write(js_code)

    try:
        result = subprocess.run(["node", js_path], capture_output=True, text=True, timeout=15, cwd=tmp_dir)
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"DOCX generation failed: {result.stderr[:300]}")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Node.js not found")

    if not os.path.exists(docx_path):
        raise HTTPException(status_code=500, detail="DOCX file was not created")

    base_name = (round_title or jd_title or "Kennenlerngespraech").replace(" ", "_")
    filename = f"Interview_Kit_{base_name}.docx"
    return FileResponse(docx_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


def _format_review_line(review: dict) -> str:
    """Builds a compact human-readable summary of the Quality Review Agent output.

    Shown below each question in the DOCX so the recruiter (human oversight per
    EU AI Act Art. 14) sees how the system itself rated the question's quality
    and whether the anti-discrimination hard check passed.
    """
    if not review:
        return ""
    avg = review.get("average_score")
    anti_disc = review.get("anti_discrimination_check", "")
    attempts = review.get("retry_attempts", 0)

    parts = []
    if avg is not None:
        parts.append(f"Qualität: {avg}/10")
    if anti_disc:
        symbol = "bestanden" if anti_disc.lower() == "pass" else "FAIL"
        parts.append(f"Anti-Diskriminierung: {symbol}")
    if attempts and attempts > 0:
        parts.append(f"Regenerierungen: {attempts}")
    return " · ".join(parts)


def _build_docx_script(questions, jd_title, jd_company, round_title, is_introductory=False):
    def esc(s):
        if s is None:
            return ""
        return str(s).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")

    q_sections = ""
    for i, q in enumerate(questions):
        category = esc(q.get("category", ""))
        difficulty = esc(q.get("difficulty", ""))
        question = esc(q.get("question", ""))
        rubric = q.get("rubric", {})
        review = q.get("review", {}) or {}

        rubric_rows = ""
        for score, desc in rubric.items():
            rubric_rows += f"""
        new TableRow({{ children: [
          new TableCell({{ borders, width: {{ size: 1200, type: WidthType.DXA }}, verticalAlign: VerticalAlign.CENTER, margins: {{ top: 60, bottom: 60, left: 100, right: 100 }},
            children: [new Paragraph({{ alignment: AlignmentType.CENTER, children: [new TextRun({{ text: "{score}", bold: true, size: 20 }})] }})] }}),
          new TableCell({{ borders, width: {{ size: 8160, type: WidthType.DXA }}, margins: {{ top: 60, bottom: 60, left: 100, right: 100 }},
            children: [new Paragraph({{ children: [new TextRun({{ text: "{esc(desc)}", size: 18 }})] }})] }}),
        ] }}),"""

        # Quality Review line (EU AI Act Art. 14 – human oversight transparency)
        review_line = esc(_format_review_line(review))
        review_paragraph = ""
        if review_line:
            review_paragraph = f"""
    new Paragraph({{ spacing: {{ before: 60, after: 60 }}, children: [
      new TextRun({{ text: "QA-Review: ", bold: true, size: 18, color: "7E22CE" }}),
      new TextRun({{ text: "{review_line}", size: 18, color: "555555" }}),
    ] }}),"""

        q_sections += f"""
    new Paragraph({{ spacing: {{ before: 300, after: 100 }}, children: [
      new TextRun({{ text: "Frage {i+1}: ", bold: true, size: 22 }}),
      new TextRun({{ text: "[{category}] ", bold: true, size: 20, color: "7E22CE" }}),
      new TextRun({{ text: "({difficulty})", size: 18, color: "888888" }}),
    ] }}),
    new Paragraph({{ spacing: {{ after: 150 }}, children: [new TextRun({{ text: "{question}", size: 22 }})] }}),{review_paragraph}
    new Paragraph({{ spacing: {{ after: 80 }}, children: [new TextRun({{ text: "Bewertungsskala:", bold: true, size: 20 }})] }}),
    new Table({{
      width: {{ size: 9360, type: WidthType.DXA }},
      columnWidths: [1200, 8160],
      rows: [
        new TableRow({{ children: [
          new TableCell({{ borders, width: {{ size: 1200, type: WidthType.DXA }}, shading: {{ fill: "E9D5FF", type: ShadingType.CLEAR }}, margins: {{ top: 60, bottom: 60, left: 100, right: 100 }},
            children: [new Paragraph({{ alignment: AlignmentType.CENTER, children: [new TextRun({{ text: "Punkte", bold: true, size: 18 }})] }})] }}),
          new TableCell({{ borders, width: {{ size: 8160, type: WidthType.DXA }}, shading: {{ fill: "E9D5FF", type: ShadingType.CLEAR }}, margins: {{ top: 60, bottom: 60, left: 100, right: 100 }},
            children: [new Paragraph({{ children: [new TextRun({{ text: "Beschreibung", bold: true, size: 18 }})] }})] }}),
        ] }}),{rubric_rows}
      ]
    }}),
    new Paragraph({{ spacing: {{ after: 50 }}, children: [new TextRun({{ text: "Bewertung: ___ / 5    Notizen: _______________________________________________", size: 18, color: "888888" }})] }}),
"""

    # Header paragraphs: in introductory mode we suppress company line and round line
    # (the JD and the round are both internal plumbing that should not appear in user output)
    company_paragraph = ""
    if not is_introductory and jd_company:
        company_paragraph = f'\n      new Paragraph({{ spacing: {{ after: 50 }}, children: [new TextRun({{ text: "{esc(jd_company)}", size: 22, color: "666666" }})] }}),'

    round_paragraph = ""
    if not is_introductory and round_title:
        round_paragraph = f'\n      new Paragraph({{ spacing: {{ after: 200 }}, children: [new TextRun({{ text: "Round: {esc(round_title)}", size: 20, color: "888888" }})] }}),'

    return f"""const {{ Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, WidthType, ShadingType, BorderStyle, VerticalAlign }} = require("docx");
const fs = require("fs");

const border = {{ style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }};
const borders = {{ top: border, bottom: border, left: border, right: border }};

const doc = new Document({{
  styles: {{ default: {{ document: {{ run: {{ font: "Arial", size: 22 }} }} }} }},
  sections: [{{
    properties: {{ page: {{ size: {{ width: 12240, height: 15840 }}, margin: {{ top: 1440, right: 1440, bottom: 1440, left: 1440 }} }} }},
    children: [
      new Paragraph({{ spacing: {{ after: 100 }}, children: [new TextRun({{ text: "Interview Kit", bold: true, size: 36 }})] }}),
      new Paragraph({{ spacing: {{ after: 50 }}, children: [new TextRun({{ text: "{esc(jd_title)}", size: 28, bold: true, color: "7E22CE" }})] }}),{company_paragraph}{round_paragraph}
      new Paragraph({{ spacing: {{ after: 100 }}, border: {{ bottom: {{ style: BorderStyle.SINGLE, size: 6, color: "7E22CE", space: 1 }} }}, children: [] }}),
      new Paragraph({{ spacing: {{ before: 200, after: 100 }}, children: [new TextRun({{ text: "Hinweis: Dieses Interviewkit wurde KI-gestuetzt erstellt. Die endgueltige Entscheidung trifft der/die Recruiter:in.", size: 18, italics: true, color: "888888" }})] }}),
      {q_sections}
      new Paragraph({{ spacing: {{ before: 400 }}, border: {{ top: {{ style: BorderStyle.SINGLE, size: 6, color: "7E22CE", space: 1 }} }}, children: [] }}),
      new Paragraph({{ spacing: {{ before: 100 }}, children: [new TextRun({{ text: "EU AI Act compliant | DSGVO-anonymisiert | AI Interview Assistant v0.2.0", size: 16, color: "AAAAAA" }})] }}),
    ]
  }}]
}});

Packer.toBuffer(doc).then(buf => fs.writeFileSync("interview_kit.docx", buf));
"""


