# 🚀 Diet Planner - Dedicated Release & Deployment Manifest

This dedicated release folder contains your standalone offline-ready application file, one-click Windows deployment scripts, and deployment URLs & endpoints.

---

## 1. Standalone Single-File Release (Zero Server Needed)

You can launch the full application interface directly from your desktop or filesystem without installing any server, Node, or dependencies:

- **Direct File Path**: `release/Diet-Planner-App.html`
- **File URL**: [Diet-Planner-App.html](file:///c:/Users/code/Desktop/DIET%20PLANNER/release/Diet-Planner-App.html)
- **Features**: All React 19 UI, Tailwind v4 styling, interactive dashboards, habit analysis screens, recipe builders, and offline state calculations are completely bundled into this single 1.70 MB file. Double-click to launch in Chrome, Edge, Safari, or Firefox.

---

## 2. One-Word Cloud Deployment Workflows

### A. Frontend (Vercel)
You can deploy using the project's root CLI scripts or the helper batch file in this directory:

- **Deploy Preview**:
  ```bash
  bun run deploy:preview
  ```
  *Yields a temporary staging URL, e.g.* `https://diet-planner-<hash>.vercel.app`

- **Deploy Production**:
  ```bash
  bun run deploy:prod
  ```
  *Deploys live to your primary production domain, e.g.* `https://diet-planner.vercel.app`

- **Windows One-Click Shortcut**: Double-click [deploy-vercel.bat](file:///c:/Users/code/Desktop/DIET%20PLANNER/release/deploy-vercel.bat) inside this folder.

---

### B. Cloud Backend Architecture (Vercel Serverless + Firebase)
The backend service operates on a modern serverless architecture:

- **Fast Endpoints**: Native Vercel Serverless Functions in `api/` (sub-10s responses, zero cold starts, global edge distribution)
- **Heavy AI Vision**: Firebase Cloud Function 2nd Gen `analyzeFood` (`functions/src/index.ts`) with scale-to-zero (`minInstances: 0`) and 120s timeout (with local/Vercel fallback)
- **Production URL**: Handled unified under `https://diet-planner-sooty.vercel.app/api/*`
- **Health Check Endpoint**: `/api/health`
- **Windows Local Server Runner**: Double-click [start-server.bat](file:///c:/Users/code/Desktop/DIET%20PLANNER/release/start-server.bat) to run the standalone server locally on `http://localhost:3000`.

---

## 3. Dedicated Endpoints & Live Verification URLs

| Service | Target URL | Status / Notes |
| :--- | :--- | :--- |
| 🚀 **Permanent Vercel Production URL** | **[https://diet-planner-sooty.vercel.app](https://diet-planner-sooty.vercel.app)** | 🟢 **LIVE & ACCESSIBLE WORLDWIDE** |
| 🔍 **Vercel Direct Deployment** | `https://diet-planner-piew9407v-avi-2f26.vercel.app` | 🟢 Verified & Active |
| 💻 **Local Standalone App** | `file:///c:/Users/code/Desktop/DIET%20PLANNER/release/Diet-Planner-App.html` | ✅ Ready immediately (Double-click) |
| 🖥️ **Local Server** | `http://localhost:3000` | Run via `bun run start` or `start-server.bat` |
| ⚡ **Vercel API Gateway** | `https://diet-planner-sooty.vercel.app/api/health` | Fast native serverless functions |
| 🔥 **Firebase Cloud Functions** | `functions/src/index.ts` (`analyzeFood`) | 2nd Gen Cloud Function (scale-to-zero) |
| 🤖 **AI Food Analysis Endpoint** | `POST /api/ai/analyze-food` | Gemini vision + tiered nutrition pipeline |
| **Weekly Habit Audit** | `POST /api/ai/weekly-audit` | Gemini habit coaching & macro analysis |
| **Personalized Recommendations**| `POST /api/ai/personalized-recommendations` | Gemini meal suggestion engine |
| **Barcode Lookup** | `GET /api/food/barcode/{code}` | OpenFoodFacts / USDA provider |

---

## 4. Unified Architecture: Zero CORS, Direct Routing

With all fast endpoints hosted directly in Vercel (`api/*`) and the vision pipeline supported both in Firebase Cloud Functions and Vercel functions, there are no external proxy bottlenecks or cold-start reverse-proxy drops. All client calls use relative paths (`/api/...`) which Vercel resolves natively.
