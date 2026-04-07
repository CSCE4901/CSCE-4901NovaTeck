"""
NovaTeck DFW Tech Job Tracker
CRUD Operations — Module 4.0
Developer: Shubekshya Acharya
Sprint 3 — April 2026

HOW TO USE:
    1. Create a .env file in your project root (see .env.example)
    2. pip install mysql-connector-python python-dotenv bcrypt
    3. import db  then call db.insert_job(...) etc.
"""

import os
import logging
from contextlib import contextmanager
import mysql.connector
from mysql.connector import Error

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DB_CONFIG = {
    "host":               os.environ.get("DB_HOST", "localhost"),
    "port":               int(os.environ.get("DB_PORT", 3306)),
    "database":           os.environ.get("DB_NAME", "novatek_db"),
    "user":               os.environ.get("DB_USER"),
    "password":           os.environ.get("DB_PASSWORD"),
    "connection_timeout": 10,
}


@contextmanager
def get_connection():
    conn = None
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        yield conn
    except Error as e:
        log.error(f"DB connection error: {e}")
        raise
    finally:
        if conn and conn.is_connected():
            conn.close()


# ==================================================================
# COMPANIES
# ==================================================================

def insert_company(name, website_url=None, location=None, industry=None):
    sql = "INSERT IGNORE INTO Companies (name, website_url, location, industry) VALUES (%s, %s, %s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (name, website_url, location, industry))
            conn.commit()
            if cur.lastrowid:
                return cur.lastrowid
            cur.execute("SELECT company_id FROM Companies WHERE name = %s", (name,))
            row = cur.fetchone()
            return row[0] if row else None
    except Error as e:
        log.error(f"insert_company failed: {e}")
        return None


def get_company(company_id):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Companies WHERE company_id = %s", (company_id,))
            return cur.fetchone()
    except Exception as e:
        log.error(f"get_company failed: {e}")
        return None


def get_all_companies():
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Companies ORDER BY name")
            return cur.fetchall()
    except Error as e:
        log.error(f"get_all_companies failed: {e}")
        return []


# ==================================================================
# JOBS
# ==================================================================

def insert_job(company_id, title, source_url, description=None,
               location=None, job_type=None, salary_range=None, date_posted=None):
    sql = """
        INSERT IGNORE INTO Jobs
            (company_id, title, description, location, job_type, salary_range, source_url, date_posted)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (company_id, title, description, location,
                              job_type, salary_range, source_url, date_posted))
            conn.commit()
            if cur.lastrowid:
                log.info(f"Inserted job: '{title}' (id={cur.lastrowid})")
                return cur.lastrowid
            return None
    except Error as e:
        log.error(f"insert_job failed: {e}")
        return None


def get_jobs(skill=None, location=None, company_id=None, is_active=True, limit=50, offset=0):
    conditions = ["j.is_active = %s"]
    params = [is_active]

    if location:
        conditions.append("j.location LIKE %s")
        params.append(f"%{location}%")
    if company_id:
        conditions.append("j.company_id = %s")
        params.append(company_id)
    if skill:
        conditions.append("""
            j.job_id IN (
                SELECT js.job_id FROM Job_Skills js
                JOIN Skills s ON js.skill_id = s.skill_id
                WHERE s.skill_name LIKE %s
            )
        """)
        params.append(f"%{skill}%")

    where = " AND ".join(conditions)
    sql = f"""
        SELECT j.*, c.name AS company_name
        FROM Jobs j
        JOIN Companies c ON j.company_id = c.company_id
        WHERE {where}
        ORDER BY j.date_posted DESC
        LIMIT %s OFFSET %s
    """
    params.extend([limit, offset])

    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(sql, params)
            return cur.fetchall()
    except Error as e:
        log.error(f"get_jobs failed: {e}")
        return []


def get_job_by_id(job_id):
    job_sql = """
        SELECT j.*, c.name AS company_name
        FROM Jobs j
        JOIN Companies c ON j.company_id = c.company_id
        WHERE j.job_id = %s
    """
    skills_sql = """
        SELECT s.skill_name, js.requirement_type
        FROM Job_Skills js
        JOIN Skills s ON js.skill_id = s.skill_id
        WHERE js.job_id = %s
        ORDER BY js.requirement_type
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(job_sql, (job_id,))
            job = cur.fetchone()
            if not job:
                return None
            cur.execute(skills_sql, (job_id,))
            job["skills"] = cur.fetchall()
            return job
    except Error as e:
        log.error(f"get_job_by_id failed: {e}")
        return None


