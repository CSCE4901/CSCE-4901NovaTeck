"""
NovaTeck DFW Tech Job Tracker — Flask API
Module 3.0 Backend / Module 4.0 DB Integration
Sprint 3 MVP

Endpoints:
  POST   /api/auth/register
  POST   /api/auth/login
  GET    /api/jobs
  GET    /api/jobs/<job_id>
  POST   /api/saved-jobs
  DELETE /api/saved-jobs/<job_id>
  GET    /api/students/<user_id>/saved-jobs
  GET    /api/students/<user_id>/skill-gap
  PUT    /api/students/<user_id>/skills

Run:
  pip install flask flask-cors bcrypt pyjwt python-dotenv mysql-connector-python
  python app.py
"""

from dotenv import load_dotenv
load_dotenv()

import os
import jwt
import bcrypt
import datetime
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS

import db

app = Flask(__name__)
CORS(app)

JWT_SECRET  = os.environ.get("JWT_SECRET", "novateck_secret_dev_key")
JWT_EXPIRES = 24  # hours


# ------------------------------------------------------------------
# JWT helper
# ------------------------------------------------------------------

def create_token(user_id):
    payload = {
        "user_id": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return jsonify({"error": "Missing or invalid token"}), 401
        token = auth.split(" ", 1)[1]
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
            request.user_id = payload["user_id"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def _serialize(obj):
    """Convert non-JSON-serializable types (e.g. date) to strings."""
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    return str(obj)


def jsonify_safe(data):
    import json
    return app.response_class(
        response=json.dumps(data, default=_serialize),
        status=200,
        mimetype="application/json",
    )


# ------------------------------------------------------------------
# AUTH
# ------------------------------------------------------------------

@app.route("/api/auth/register", methods=["POST"])
def register():
    data     = request.get_json() or {}
    name     = data.get("name", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")
    skills   = data.get("skills", "")  # comma-separated string or list

    if not name or not email or not password:
        return jsonify({"error": "name, email, and password are required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    pw_hash = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    # Normalize skills to comma-separated string
    if isinstance(skills, list):
        skills_str = ",".join(skills)
    else:
        skills_str = skills

    user_id = db.insert_user(name, email, pw_hash, skills_str)
    if not user_id:
        return jsonify({"error": "Email already registered"}), 409

    # Populate User_Skills table from skills string
    if skills_str:
        skill_names = [s.strip() for s in skills_str.split(",") if s.strip()]
        db.set_user_skills_from_list(user_id, skill_names)

    token = create_token(user_id)
    return jsonify({"token": token, "user_id": user_id, "name": name}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json() or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "email and password are required"}), 400

    user = db.get_user_by_email(email)
    if not user:
        return jsonify({"error": "Invalid email or password"}), 401

    if not bcrypt.checkpw(password.encode(), user["password_hash"].encode()):
        return jsonify({"error": "Invalid email or password"}), 401

    token = create_token(user["user_id"])
    return jsonify({
        "token":   token,
        "user_id": user["user_id"],
        "name":    user["name"],
    }), 200


# ------------------------------------------------------------------
# JOBS
# ------------------------------------------------------------------

@app.route("/api/jobs", methods=["GET"])
def get_jobs():
    skill      = request.args.get("skill")
    location   = request.args.get("location")
    company_id = request.args.get("company_id", type=int)
    limit      = request.args.get("limit", 50, type=int)
    offset     = request.args.get("offset", 0, type=int)

    jobs = db.get_jobs(
        skill=skill,
        location=location,
        company_id=company_id,
        limit=min(limit, 100),
        offset=offset,
    )
    return jsonify_safe(jobs)


@app.route("/api/jobs/<int:job_id>", methods=["GET"])
def get_job(job_id):
    job = db.get_job_by_id(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify_safe(job)


# ------------------------------------------------------------------
# SAVED JOBS
# ------------------------------------------------------------------

@app.route("/api/saved-jobs", methods=["POST"])
@token_required
def save_job():
    data   = request.get_json() or {}
    job_id = data.get("job_id")
    if not job_id:
        return jsonify({"error": "job_id required"}), 400

    result = db.save_job(request.user_id, job_id)
    if result:
        return jsonify({"message": "Job saved"}), 201
    return jsonify({"message": "Already saved"}), 200


@app.route("/api/saved-jobs/<int:job_id>", methods=["DELETE"])
@token_required
def remove_saved_job(job_id):
    db.remove_saved_job(request.user_id, job_id)
    return jsonify({"message": "Removed"}), 200


@app.route("/api/students/<int:user_id>/saved-jobs", methods=["GET"])
@token_required
def get_saved_jobs(user_id):
    if request.user_id != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    jobs = db.get_saved_jobs(user_id)
    return jsonify_safe(jobs)


# ------------------------------------------------------------------
# STUDENT PROFILE & SKILLS
# ------------------------------------------------------------------

@app.route("/api/students/<int:user_id>", methods=["GET"])
@token_required
def get_student(user_id):
    if request.user_id != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    user = db.get_user_by_id(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    user.pop("password_hash", None)
    return jsonify_safe(user)


@app.route("/api/students/<int:user_id>/skills", methods=["PUT"])
@token_required
def update_skills(user_id):
    if request.user_id != user_id:
        return jsonify({"error": "Unauthorized"}), 403
    data   = request.get_json() or {}
    skills = data.get("skills", [])
    if isinstance(skills, str):
        skills = [s.strip() for s in skills.split(",") if s.strip()]

    db.set_user_skills_from_list(user_id, skills)
    db.update_user(user_id, skills=",".join(skills))
    return jsonify({"message": "Skills updated", "skills": skills}), 200


# ------------------------------------------------------------------
# SKILL GAP ANALYSIS
# ------------------------------------------------------------------

@app.route("/api/students/<int:user_id>/skill-gap", methods=["GET"])
@token_required
def skill_gap(user_id):
    if request.user_id != user_id:
        return jsonify({"error": "Unauthorized"}), 403

    job_id = request.args.get("job_id", type=int)

    if job_id:
        # Single-job skill gap
        result = db.get_skill_gap(user_id, job_id)
    else:
        # Full market skill gap summary
        result = db.get_student_skill_gap_summary(user_id)

    return jsonify_safe(result)


# ------------------------------------------------------------------
# COMPANIES
# ------------------------------------------------------------------

@app.route("/api/companies", methods=["GET"])
def get_companies():
    companies = db.get_all_companies()
    return jsonify_safe(companies)


# ------------------------------------------------------------------
# HEALTH CHECK
# ------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "project": "NovaTeck Sprint 3 MVP"}), 200


if __name__ == "__main__":
    app.run(debug=True, port=5000)
