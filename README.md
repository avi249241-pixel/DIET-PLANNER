<div align="center">
  <h1>🥗 VibeDiet 3D — Intelligent Nutrition Platform</h1>
  <p><strong>3D-native food logging, multi-component vision analysis, tiered nutrition resolution, and adaptive metabolic recalibration.</strong></p>

  [![Vercel Deployment](https://img.shields.io/badge/Vercel-Live_Production-black?logo=vercel)](https://diet-planner-sooty.vercel.app)
  [![Tests](https://img.shields.io/badge/Tests-125_Passed-emerald?logo=bun)](tests)
  [![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Clean-blue?logo=typescript)](tsconfig.json)
</div>

---

## 🚀 Live Deployments

- **Web Application (Vercel SPA)**: [https://diet-planner-sooty.vercel.app](https://diet-planner-sooty.vercel.app)
- **Backend Service**: Express + Google GenAI + Tiered Nutrition Engine running on Railway / Fly.io / Node.js
- **Database & Auth**: Cloud Firestore + Firebase Auth with strict user-isolated security rules

---

## 🛠️ Architecture & Tech Stack

| Layer | Technologies | Description |
| :--- | :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Tailwind CSS v4, Motion | Responsive 8-screen dashboard with fluid micro-interactions |
| **3D Engine** | Three.js WebGL Canvas | Ambient 3D plate and metabolic particle atmosphere |
| **Backend & API** | Express.js, Node/Bun, `@google/genai` | Multi-view vision pipeline, token verification, and personal memory |
| **Nutrition Engine** | USDA FDC, Open Food Facts, Curated Local DB | Strict 4-tier fallback order for authoritative nutritional resolution |
| **Persistence** | Cloud Firestore + Local-First Cache | User-owned meal logs, continuous category priors, and pantry sync |
| **Testing & QA** | Bun Test runner, Playwright Chromium | 125 automated unit/integration tests and end-to-end headless browser QA |

---

## 📱 Features

1. **Multi-Component Food Vision**: Photos are decomposed into individual ingredients with estimated gram weights and mass basis calibration.
2. **Interactive Meal Swaps**: Instant whole-food recommendations matching caloric and protein requirements with clear rationale.
3. **Repeat-Meal Quick-Log**: One-tap re-logging of recent meals for high adherence.
4. **Adaptive Target Recalibration**: Rolling 14-day energy expenditure tracking with protected 1,200 kcal floor.
5. **Forgiving Streak Engine**: 1-day grace period protecting streaks from isolated missed days, paired with a full month calendar grid.
6. **Voice Meal Logger**: Built-in browser Web Speech API transcription with real-time whole-food component parsing.
7. **Barcode Scanner**: Instant Open Food Facts lookup with packaged food presets.
8. **Smart Recipe Builder & Grocery Sync**: Custom recipe batch scaling and categorized pantry checklist.

---

## 💻 Local Development

### Prerequisites
- [Bun](https://bun.sh) (v1.2+) or Node.js (v20+)

### Setup
```bash
# 1. Install dependencies
bun install

# 2. Configure environment
cp .env.example .env.local
# Set GEMINI_API_KEY in .env.local

# 3. Start local development server (Client + API)
bun run dev

# 4. Run automated test suite
bun test

# 5. Typecheck
bun run lint

# 6. Production build
bun run build
```

---

## 📦 Standalone Distribution

The project includes an inlined, zero-dependency standalone HTML bundle in [`release/Diet-Planner-App.html`](release/Diet-Planner-App.html). Users can launch the application directly from the desktop without needing local dev servers or encountering CORS errors.
