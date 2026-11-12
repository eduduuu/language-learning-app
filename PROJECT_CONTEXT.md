# Context Reader — Project Blueprint & Context

> **A local-first, privacy-respecting contextual reading and language-learning platform.**

---

## 1. Executive Summary

**Context Reader** is an advanced language learning application designed to bridge the gap between textbook study and native literature immersion. Instead of memorizing isolated word lists, users read authentic literature (currently Japanese light novels, manga transcripts, and literature via EPUB files). 

The platform turns discoveries inside the text directly into spaced repetition flashcards, grammar profiles, and adaptive quizzes.

### Core Value Propositions
* **Local-First & Zero-Copyright Risk:** Raw books, chapters, and sentences are parsed and stored entirely on the client's device (browser IndexedDB). No copyrighted text, full paragraphs, or full files ever touch the backend.
* **Deterministic & Zero-LLM First:** Tokenization, dictionary lookups, and grammar clozes rely on fast, local algorithms (`kuromoji.js` Web Worker, cached public dictionaries, deterministic regex grammar engines). AI is only invoked for optional, targeted features.
* **Next-Gen Spaced Repetition:** Uses the **FSRS** (Free Spaced Repetition Scheduler) algorithm rather than legacy Anki SM-2.
* **Refined Typography & Dark Aesthetic:** Built on Tailwind CSS with **DM Serif Display** for headings, **Noto Sans JP** for native Japanese typography, and a sleek `zinc-950` + `amber-400` theme.

---

## 2. Feature Inventory

### 📚 Local-First EPUB Ingestion & Storage
- **Client-Side Extraction:** Books are decompressed and parsed in the browser via `jszip` and `@likecoin/epub-ts`.
- **IndexedDB Persistence:** Chapters, sentences, tokens, and reading position are saved in browser IndexedDB via `idb`.
- **Library Management:** Status tracking (*Learning*, *On Hold*, *Completed*), cover previews, mastery percentages, and book metadata.

### 🔍 Interactive Morphological Reader
- **Kuromoji.js Web Worker:** In-browser morphological analyzer segmenting unspaced Japanese text into words, lemmas, readings, and parts of speech.
- **Word Lookup & Caching:** Click any Japanese word to inspect definitions and readings from Jisho with client-side caching and lookup frequency tracking (`Looked up N×`).
- **Adaptive Furigana Modes:**
  - `all`: Furigana ruby annotations above all kanji.
  - `unknown_only`: Furigana displayed only for words not yet mastered in the user's SRS deck.
  - `none`: Native immersion mode without furigana.
- **Visual SRS Heatmap:** Color overlays across words reflecting their current review state (New, Learning, Mastered).
- **On-Demand Sentence Translation:** Double-click any sentence to isolate and translate it without sending entire paragraphs or pages to an external server.
- **Bookmark & Scroll Tracking:** `IntersectionObserver` preserves reading progress per chapter and paragraph.
- **Responsive Layout:** 3-column desktop layout (Chapters | Text | WordPanel) and mobile hamburger drawer with floating bottom sheet (`max-h-[70vh]`).

### 🧠 Contextual Spaced Repetition (FSRS)
- **FSRS Mathematical Engine:** Backend runs the modern Free Spaced Repetition Scheduler (`fsrs` Python package) tracking card stability, difficulty, retrievability, and elapsed days.
- **Contextual Formats:**
  - *Sentence Context:* Tests target vocabulary within authentic book sentences or JLPT example sentences.
  - *Single Word:* Traditional front/back flashcard.
- **4-Grade Review System:** *Again* (1), *Hard* (2), *Good* (3), *Easy* (4).
- **Daily Review Limits:** Configurable maximum new cards per day in user preferences.

### 🗃️ Deck & Card Manager (Two-Way Anki Integration)
- **Card Inspection Table:** Search and filter cards by text, learning status (New, Learning, Mastered, Relearning), or originating book.
- **Batch Actions:** Reset to new, mark as mastered, reschedule (+1, +7, +30 days or custom date picker), and bulk delete.
- **Two-Way Anki Sync:**
  - Export decks to Anki TSV/APKG format (with or without scheduling progress).
  - Import Anki TSV/CSV cards with preview modal.

### 🎯 Adaptive Grammar Engine & Quiz Hub
- **Deterministic Grammar Scanner:** Scans uploaded books for JLPT N5–N1 grammar patterns without external API calls.
- **"About Book" Linguistic Profile:** Visual breakdown of kanji/vocabulary complexity and distribution curves.
- **Dual-Mode Grammar Quizzes:**
  - Curated JLPT Grammar point multiple-choice drills.
  - Zero-LLM Context Cloze & Verb Conjugation drills built dynamically from sentences in your active book.
- **Adaptive "Needs Practice" Engine:** Identifies grammar themes with low accuracy and serves targeted remediation.

### 📊 Analytics & Insights
- Real-time metrics: Reading streak, total words mastered, reviews due today, quiz accuracy rate, and mastery progress bars grouped by grammar theme.

---

## 3. Technology Stack

### Frontend
- **Framework:** React 18.2 + TypeScript 5.2
- **Build Tool:** Vite 5.1
- **Styling:** Tailwind CSS 3.4
- **Typography:** DM Serif Display, Noto Sans JP, Inter, JetBrains Mono
- **Icons:** Lucide React
- **Linguistics:** `kuromoji` (via Web Worker `tokenize.worker.ts`)
- **File Parsing:** `jszip`, `@likecoin/epub-ts`
- **Storage:** Browser IndexedDB via `idb`
- **HTTP Client:** `axios` with JWT request interceptors
- **Hosting:** Vercel

