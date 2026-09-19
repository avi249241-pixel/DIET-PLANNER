# 🚀 Diet Planner - Dedicated Release & Deployment Manifest

This dedicated release folder contains your standalone offline-ready application file, one-click Windows deployment scripts, and deployment URLs & endpoints.

---

## 1. Standalone Single-File Release (Zero Server Needed)

You can launch the full application interface directly from your desktop or filesystem without installing any server, Node, or dependencies:

- **Direct File Path**: `release/Diet-Planner-App.html`
- **File URL**: [Diet-Planner-App.html](file:///c:/Users/code/Desktop/DIET%20PLANNER/release/Diet-Planner-App.html)
- **Features**: All React 19 UI, Tailwind v4 styling, calm light theme dashboard, interactive macro progress cards, habit analysis screens, recipe builders, and offline state calculations are completely bundled into this single standalone file. Double-click to launch in Chrome, Edge, Safari, or Firefox.

---

## 2. Production Cloud Architecture

### A. Frontend (Vercel)
The frontend is deployed as a high-performance React 19 Single Page Application on Vercel:
- **Production URL**: **[https://diet-planner-sooty.vercel.app](https://diet-planner-sooty.vercel.app)**
- **Deploy Command**: `bun run deploy:prod`
- **Windows One-Click Shortcut**: Double-click [deploy-vercel.bat](file:///c:/Users/code/Desktop/DIET%20PLANNER/release/deploy-vercel.bat) inside this folder.

---

### B. Consolidated Backend (Fly.io Free Tier)
All backend routes and heavy AI pipelines are unified into a single long-lived container running `server.ts` on Fly.io's free tier:
- **Runtime**: Official Bun Docker container (`oven/bun:1-slim`)
- **Resource Limits**: Free-tier eligible (`shared-cpu-1x`, 256MB RAM)
- **Auto-Scale**: Scale-to-zero when idle (`auto_stop_machines = 'stop'`, `min_machines_running = 0`)
- **Health Probes**: `GET /health` and `GET /api/health`
- **Token Verification**: Zero-dependency crypto verification using Google public x509 certs with OAuth2 tokeninfo fallback.
- **Unified Endpoints**:
  - `POST /api/ai/analyze-food` (Multimodal vision + tiered USDA/OFF lookup)
  - `POST /api/ai/match-meal-memory` (Personal food memory recall)
  - `POST /api/ai/recompute-category-priors` (Adaptive category priors)
  - `POST /api/ai/weekly-audit` (Habit coaching & macro audit)
  - `POST /api/ai/smart-grocery-list` (Dynamic grocery generation)
  - `POST /api/ai/analyze-recipe` (Recipe macro calculation)
  - `POST /api/ai/calculate-profile` (TDEE & target recalculation)
  - `POST /api/ai/personalized-recommendations` (Predictive next meal)
  - `POST /api/ai/voice-quick-log` (Voice logging parser)
  - `GET /api/food/barcode/:code` (Barcode lookup)

---

## 3. Dedicated Endpoints & Verification Summary

| Service | Target URL | Status / Notes |
| :--- | :--- | :--- |
| 🚀 **Permanent Vercel Production URL** | **[https://diet-planner-sooty.vercel.app](https://diet-planner-sooty.vercel.app)** | 🟢 **LIVE & ACCESSIBLE WORLDWIDE** |
| 🪰 **Fly.io Backend Service** | `https://diet-planner-backend.fly.dev` | 🟢 Verified Bun Docker (`shared-cpu-1x`, 256MB) |
| 💻 **Local Standalone App** | `file:///c:/Users/code/Desktop/DIET%20PLANNER/release/Diet-Planner-App.html` | ✅ Ready immediately (Double-click) |
| 🖥️ **Local Server** | `http://localhost:8080` | Run via `bun run server.ts` or `start-server.bat` |
| ⚡ **Backend Health Check** | `GET /health` | Instant HTTP 200 health probe |
| 🤖 **AI Food Analysis Endpoint** | `POST /api/ai/analyze-food` | Gemini vision + tiered nutrition pipeline |
| 🔒 **Firestore Security Rules** | `firestore.rules` | User-isolated, append-only correctionLog |
