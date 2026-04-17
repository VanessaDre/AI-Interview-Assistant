"""GDPR Anonymization Service – removes all PII from CV text before AI processing."""

import re
from typing import Tuple

EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', re.IGNORECASE)
PHONE_PATTERN = re.compile(r'(?:\+\d{1,3}[\s\-]?)?(?:\(?\d{2,5}\)?[\s\-]?)[\d\s\-/]{4,12}\d', re.IGNORECASE)
URL_PATTERN = re.compile(r'(?:https?://|www\.)[^\s,;)>\]]+', re.IGNORECASE)
SOCIAL_MEDIA_PATTERN = re.compile(r'(?:linkedin\.com|github\.com|xing\.com|twitter\.com|x\.com|instagram\.com|facebook\.com|medium\.com|stackoverflow\.com|behance\.net|dribbble\.com|gitlab\.com|bitbucket\.org)[/\w.\-@]*', re.IGNORECASE)
DATE_OF_BIRTH_PATTERN = re.compile(r'(?:geboren|geb\.|geb:|geburtsdatum|date\s*of\s*birth|dob|birth\s*date|geburtstag)\s*[:.]?\s*[\d]{1,2}[./\-][\d]{1,2}[./\-][\d]{2,4}', re.IGNORECASE)
ADDRESS_STREET_PATTERN = re.compile(r'[A-ZÄÖÜ][a-zäöüß]+(?:straße|strasse|str\.|weg|gasse|allee|platz|ring|damm|ufer|chaussee|avenue|road|street|lane|drive|boulevard)\s*\d{1,4}\s*[a-zA-Z]?', re.IGNORECASE)
ADDRESS_CITY_PATTERN = re.compile(r'\b\d{5}\s+[A-ZÄÖÜ][a-zäöüß]+(?:\s+[a-zäöüß]+)*\b')
PO_BOX_PATTERN = re.compile(r'(?:postfach|p\.?\s*o\.?\s*box)\s*\d*', re.IGNORECASE)
IBAN_PATTERN = re.compile(r'\b[A-Z]{2}\d{2}\s?(?:\d{4}\s?){4,8}\d{0,4}\b', re.IGNORECASE)
TAX_ID_PATTERN = re.compile(r'(?:steuer[\-\s]?id|tin|steuernummer|st[\-\s]?nr)[\s:.]?\s*\d{10,13}', re.IGNORECASE)
FAMILY_STATUS_PATTERN = re.compile(r'(?:familienstand|marital\s*status)\s*[:.]?\s*(?:ledig|verheiratet|geschieden|verwitwet|single|married|divorced|widowed|eingetragene\s+lebenspartnerschaft|in\s+partnerschaft)', re.IGNORECASE)
CHILDREN_PATTERN = re.compile(r'(?:kinder|children)\s*[:.]?\s*(?:\d+|keine|none|yes|ja|nein|no)', re.IGNORECASE)
NATIONALITY_PATTERN = re.compile(r'(?:nationalität|staatsangehörigkeit|staatsbürgerschaft|nationality|citizenship)\s*[:.]?\s*[A-ZÄÖÜa-zäöüß]+(?:\s+[A-ZÄÖÜa-zäöüß]+)?', re.IGNORECASE)
GENDER_PATTERN = re.compile(r'(?:geschlecht|gender|sex)\s*[:.]?\s*(?:männlich|weiblich|divers|male|female|non[\-\s]?binary|m/w/d)', re.IGNORECASE)
AGE_PATTERN = re.compile(r'(?:alter|age)\s*[:.]?\s*\d{1,3}\s*(?:jahre|years|j\.)?', re.IGNORECASE)
SIGNATURE_PATTERN = re.compile(r'(?:unterschrift|signatur|signature|mit\s+freundlichen\s+grüßen|best\s+regards|kind\s+regards|hochachtungsvoll|mfg)\s*[,:]?\s*.*$', re.IGNORECASE | re.MULTILINE)

PII_HEADER_LABELS = [
    "persönliche daten", "personal data", "personal details",
    "personal information", "kontaktdaten", "contact details",
    "contact information", "kontakt", "contact", "about me",
    "über mich", "profil", "profile",
]


