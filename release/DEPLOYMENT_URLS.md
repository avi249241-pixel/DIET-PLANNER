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

### B. Backend (Render / PaaS)
The backend service configuration is predefined in [render.yaml](file:///c:/Users/code/Desktop/DIET%20PLANNER/render.yaml):

- **Service Name**: `diet-planner-backend`
- **Runtime**: Node/Bun native environment
- **Production Entrypoint**: `dist/server.mjs`
- **Expected Production Endpoint**: `https://<your-service-name>.onrender.com`
- **Health Check Endpoint**: `/api/food/search?q=apple`
- **Windows Local Server Runner**: Double-click [start-server.bat](file:///c:/Users/code/Desktop/DIET%20PLANNER/release/start-server.bat) to run the compiled production backend server locally on `http://localhost:3000`.

---

## 3. Dedicated Endpoints & Verification URLs

Once your backend and frontend are deployed, the active endpoints are:

| Service | Target URL | Status / Notes |
| :--- | :--- | :--- |
| **Local Standalone App** | `file:///c:/Users/code/Desktop/DIET%20PLANNER/release/Diet-Planner-App.html` | ✅ Ready immediately (Double-click) |
| **Local Production Server** | `http://localhost:3000` | Run via `bun run start` or `start-server.bat` |
| **Vercel Production Domain** | `https://diet-planner.vercel.app` (or your custom domain) | Deployed via `bun run deploy:prod` |
| **Render Backend Service** | `https://diet-planner-backend.onrender.com` | Deployed via Git push / Render Blueprint |
| **AI Food Analysis Endpoint** | `POST /api/ai/analyze-food` | Requires `GEMINI_API_KEY` on backend |
| **Weekly Habit Audit** | `POST /api/ai/weekly-audit` | Gemini habit coaching & macro analysis |
| **Personalized Recommendations**| `POST /api/ai/personalized-recommendations` | Gemini meal suggestion engine |
| **USDA Food Search** | `GET /api/food/search?q={query}` | USDA FoodData Central provider |
| **Barcode Lookup** | `GET /api/food/barcode/{code}` | OpenFoodFacts / USDA provider |

---

## 4. Connecting the Live Frontend to the Live Backend

To route frontend requests seamlessly through your Vercel URL to your Render backend:
1. Note your live backend URL from Render (e.g. `https://diet-planner-backend.onrender.com`).
2. Add the API proxy rule in `vercel.json`:
   ```json
   {
     "source": "/api/:match*",
     "destination": "https://diet-planner-backend.onrender.com/api/:match*"
   }
   ```
3. Run `bun run deploy:prod` to push the update live. All relative `/api/*` network requests will automatically route to Render without CORS issues.
