# Complete Deployment Guide: Split Vercel & Firebase Architecture

This repository is structured as a modern full-stack application composed of:
1. **Frontend**: React 19 + TypeScript + Vite Single Page Application (SPA) deployed to **Vercel**.
2. **Fast API Endpoints**: Native Vercel Serverless Functions under `/api/*` (health checks, meal memory, barcode lookup, recipe breakdown, habit audits, recommendations).
3. **Heavy Vision Pipeline**: Firebase Cloud Function (`analyzeFood` 2nd gen) with scale-to-zero (`minInstances: 0`) and extended timeout margin for tiered nutrition reconciliation (or Vercel `/api/ai/analyze-food` route fallback).

> [!IMPORTANT]
> **Render Decommissioned**: Render has been completely replaced with zero cold-start proxy latency. Fast requests run within milliseconds on Vercel's edge network, while vision AI processes cleanly without external reverse-proxy failures.

---

## 1. Quick Reference: CLI Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Frontend & API Preview** | `bun run deploy:preview` | Builds and deploys a preview version with a unique Vercel URL |
| **Production Deployment** | `bun run deploy:prod` | Builds and deploys directly to the live Vercel production domain |
| **Firebase Functions Deploy** | `npm run deploy --prefix functions` | Deploys Cloud Function `analyzeFood` to Firebase (Blaze plan required) |
| **Local Test Suite** | `bun test` | Runs comprehensive unit and integration test suite |
| **Typecheck** | `bun run lint` | Runs `bunx tsc --noEmit` across all project files |

---

## 2. Fast Endpoints & Frontend Deployment (Vercel)

### A. Serverless API Architecture
All fast backend endpoints are hosted natively under `api/`:
- `GET /api/health` — Instant health check
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
- `POST /api/ai/analyze-food` — Multimodal meal analysis (with 60s maxDuration)

### B. Every-Time Deployment Workflow

* **Production Deployment**:
  ```bash
  bun run deploy:prod
  ```
  Vercel automatically discovers both the static frontend (`dist/`) and all serverless functions in `api/`.

---

## 3. Heavy Vision Pipeline (Firebase Cloud Functions)

The compute-heavy Gemini vision and tiered nutrition reconciliation pipeline (`functions/src/index.ts`) is packaged as a 2nd Gen Firebase Cloud Function:

- **Function Name**: `analyzeFood`
- **Region & Runtime**: Node 20 / TypeScript
- **Scaling**: Scale-to-zero (`minInstances: 0`) for cost efficiency
- **Timeout**: 120s timeout margin with 512MiB memory
- **Deployment**:
  ```bash
  npx firebase-tools deploy --only functions
  ```
  *Note: Deploying Cloud Functions to Firebase requires upgrading the project to the Blaze pay-as-you-go plan.*

---

## 4. Environment Variables Reference (Strict Split)

Every environment variable read across the codebase is cataloged below. Never commit secret values to Git; configure them directly in the respective hosting platforms.

### A. Frontend Variables (Vercel)

Set these via the Vercel Dashboard (**Project Settings > Environment Variables**) or with `vercel env add <NAME>`:

| Variable Name | Purpose | Example / Source |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Client Firebase Web API key | Web credentials from Firebase Console |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Google Cloud / Firebase Project ID | e.g. `polar-conquest-wmbw7` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Cloud Storage bucket | `<project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Cloud Messaging Sender ID | Numeric sender ID from Firebase Console |
| `VITE_FIREBASE_APP_ID` | Firebase Web App Identifier | `1:<sender-id>:web:<app-hash>` |
| `VITE_FIREBASE_FIRESTORE_DATABASE_ID` | Target Firestore database ID | `(default)` or custom named database |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics measurement ID | `G-XXXXXXXXXX` (optional) |
| `VITE_FIREBASE_OAUTH_CLIENT_ID` | Google OAuth Web Client ID | `<sender-id>-<hash>.apps.googleusercontent.com` |

> [!NOTE]
> For convenience during initial evaluation, default values exist in `firebase-applet-config.json`. When rolling out to production under your own Firebase organization, configure the `VITE_FIREBASE_*` variables above in Vercel.

---

### B. Serverless API & Function Variables (Vercel & Firebase)

Set these in the Vercel Dashboard (**Project Settings > Environment Variables**) and in Firebase Functions config / secret manager:

| Variable Name | Required? | Purpose & Implementation Details |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API Key. Required by `@google/genai` for meal photo nutrition estimation, barcode visual validation, recipe breakdown, and habit analysis. |
| `USDA_API_KEY` | Optional | API key for the USDA FoodData Central REST API (`api.nal.usda.gov`). Defaults to `DEMO_KEY` if omitted; dedicated key prevents public rate-limiting. |
| `FIREBASE_PROJECT_ID` | **Yes** | Project ID used by `firebase-admin` to verify user ID tokens in API routes. |
| `FIREBASE_CLIENT_EMAIL` | Optional | Service account email for privileged Firebase Admin operations. |
| `FIREBASE_PRIVATE_KEY` | Optional | Private key for Firebase service account (`"-----BEGIN PRIVATE KEY-----\n..."`). |
| `ALLOW_TEST_TOKEN` | Security | Set to `"false"` (or leave unset) in production. Setting to `"true"` permits mock `test-token-*` authorization headers for headless test runners. |

#### Optional Relational DB Variables (Drizzle / PostgreSQL)
If utilizing the relational Postgres module (`src/db/`):
- `SQL_HOST`: Database hostname / connection endpoint.
- `SQL_DB_NAME`: Database name.
- `SQL_USER`: Connection user.
- `SQL_PASSWORD`: Connection password.
- `SQL_ADMIN_USER` & `SQL_ADMIN_PASSWORD`: Migration credentials for `drizzle-kit push`.

---

## 5. Pre-Flight Verification & Sanity Testing

Before shipping to production, run this deterministic verification checklist locally:

```bash
# 1. Verify TypeScript types across the entire project
bun run lint

# 2. Verify production bundle creation
bun run build

# 3. Test production server port binding
PORT=8765 node dist/server.mjs
# Output must show: "Server running on http://0.0.0.0:8765"
```

### Post-Deployment Sanity Test Flow

1. Open your production Vercel domain: `https://diet-planner.vercel.app`.
2. Ensure the UI loads immediately with no console errors or blank screens.
3. Sign in via Google Auth.
4. Click **Log Food** and enter a sample food item or scan a barcode.
5. Verify that the request reaches the backend and returns calculated nutrients from USDA / Gemini.
6. Open browser DevTools Network tab to confirm all `/api/*` calls respond with `200 OK`.