### Backend
- **Framework:** FastAPI 0.116 (Python 3.14)
- **ASGI Server:** Uvicorn
- **Spaced Repetition Algorithm:** `fsrs` Python library
- **Authentication:** Supabase Auth (JWT Bearer tokens)
- **Database:** Supabase PostgreSQL (managed schemas: `profiles`, `srs_cards`, `quiz_logs`, `word_lookups`)
- **Hosting:** Render

---

## 4. Architectural Design & Philosophy

```
+-------------------------------------------------------------------------+
|                              CLIENT BROWSER                              |
|                                                                         |
|  [EPUB Files] ---> [JSZip / epub-ts] ---> [Kuromoji Web Worker]         |
|                                                    |                    |
|                                                    v                    |
|  [Reader Canvas] <------------------------ [IndexedDB Storage]          |
|  * Interactive Tokens                      * Books & Chapters           |
|  * Adaptive Furigana                       * Sentences & Word Map       |
|  * Reading Bookmarks                       * Local Lookup Cache         |
|  * Zero Server Text Exposure                                            |
|         |                                                               |
|         | Word Lookups (Jisho Cached)                                   |
|         | SRS Flashcard Creation & Review Actions                       |
+---------|---------------------------------------------------------------+
          |
          | HTTPS + JWT Auth (Bearer token)
          v
+-------------------------------------------------------------------------+
|                               CLOUD BACKEND                             |
|                                                                         |
|  [FastAPI / Render]                                                     |
|  * /api/v1/vocab/review   ---> [FSRS Scheduler]                         |
|  * /api/v1/vocab/card     ---> [Card Manager]                           |
|  * /api/v1/analytics      ---> [Aggregated Stats]                       |
|         |                                                               |
|         v                                                               |
|  [Supabase PostgreSQL]                                                  |
|  * Only stores isolated words, definitions, review dates, and stats     |
|  * NEVER stores complete book chapters, paragraphs, or full text        |
+-------------------------------------------------------------------------+
```

### Key Architectural Decisions
1. **Local-First Book Processing:** Book files and extracted paragraphs are strictly client-side to ensure compliance with copyright, avoid costly server storage, and enable offline reading.
2. **Deterministic-First Processing:** Kuromoji tokenization and grammar clozes are executed with deterministic algorithms rather than generative LLM calls to reduce latency, cost, and hallucination risks.
3. **Stateless API with Supabase Tokens:** The FastAPI backend relies on Supabase Auth JWTs passed via `Authorization: Bearer <token>`, validating user identity statelessly on every request.

---

## 5. Development & Deployment

### Local Development Setup

#### Backend (`/backend`)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 127.0.0.1 --port 8080 --reload
```

#### Frontend (`/frontend`)
```bash
cd frontend
npm install
npm run dev
# Running on http://localhost:5173
```

#### Environment Variables
- `frontend/.env`:
  - `VITE_API_BASE_URL`: `http://127.0.0.1:8080/api/v1` (local) or Render URL (production)
  - `VITE_SUPABASE_URL`: Supabase project URL
  - `VITE_SUPABASE_ANON_KEY`: Supabase public anon key
- `backend/.env`:
  - `SUPABASE_URL`: Supabase project URL
  - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
  - `CORS_ORIGINS`: Allowed origins (e.g. `http://localhost:5173`, Vercel domain)

---

## 6. Future Roadmap

### Phase 1: Near-Term Enhancements
- [ ] **Federated Auth & Recovery:** Enable Google OAuth login in Supabase and automated password reset workflows.
- [ ] **Offline Sync Queue:** Queue SRS card reviews in IndexedDB when offline, automatically flushing them upon network restoration.
- [ ] **Bundle Splitting:** Optimize Rollup bundle chunks in `vite.config.js` to isolate Kuromoji dictionaries from the main bundle.
- [ ] **Enhanced TTS:** Add neural speech synthesis for Japanese vocabulary and sentences.

### Phase 2: Platform Expansion

#### 1. ArXiv Scientific Paper Reader & Research Companion
- **ArXiv Paper Ingestion:** Search and fetch research papers directly from arXiv (PDF, HTML, LaTeX).
- **Domain Jargon Tooltips:** LLM-powered explanations of technical terms (e.g. in machine learning, mathematics, bioinformatics).
- **Mathematical Formula Breakdown:** Click mathematical expressions (e.g., $\mathcal{L}_{G} + \lambda \mathcal{L}_{reg}$) to trigger interactive AI explanations of their components and mathematical rationale.
- **Concept Spaced Repetition:** Generate flashcards for mathematical definitions, theorems, and domain concepts.

#### 2. Professional & Technical Language (e.g., Aviation English for Pilots)
- **Targeted Lexicon:** Curated vocabulary for ICAO/ANAC English proficiency exams (standard phraseology, emergency communications, METAR/TAF weather decodes).
- **Radiotelephony Listening Drills:** Audio clozes testing comprehension of Air Traffic Control communications under simulated radio noise.
- **Cockpit Roleplay Drills:** Interactive voice AI acting as Air Traffic Control in emergency scenarios.

#### 3. Custom Dictionary Support
- Support importing standard Yomichan / EPWING dictionary archives (JMdict, KANJIDIC, Kenkyusha, Daijirin) into IndexedDB for offline lookups.
