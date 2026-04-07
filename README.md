# NovaTeck DFW Tech Job Tracker — Sprint 3 MVP
**Group 4 | CSCE 4901 Capstone I**
Suraj Tamang · Shubekshya Acharya · Mani Raju Kumar Velagapudi · Udij Biplavi

---

## Quick Setup

### 1. MySQL — Apply the schema
```bash
mysql -u root -p < database/novatek_schema_v2.sql
```

### 2. Backend — Install dependencies
```bash
cd backend
pip3 install flask flask-cors bcrypt pyjwt python-dotenv mysql-connector-python --break-system-packages
```

### 3. Backend — Create your .env file
```bash
cp .env.example .env
# Edit .env with your MySQL username and password
```

### 4. Seed the database (51 jobs + NLP skill tagging)
```bash
python3 seed_jobs.py
```

### 5. Run the Flask API
```bash
python3 app.py
# Runs on http://127.0.0.1:5000
```

### 6. Frontend — Install and run (new terminal)
```bash
cd ../frontend
npm install
npm run dev
# Runs on http://localhost:3000
# Open in Safari — Chrome blocks localhost on Mac
```

---

## Demo Login
- **Email:** student@test.com
- **Password:** test1234

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register new user |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/jobs | No | List jobs (filter: skill, location) |
| GET | /api/jobs/:id | No | Job detail + skills |
| POST | /api/saved-jobs | JWT | Save a job |
| DELETE | /api/saved-jobs/:id | JWT | Remove saved job |
| GET | /api/students/:id/saved-jobs | JWT | Get user's saved jobs |
| GET | /api/students/:id/skill-gap | JWT | Skill gap analysis |
| PUT | /api/students/:id/skills | JWT | Update user skills |
| GET | /api/companies | No | List companies |

---

## Demo Flow
1. Register new account → enter skills (Python, SQL, React)
2. Login
3. Browse Job Listings → filter by "Python"
4. Open a Job Detail page
5. Save the job
6. Go to Dashboard → see saved job in list
7. Go to Skill Gap → see progress bars + missing skills chart

---

## Project Structure
```
Novateck2/
├── database/
│   └── novatek_schema_v2.sql
├── backend/
│   ├── app.py            Flask API (all endpoints)
│   ├── db.py             CRUD operations (Module 4.0)
│   ├── nlp_tagger.py     NLP skill tagger (Module 3.0)
│   ├── seed_jobs.py      51 seed jobs + NLP pipeline
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## Team Responsibilities

| Member | Module | Sprint 3 Deliverable |
|--------|--------|---------------------|
| Suraj Tamang | 1.0 & 2.0 | Web crawler → JSON output for 3 companies |
| Shubekshya Acharya | 4.0 | Schema v2, db.py, seed_jobs.py |
| Mani Raju Kumar Velagapudi | 3.0 | nlp_tagger.py + Flask API endpoints |
| Udij Biplavi | 5.0 | React frontend (6 screens) |

---

## Mac-Specific Notes
- Use `python3` instead of `python` and `pip3` instead of `pip`
- Use `pip3 install ... --break-system-packages` if you get an externally-managed-environment error
- Open the app in **Safari** or use `http://127.0.0.1:3000` — Chrome blocks localhost on Mac
- In `vite.config.js` the proxy must point to `http://127.0.0.1:5000` not `localhost:5000`