def anonymize_cv_text(text: str) -> Tuple[str, dict]:
    """Removes all PII from CV text. Returns (anonymized_text, report)."""
    report = {
        "emails_removed": 0, "phones_removed": 0, "urls_removed": 0,
        "social_profiles_removed": 0, "addresses_removed": 0,
        "dates_of_birth_removed": 0, "ids_removed": 0,
        "personal_details_removed": 0, "signatures_removed": 0,
    }
    a = text

    report["social_profiles_removed"] = len(SOCIAL_MEDIA_PATTERN.findall(a))
    a = SOCIAL_MEDIA_PATTERN.sub("[SOCIAL-PROFILE-REMOVED]", a)
    report["urls_removed"] = len(URL_PATTERN.findall(a))
    a = URL_PATTERN.sub("[URL-REMOVED]", a)
    report["emails_removed"] = len(EMAIL_PATTERN.findall(a))
    a = EMAIL_PATTERN.sub("[EMAIL-REMOVED]", a)
    report["ids_removed"] += len(IBAN_PATTERN.findall(a))
    a = IBAN_PATTERN.sub("[IBAN-REMOVED]", a)
    report["ids_removed"] += len(TAX_ID_PATTERN.findall(a))
    a = TAX_ID_PATTERN.sub("[TAX-ID-REMOVED]", a)
    report["dates_of_birth_removed"] = len(DATE_OF_BIRTH_PATTERN.findall(a))
    a = DATE_OF_BIRTH_PATTERN.sub("[DOB-REMOVED]", a)

    addr_count = len(ADDRESS_STREET_PATTERN.findall(a)) + len(ADDRESS_CITY_PATTERN.findall(a)) + len(PO_BOX_PATTERN.findall(a))
    report["addresses_removed"] = addr_count
    a = ADDRESS_STREET_PATTERN.sub("[ADDRESS-REMOVED]", a)
    a = ADDRESS_CITY_PATTERN.sub("[CITY-REMOVED]", a)
    a = PO_BOX_PATTERN.sub("[PO-BOX-REMOVED]", a)

    report["phones_removed"] = len(PHONE_PATTERN.findall(a))
    a = PHONE_PATTERN.sub("[PHONE-REMOVED]", a)

    personal_count = 0
    for pattern, label in [(FAMILY_STATUS_PATTERN, "[FAMILY-STATUS-REMOVED]"), (CHILDREN_PATTERN, "[CHILDREN-REMOVED]"), (NATIONALITY_PATTERN, "[NATIONALITY-REMOVED]"), (GENDER_PATTERN, "[GENDER-REMOVED]"), (AGE_PATTERN, "[AGE-REMOVED]")]:
        found = len(pattern.findall(a))
        personal_count += found
        a = pattern.sub(label, a)
    report["personal_details_removed"] = personal_count

    report["signatures_removed"] = len(SIGNATURE_PATTERN.findall(a))
    a = SIGNATURE_PATTERN.sub("[SIGNATURE-REMOVED]", a)

    lines = a.split("\n")
    cleaned_lines = []
    for line in lines:
        if line.strip().lower().rstrip(":") in PII_HEADER_LABELS:
            continue
        cleaned_lines.append(line)
    a = "\n".join(cleaned_lines)

    a = _anonymize_probable_name(a, report)
    a = re.sub(r'\n{3,}', '\n\n', a).strip()
    return a, report


def _anonymize_probable_name(text: str, report: dict) -> str:
    lines = text.split("\n")
    new_lines = []
    name_found = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if i < 10 and stripped and not name_found:
            if re.match(r'^(?:(?:Dr|Prof|Dipl|Ing|M\.?A|B\.?A|M\.?Sc|B\.?Sc)\.?\s+)?[A-ZÄÖÜ][a-zäöüß]+(?:[\-\s][A-ZÄÖÜ][a-zäöüß]+){1,3}\s*$', stripped):
                new_lines.append("[NAME-REMOVED]")
                name_found = True
                report["personal_details_removed"] = report.get("personal_details_removed", 0) + 1
                continue
        new_lines.append(line)
    return "\n".join(new_lines)


def format_anonymization_report(report: dict) -> str:
    parts = []
    if report["emails_removed"]: parts.append(f"{report['emails_removed']}x Email")
    if report["phones_removed"]: parts.append(f"{report['phones_removed']}x Phone")
    if report["urls_removed"]: parts.append(f"{report['urls_removed']}x URL")
    if report["social_profiles_removed"]: parts.append(f"{report['social_profiles_removed']}x Social")
    if report["addresses_removed"]: parts.append(f"{report['addresses_removed']}x Address")
    if report["dates_of_birth_removed"]: parts.append(f"{report['dates_of_birth_removed']}x DOB")
    if report["ids_removed"]: parts.append(f"{report['ids_removed']}x ID")
    if report["personal_details_removed"]: parts.append(f"{report['personal_details_removed']}x Personal")
    if report["signatures_removed"]: parts.append(f"{report['signatures_removed']}x Signature")
    return f"Removed: {', '.join(parts)}" if parts else "No PII found"
