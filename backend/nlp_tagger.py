"""
nlp_tagger.py  -  Sprint 3 NLP Skill Tagger
Author : Mani Raju Kumar Velagapudi
Project: NovaTeck - DFW Job Skills Matcher (CSCE 4901 Capstone I)
"""

import re

KNOWN_SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "ruby",
    "swift", "kotlin", "scala", "r", "matlab", "php", "rust",
    "react", "angular", "vue", "html", "css", "sass", "bootstrap", "tailwind",
    "next.js", "node.js", "express", "jquery",
    "flask", "django", "fastapi", "spring boot", "rest api", "graphql",
    "microservices", "api development",
    "mysql", "postgresql", "sqlite", "mongodb", "redis", "oracle", "sql server",
    "sql", "nosql", "database design",
    "aws", "azure", "gcp", "docker", "kubernetes", "ci/cd", "jenkins",
    "terraform", "linux", "bash", "git", "github",
    "machine learning", "deep learning", "nlp", "tensorflow", "pytorch",
    "scikit-learn", "pandas", "numpy", "data analysis", "data visualization",
    "tableau", "power bi", "excel",
    "agile", "scrum", "jira", "communication", "teamwork", "problem solving",
    "project management",
]

REQUIRED_SIGNALS = [
    r"\brequired\b", r"\bmust\s+have\b", r"\bmust\s+be\b",
    r"\bminimum\b",  r"\bessential\b",   r"\bmandatory\b",
    r"\bnecessary\b", r"\bexpected\b",
]

PREFERRED_SIGNALS = [
    r"\bpreferred\b", r"\bnice\s+to\s+have\b", r"\ba\s+plus\b",
    r"\bbonus\b",     r"\bdesired\b",           r"\bwould\s+be\s+an\s+asset\b",
    r"\badvantage\b", r"\bideal\b",
]

_REQUIRED_RE  = re.compile("|".join(REQUIRED_SIGNALS),  re.IGNORECASE)
_PREFERRED_RE = re.compile("|".join(PREFERRED_SIGNALS), re.IGNORECASE)

_REQUIRED_SECTION_RE = re.compile(
    r"(required\s+(qualifications?|skills?|experience)|"
    r"minimum\s+(qualifications?|requirements?)|"
    r"what\s+you('ll)?\s+(need|bring)|"
    r"you\s+must\s+have)",
    re.IGNORECASE,
)

_PREFERRED_SECTION_RE = re.compile(
    r"(preferred\s+(qualifications?|skills?|experience)|"
    r"nice\s+to\s+have|"
    r"bonus\s+(points?|skills?)|"
    r"what\s+would\s+be\s+(great|a\s+plus))",
    re.IGNORECASE,
)


def _split_into_sections(text):
    """Return list of (section_tag, line) where tag is 'required'/'preferred'/'unknown'."""
    lines = text.splitlines()
    current_tag = "unknown"
    sections = []
    for line in lines:
        if _REQUIRED_SECTION_RE.search(line):
            current_tag = "required"
        elif _PREFERRED_SECTION_RE.search(line):
            current_tag = "preferred"
        sections.append((current_tag, line))
    return sections


def _tag_sentence(sentence, section_default):
    """Return 'required' or 'preferred' for one sentence."""
    if _REQUIRED_RE.search(sentence):
        return "required"
    if _PREFERRED_RE.search(sentence):
        return "preferred"
    if section_default in ("required", "preferred"):
        return section_default
    return "required"


def tag_skills_for_job(description):
    """
    Parse one job description string and return tagged skills.
    Returns list of dicts: [{"skill_name": "python", "requirement_type": "required"}, ...]
    """
    if not description:
        return []

    sections   = _split_into_sections(description)
    desc_lower = description.lower()
    tagged     = {}

    for section_tag, line in sections:
        line_lower = line.lower()
        for skill in KNOWN_SKILLS:
            pattern = r"\b" + re.escape(skill) + r"\b"
            if re.search(pattern, line_lower):
                tag = _tag_sentence(line, section_tag)
                if tagged.get(skill) == "required":
                    continue
                tagged[skill] = tag

    for skill in KNOWN_SKILLS:
        if skill in tagged:
            continue
        pattern = r"\b" + re.escape(skill) + r"\b"
        if re.search(pattern, desc_lower):
            tagged[skill] = "required"

    return [{"skill_name": s, "requirement_type": t} for s, t in tagged.items()]


def run_pipeline():
    """
    Fetch every job from the database, run NLP tagging on each description,
    and write results to the Skills + Job_Skills tables.
    """
    import db
    print("[nlp_tagger] Starting NLP pipeline...")

    jobs = db.get_jobs()
    if not jobs:
        print("[nlp_tagger] No jobs found. Run the crawler first.")
        return

    total_tagged = 0

    for job in jobs:
        job_id      = job.get("job_id")
        description = job.get("description", "")

        if not description:
            print(f"[nlp_tagger] Job {job_id}: no description, skipping.")
            continue

        skills = tag_skills_for_job(description)

        for item in skills:
            skill_name       = item["skill_name"]
            requirement_type = item["requirement_type"]

            skill_id = db.insert_skill(skill_name)
            if not skill_id:
                print(f"[nlp_tagger] Warning: could not insert skill '{skill_name}'")
                continue

            db.link_job_skill(
                job_id=job_id,
                skill_id=skill_id,
                requirement_type=requirement_type,
            )
            total_tagged += 1

        print(f"[nlp_tagger] Job {job_id}: tagged {len(skills)} skills.")

    print(f"[nlp_tagger] Done. Total skill tags inserted: {total_tagged}")


if __name__ == "__main__":
    sample = """
Software Engineer - DFW

Required Qualifications:
- 2+ years of experience with Python and SQL
- Experience with REST API development using Flask or Django
- Proficiency in Git and Linux environments

Preferred Qualifications:
- Experience with React or Angular for frontend development
- Familiarity with AWS or Azure cloud platforms
- Knowledge of Docker and CI/CD pipelines
"""
    print("=== NLP Tagger - Standalone Test ===\n")
    results = tag_skills_for_job(sample)
    required  = [r for r in results if r["requirement_type"] == "required"]
    preferred = [r for r in results if r["requirement_type"] == "preferred"]
    print(f"REQUIRED  ({len(required)}):")
    for r in required:
        print(f"  - {r['skill_name']}")
    print(f"\nPREFERRED ({len(preferred)}):")
    for r in preferred:
        print(f"  - {r['skill_name']}")
