# 🌌 SkillOrbit — AI Learning Platform

SkillOrbit is a full-stack, local-first interactive learning platform designed to teach practical AI workflow skills through bite-sized missions, hands-on practice, immediate feedback, and spaced repetition.

Inspired by **Duolingo** (progression, XP rewards, bite-sized lessons) and **Instagram** (discovery feed, visual lesson cards, bookmarking), wrapped in a **Cosmic Orbit** dark theme with an interactive **Three.js 3D Companion Robot (Orbit-1)** and **3D Celestial Orbit Map**.

---

## ⚡ Quick Start (One Click)

### Option 1: Double-click launcher
Double-click `start.bat` in this folder. It automatically launches both the backend and frontend in separate windows and opens your browser.

### Option 2: Run manually from terminal

**Terminal 1 — Backend (FastAPI)**:
```powershell
cd backend
python main.py
```
*Backend runs on `http://localhost:8000` (API Docs at `http://localhost:8000/docs`)*

**Terminal 2 — Frontend (React + Vite)**:
```powershell
cd frontend
npm run dev
```
*Open your browser at `http://localhost:5173`*

---

## 🧭 Audiences & 12 Complete Lessons

SkillOrbit features **4 distinct audience paths** and **12 complete lessons** with full content across **5 Indian languages** (English, हिन्दी, తెలుగు, தமிழ், ಕನ್ನಡ):

### 🏗️ Shared Core Foundations (All Paths)
1. **F1: What AI Can and Cannot Do** — Specifying Goal, Context, Constraints, and Output format.
2. **F2: Giving Examples & Iterating** — Few-shot prompting and multi-round iterative refinement.
3. **F3: Checking Answers & Spotting Claims** — Detecting AI hallucinations, unsupported claims, and precise statistics.
4. **F4: Protecting Privacy & Spotting Tricks** — Redacting sensitive personal data (Aadhaar, passwords, API keys) and spotting prompt injection.

### 🎯 Path-Specific Missions
- **💼 Working Professionals**:
  - `m_pro_email`: Rewrite a poorly structured project deadline email into a professional, empathetic communication.
  - `m_pro_meeting`: Turn raw, messy standup notes into an actionable, prioritized task list with owners and deadlines.
- **🎬 Content Creators**:
  - `m_creator_script`: Develop a 60-second video script with hook, body, and CTA for short-form video.
  - `m_creator_repurpose`: Repurpose a source article into an engaging social media post without inventing claims.
- **🎓 College Beginners**:
  - `m_college_revision`: Build a structured 7-day study revision plan from lecture notes with practice activities.
  - `m_college_coding`: Ask AI for debugging assistance and critically evaluate code explanations with step-by-step tracing.
- **📚 School Students**:
  - `m_school_explain`: Explain photosynthesis using a familiar cooking analogy with simple language.
  - `m_school_problem`: Solve a budget math problem step by step using AI hints instead of copied answers.

---

## 🌟 Key Features

1. **3D Interactive Companion (Orbit-1)**:
   - Built with **Three.js** featuring custom metallic materials, glowing emissive cyan visor, pulsing antenna light, and orbiting moonlet.
   - Interactive: click to poke/tickle Orbit-1 for tips and speech bubbles.
   - Expressive moods: *idle* (gentle floating), *thinking* (visor pulse during tasks), *celebrating* (rapid bounce & happy green eyes upon passing).
   - Fully accessible: automatically detects `prefers-reduced-motion` or missing WebGL to provide a crisp 2D animated SVG fallback.

2. **3D Cosmic Orbit Map**:
   - Interactive 3D celestial visualization of your learning journey: central glowing AI Core with inner orbits for Foundations and outer orbits for Path Missions.
   - Raycasting hover & click: hover over any celestial planet to see its preview tooltip; click to launch directly into the lesson.
   - 1-click toggle between **🌌 3D Solar Orbit** and **🗺️ 2D Constellation Grid**.