def update_job(job_id, **fields):
    allowed = {"title", "description", "location", "job_type", "salary_range", "date_posted", "is_active"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    sql = f"UPDATE Jobs SET {set_clause} WHERE job_id = %s"
    params = list(updates.values()) + [job_id]
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"update_job failed: {e}")
        return False


def delete_job(job_id):
    return update_job(job_id, is_active=False)


# ==================================================================
# SKILLS
# ==================================================================

def insert_skill(skill_name, skill_type="technical"):
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "INSERT IGNORE INTO Skills (skill_name, skill_type) VALUES (%s, %s)",
                (skill_name, skill_type)
            )
            conn.commit()
            if cur.lastrowid:
                return cur.lastrowid
            cur.execute("SELECT skill_id FROM Skills WHERE skill_name = %s", (skill_name,))
            row = cur.fetchone()
            return row[0] if row else None
    except Error as e:
        log.error(f"insert_skill failed: {e}")
        return None


def link_job_skill(job_id, skill_id, requirement_type="required"):
    sql = "INSERT IGNORE INTO Job_Skills (job_id, skill_id, requirement_type) VALUES (%s, %s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (job_id, skill_id, requirement_type))
            conn.commit()
            return True
    except Error as e:
        log.error(f"link_job_skill failed: {e}")
        return False


# ==================================================================
# JOB SNAPSHOTS
# ==================================================================

def insert_snapshot(job_id, title=None, salary_range=None, is_active=True):
    sql = """
        INSERT INTO Job_Snapshots (job_id, snapshot_date, title, salary_range, is_active)
        VALUES (%s, CURDATE(), %s, %s, %s)
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (job_id, title, salary_range, is_active))
            conn.commit()
            return cur.lastrowid
    except Error as e:
        log.error(f"insert_snapshot failed: {e}")
        return None


def get_snapshots_for_job(job_id):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(
                "SELECT * FROM Job_Snapshots WHERE job_id = %s ORDER BY snapshot_date DESC",
                (job_id,)
            )
            return cur.fetchall()
    except Error as e:
        log.error(f"get_snapshots_for_job failed: {e}")
        return []


# ==================================================================
# USERS
# ==================================================================

def insert_user(name, email, password_hash, skills=None):
    sql = "INSERT IGNORE INTO Users (name, email, password_hash, skills) VALUES (%s, %s, %s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (name, email, password_hash, skills))
            conn.commit()
            if cur.lastrowid:
                log.info(f"Registered user: {email} (id={cur.lastrowid})")
                return cur.lastrowid
            log.warning(f"Email already registered: {email}")
            return None
    except Error as e:
        log.error(f"insert_user failed: {e}")
        return None


def get_user_by_email(email):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Users WHERE email = %s", (email,))
            return cur.fetchone()
    except Error as e:
        log.error(f"get_user_by_email failed: {e}")
        return None


def get_user_by_id(user_id):
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute("SELECT * FROM Users WHERE user_id = %s", (user_id,))
            return cur.fetchone()
    except Error as e:
        log.error(f"get_user_by_id failed: {e}")
        return None


def update_user(user_id, **fields):
    allowed = {"name", "skills", "resume_url"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return False
    set_clause = ", ".join(f"{k} = %s" for k in updates)
    sql = f"UPDATE Users SET {set_clause} WHERE user_id = %s"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, list(updates.values()) + [user_id])
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"update_user failed: {e}")
        return False


# ==================================================================
# USER SKILLS  (for skill gap analysis)
# ==================================================================

def add_user_skill(user_id, skill_id):
    """Link a skill to a user. Skips if already linked."""
    sql = "INSERT IGNORE INTO User_Skills (user_id, skill_id) VALUES (%s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id, skill_id))
            conn.commit()
            return True
    except Error as e:
        log.error(f"add_user_skill failed: {e}")
        return False


def get_user_skills(user_id):
    """Return list of skill name strings the user has."""
    sql = """
        SELECT s.skill_name
        FROM User_Skills us
        JOIN Skills s ON us.skill_id = s.skill_id
        WHERE us.user_id = %s
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id,))
            return [row[0] for row in cur.fetchall()]
    except Error as e:
        log.error(f"get_user_skills failed: {e}")
        return []


