# Complete Deployment Guide: Vercel SPA + Consolidated Railway Backend

This repository is structured as a robust full-stack application composed of:
1. **Frontend**: React 19 + TypeScript + Vite Single Page Application (SPA) deployed to **Vercel** (`https://diet-planner-sooty.vercel.app`).
2. **Backend**: Long-lived **Railway Service** running `server.ts` via Nixpacks builder (`bun run server.ts`), hosting all 10 AI and nutrition reconciliation endpoints.
3. **Database**: **Cloud Firestore** document-shaped database with user-isolated security rules and append-only correction logs.

> [!IMPORTANT]
> **Consolidated Backend on Railway**: Render and split serverless architectures (Vercel `api/` and Firebase Functions) have been completely decommissioned. Railway provides continuous uptime, fast responses, zero-dependency token authentication, and uninterrupted execution for compute-heavy multimodal vision pipelines.

---

## 1. Quick Reference: CLI Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Frontend & API Preview** | `bun run deploy:preview` | Builds and deploys a preview version with a unique Vercel URL |
| **Production Deployment** | `bun run deploy:prod` | Builds and deploys directly to the live Vercel production domain |
| **Railway Service Launch** | `bun run server.ts` | Starts the production backend service with public health routes |
| **Local Test Suite** | `bun test` | Runs comprehensive unit and integration test suite (123+ tests) |
| **Typecheck** | `bun run lint` | Runs `bunx tsc --noEmit` across all project files |

---

## 2. Frontend Deployment (Vercel)

### A. SPA Configuration
The frontend is deployed as a pure Single Page Application on Vercel:
- Configured in [vercel.json](file:///c:/Users/code/Desktop/DIET%20PLANNER/vercel.json) with single SPA catch-all rewrite:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- All client-side requests use the unified `apiFetch()` utility, which resolves backend calls to `VITE_API_URL` (the Railway service) or falls back smoothly to relative paths in local environments.

### B. Deployment Workflow
* **Production Deployment**:
  ```bash
  bun run deploy:prod
  ```

---

## 3. Backend Deployment (Railway)

### A. Railway Nixpacks Configuration
Configured in [railway.json](file:///c:/Users/code/Desktop/DIET%20PLANNER/railway.json):
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "bun run server.ts",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

### B. Consolidated Endpoints Hosted on Railway
- `GET /health` & `GET /api/health` — Public, unauthenticated health probes
- `GET /api/food/barcode/:code` — Barcode nutrition lookup
- `POST /api/ai/match-meal-memory` — Vector/lexical meal memory recall
- `POST /api/ai/recompute-category-priors` — Category prior recalculation
- `POST /api/ai/analyze-recipe` — Gemini recipe breakdown
- `POST /api/ai/weekly-audit` — Weekly nutrition audit
- `POST /api/ai/smart-grocery-list` — AI grocery list generation
- `POST /api/ai/calculate-profile` — Dynamic TDEE/macro profile calculator
- `POST /api/ai/personalized-recommendations` — Meal suggestions
- `POST /api/ai/voice-quick-log` — Voice-to-meal parser
- `POST /api/ai/analyze-habits` — Habit pattern detection
- `POST /api/ai/analyze-food` — Multimodal vision analysis with tiered nutrition reconciliation

---

## 4. Environment Variables Reference

Never commit secret values to Git; configure them directly in the respective hosting platforms.

### A. Frontend Variables (Vercel)
Set these via the Vercel Dashboard (**Project Settings > Environment Variables**):

| Variable Name | Purpose | Example / Source |
| :--- | :--- | :--- |
| `VITE_API_URL` | Railway Backend URL | `https://diet-planner-production.up.railway.app` |
| `VITE_FIREBASE_API_KEY` | Client Firebase Web API key | Web credentials from Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Google Cloud / Firebase Project ID | e.g. `polar-conquest-wmbw7` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Cloud Storage bucket | `<project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging Sender ID | Numeric sender ID from Firebase Console |
| `VITE_FIREBASE_APP_ID` | Firebase Web App Identifier | `1:<sender-id>:web:<app-hash>` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Target Firestore database ID | `(default)` |

---

### B. Backend Variables (Railway)
Set these in the Railway Dashboard (**Variables** tab):

| Variable Name | Required? | Purpose & Implementation Details |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API Key. Required by `@google/genai` for meal photo nutrition estimation, barcode visual validation, recipe breakdown, and habit analysis. |
| `USDA_API_KEY` | Optional | API key for the USDA FoodData Central REST API (`api.nal.usda.gov`). Defaults to `DEMO_KEY` if omitted. |
| `PORT` | Auto | Assigned automatically by Railway. |