3. **7-Phase Learning Journey**:
   - **Explanation**: Plain-language concept breakdown.
   - **Worked Example**: Real scenario showing *Weak Attempt* vs *Strong Attempt* with an explanation of *Why It's Better*.
   - **Interactive Task**: Practice drafting prompts with starter text, live character counters, and collapsible hints.
   - **Practice & Feedback**: Dual-labeled transparent feedback (`[Rule-based feedback]` and `[Demo AI — simulated response]`).
   - **Understanding Checks**: 2 multiple-choice knowledge checks per lesson with immediate explanations.
   - **Retry & Revision**: Specific retry guidance for partial or weak attempts.
   - **Recap & Glossary**: Key takeaways and bilingual plain-language vocabulary definitions.

4. **Spaced Repetition Review Schedule**:
   - Automatic review scheduling based on the Leitner spaced review intervals (1, 3, 7, 14, 30 days).
   - Rate recall difficulty to adjust future review intervals.

5. **Saved Items & Personal Notebook**:
   - Save lessons and worked examples with tags (`⭐ Useful`, `🔥 Difficult`, `📅 Review Later`).
   - Add personal study notes, search by keyword, and filter by tag.

6. **Learner Growth & Privacy**:
   - Server-calculated XP rewards and tamper-proof idempotency keys.
   - Preserves foundation progress when switching paths.
   - Complete JSON data export (`export.json`) and instant account deletion (`DELETE /api/account`).

---

## 🧪 Verification & Quality Assurance

A comprehensive automated test suite (`backend/tests/verify_all.py`) tests all requirements end-to-end against the live server:
- ✅ **23 / 23 Tests Passing**
- Health check & demo provider mode
- Guest onboarding, HMAC session cookies, and session isolation
- Full curriculum with prerequisite locking & unlocking
- Multilingual content loading across all 5 languages
- Rule-based evaluation & simulated response formatting
- Idempotent attempt submission (0 duplicate XP on replay)
- Understanding checks & XP calculation
- Saved items CRUD, search, and filtering
- Spaced repetition review scheduling
- Path switching preserving foundation progress
- Data export & permanent account purging

To run the verification test suite at any time:
```powershell
python backend/tests/verify_all.py
```

---

## 📂 Project Structure

```
SkillOrbit/
├── start.bat                   # 1-click Windows launcher
├── README.md                   # Complete documentation
├── content/                    # 12 complete lessons in 5 languages
│   ├── foundations/            # 4 shared core foundation lessons (JSON)
│   └── missions/               # 8 audience-specific mission lessons (JSON)
├── data/
│   └── skillorbit.db           # Persistent SQLite database
├── backend/
│   ├── main.py                 # FastAPI application routes
│   ├── config.py               # Constants, XP rules, review intervals
│   ├── models.py               # SQLAlchemy database models
│   ├── database.py             # Async SQLite engine & session
│   ├── schemas.py              # Pydantic validation schemas
│   ├── seed.py                 # Content seeder
│   ├── generate_content.py     # Content generator script
│   ├── services/
│   │   ├── practice.py         # DemoProvider & LiveProvider interface
│   │   └── progress.py         # XP rules & spaced review scheduling
│   └── tests/
│       └── verify_all.py       # 23-test verification suite
└── frontend/
    ├── package.json            # Dependencies (React 19, TypeScript, Three.js)
    ├── vite.config.ts          # Vite configuration with backend proxy
    ├── index.html              # PWA-ready HTML entry point
    ├── public/
    │   ├── manifest.json       # Web App Manifest
    │   └── favicon.svg         # Cosmic Orbit icon
    └── src/
        ├── App.tsx             # Complete React application & routing
        ├── index.css           # Cosmic Orbit dark theme design system
        ├── services/
        │   └── api.ts          # Typed API client
        └── components/
            ├── CompanionRobot.tsx  # 3D Three.js companion with 2D fallback
            └── CosmicMap3D.tsx     # 3D Solar Orbit map with 2D grid toggle
```