def set_user_skills_from_list(user_id, skill_names):
    """
    Clear existing user skills and replace with the given list.
    skill_names: list of strings e.g. ["Python", "SQL", "React"]
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM User_Skills WHERE user_id = %s", (user_id,))
            conn.commit()
        for name in skill_names:
            skill_id = insert_skill(name)
            if skill_id:
                add_user_skill(user_id, skill_id)
        return True
    except Error as e:
        log.error(f"set_user_skills_from_list failed: {e}")
        return False


# ==================================================================
# SAVED JOBS
# ==================================================================

def save_job(user_id, job_id):
    sql = "INSERT IGNORE INTO Saved_Jobs (user_id, job_id) VALUES (%s, %s)"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id, job_id))
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"save_job failed: {e}")
        return False


def remove_saved_job(user_id, job_id):
    sql = "DELETE FROM Saved_Jobs WHERE user_id = %s AND job_id = %s"
    try:
        with get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, (user_id, job_id))
            conn.commit()
            return cur.rowcount > 0
    except Error as e:
        log.error(f"remove_saved_job failed: {e}")
        return False


def get_saved_jobs(user_id):
    sql = """
        SELECT j.*, c.name AS company_name, sj.saved_at
        FROM Saved_Jobs sj
        JOIN Jobs j ON sj.job_id = j.job_id
        JOIN Companies c ON j.company_id = c.company_id
        WHERE sj.user_id = %s
        ORDER BY sj.saved_at DESC
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(sql, (user_id,))
            return cur.fetchall()
    except Error as e:
        log.error(f"get_saved_jobs failed: {e}")
        return []


# ==================================================================
# SKILL GAP ANALYSIS
# ==================================================================

def get_skill_gap(user_id, job_id):
    """
    Compare the user's skills against a job's required skills.
    Returns matched, missing, preferred, and match_pct.
    """
    user_skills = get_user_skills(user_id)

    # If user has no skills in User_Skills table, fall back to Users.skills column
    if not user_skills:
        user = get_user_by_id(user_id)
        if user and user.get("skills"):
            user_skills = [s.strip() for s in user["skills"].split(",")]

    job = get_job_by_id(job_id)
    if not job or not job.get("skills"):
        return {"matched": [], "missing": [], "preferred": [], "match_pct": 0}

    user_set = {s.strip().lower() for s in user_skills}

    job_required  = [s["skill_name"] for s in job["skills"] if s["requirement_type"] == "required"]
    job_preferred = [s["skill_name"] for s in job["skills"] if s["requirement_type"] == "preferred"]

    matched = [s for s in job_required if s.lower() in user_set]
    missing = [s for s in job_required if s.lower() not in user_set]
    total   = len(job_required)
    pct     = round((len(matched) / total) * 100) if total else 0

    return {
        "matched":        matched,
        "missing":        missing,
        "preferred":      job_preferred,
        "match_pct":      pct,
        "total_required": total,
    }


def get_student_skill_gap_summary(user_id):
    """
    Compare the user's skills against ALL active jobs to find the
    most-demanded missing skills across the entire DFW market.
    Returns top missing skills ranked by frequency.
    """
    user_skills = get_user_skills(user_id)
    if not user_skills:
        user = get_user_by_id(user_id)
        if user and user.get("skills"):
            user_skills = [s.strip() for s in user["skills"].split(",")]

    user_set = {s.strip().lower() for s in user_skills}

    sql = """
        SELECT s.skill_name, COUNT(*) AS demand_count
        FROM Job_Skills js
        JOIN Skills s ON js.skill_id = s.skill_id
        JOIN Jobs j ON js.job_id = j.job_id
        WHERE j.is_active = TRUE AND js.requirement_type = 'required'
        GROUP BY s.skill_name
        ORDER BY demand_count DESC
    """
    try:
        with get_connection() as conn:
            cur = conn.cursor(dictionary=True)
            cur.execute(sql)
            all_skills = cur.fetchall()

        missing_skills = [
            s for s in all_skills if s["skill_name"].lower() not in user_set
        ]
        matched_skills = [
            s for s in all_skills if s["skill_name"].lower() in user_set
        ]

        total_demand = sum(s["demand_count"] for s in all_skills)
        matched_demand = sum(s["demand_count"] for s in matched_skills)
        overall_pct = round((matched_demand / total_demand) * 100) if total_demand else 0

        return {
            "user_skills":     list(user_set),
            "missing_skills":  missing_skills[:10],
            "matched_skills":  matched_skills,
            "overall_match_pct": overall_pct,
        }
    except Error as e:
        log.error(f"get_student_skill_gap_summary failed: {e}")
        return {}
