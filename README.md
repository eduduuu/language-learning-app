# Bunmyaku 文脈

> **Read Japanese in Context — A local-first, privacy-respecting Japanese reading and SRS immersion platform.**

Read authentic Japanese literature (EPUB) and seamlessly turn text discoveries into spaced repetition flashcards (FSRS), grammar breakdowns, and contextual practice drills without sending copyrighted books to the cloud.


---

## 📖 Project Context & Architecture

For a comprehensive breakdown of the project's vision, design principles, architecture, feature inventory, and future roadmap, refer to:

👉 **[PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md)**

---

## 🚀 Quick Start

### 1. Backend (FastAPI + FSRS)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080 --reload
```

### 2. Frontend (React 18 + Vite + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏗️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS 3.4, `kuromoji` (Web Worker), `idb` (IndexedDB).
- **Backend:** FastAPI, Python 3.14, `py-fsrs` (Free Spaced Repetition Scheduler).
- **Database & Auth:** Supabase (PostgreSQL, GoTrue JWT Auth).
- **Deployments:** Frontend on **Vercel**, Backend on **Render**, DB on **Supabase**.
