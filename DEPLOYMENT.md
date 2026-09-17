# Complete Deployment Guide: Vercel (Frontend) & Render (Backend)

This repository is structured as a full-stack application composed of:
1. **Frontend**: React 19 + TypeScript + Vite Single Page Application (SPA).
2. **Backend**: Express + Bun/Node server (`dist/server.mjs`) handling Google Gemini 2.5/Flash AI, USDA FoodData Central integration, and Firebase Admin authentication.

> [!IMPORTANT]
> **Two Separate Deployments Required**: The frontend (Vercel) and the backend (Render / Node host) are separate services. Both must be live for the application to function. A frontend-only deployment will render the user interface, but every AI food analysis, barcode lookup, recipe calculation, and habit audit call will fail without the backend.

---

## 1. Quick Reference: CLI Commands

| Action | Command | Description |
| :--- | :--- | :--- |
| **Frontend Preview** | `bun run deploy:preview` | Builds and deploys a preview version with a unique Vercel URL |
| **Frontend Production** | `bun run deploy:prod` | Builds and deploys directly to the live Vercel production domain |
| **Backend Local Build** | `bun run build` | Compiles Vite client (`dist/`) and Node server (`dist/server.mjs`) |
| **Backend Start** | `bun run start` | Boots the production server (`dist/server.mjs`) on `$PORT` (default 3000) |
| **Typecheck** | `bun run lint` | Runs `bunx tsc --noEmit` across all project files |

---

## 2. Frontend Deployment (Vercel)

### A. One-Time Setup

1. **Install the Vercel CLI**:
   ```bash
   bun add -g vercel
   # or: npm install -g vercel
   ```

2. **Authenticate with Vercel**:
   ```bash
   vercel login
   ```
   Follow the CLI prompt to verify your email or GitHub/GitLab account.

3. **Link Your Local Project**:
   ```bash
   vercel link
   ```
   Answer the interactive prompts:
   - *Set up and deploy?* `yes`
   - *Which scope do you want to deploy to?* (Choose your Vercel account/team)
   - *Link to existing project?* `no` (or select existing if already created)
   - *What's your project's name?* `diet-planner`
   - *In which directory is your code located?* `./`
   - *Want to modify these settings?* `no` (Vercel reads `vercel.json` automatically)

### B. Every-Time Deployment Workflow

* **Preview Deployment**:
  ```bash
  bun run deploy:preview
  ```
  Vercel will output an inspection URL and a live preview URL (e.g., `https://diet-planner-git-branch-username.vercel.app`).

* **Production Deployment**:
  ```bash
  bun run deploy:prod
  ```
  Vercel will push your build to the live production domain (e.g., `https://diet-planner.vercel.app`).

### C. Routing Frontend API Requests to the Backend

When the frontend runs on Vercel, client code issues requests to relative endpoints (such as `fetch('/api/ai/analyze-food')`). 

To route these requests to your live backend without CORS restrictions:
1. Obtain your backend URL from Render (e.g. `https://diet-planner-backend.onrender.com`).
2. Add an API rewrite rule to [vercel.json](file:///c:/Users/code/Desktop/DIET%20PLANNER/vercel.json) right before the catch-all SPA rewrite:

```json
{
  "framework": "vite",
  "buildCommand": "bun run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/api/:match*",
      "destination": "https://diet-planner-backend.onrender.com/api/:match*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

3. Deploy to production: `bun run deploy:prod`.

---

## 3. Backend Deployment (Render)

Render provides a zero-maintenance, git-integrated environment that natively supports Node and Bun. A turnkey Blueprint file [render.yaml](file:///c:/Users/code/Desktop/DIET%20PLANNER/render.yaml) is included in the project root.

### A. One-Time Setup via Render Blueprint (Recommended)

1. Push this repository to GitHub or GitLab.
2. Log in to [dashboard.render.com](https://dashboard.render.com).
3. Click **New +** in the top navigation and select **Blueprint**.
4. Connect your repository. Render detects [render.yaml](file:///c:/Users/code/Desktop/DIET%20PLANNER/render.yaml) and automatically configures:
   - **Service Name**: `diet-planner-backend`
   - **Runtime**: `node` (includes Bun pre-installed)
   - **Build Command**: `bun install && bun run build`
   - **Start Command**: `bun run start` (executes `dist/server.mjs`)
5. Render will identify the environment variables marked `sync: false` and prompt you to input your secrets (see Environment Variables section below).
6. Click **Apply**. Render builds and deploys your service.

### B. Every-Time Backend Deployment Workflow

- **Automatic Git Deployments**: Any commit pushed to your tracked branch (`main`) will automatically trigger a clean build and zero-downtime rolling restart on Render.
- **Manual Trigger**:
  - In the Render Dashboard, open `diet-planner-backend` and click **Manual Deploy** > **Deploy latest commit**.
- **CLI Alternative (Render CLI)**:
  ```bash
  # Trigger deploy using Render Webhook or CLI
  render blueprints launch
  ```

### C. Port Binding & Process Health

The backend server in [server.ts](file:///c:/Users/code/Desktop/DIET%20PLANNER/server.ts) dynamically binds to:
```typescript
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
```
Render automatically injects the `PORT` environment variable (typically `10000`). The server binds to `0.0.0.0:$PORT` so health checks and traffic ingress function immediately.

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

### B. Backend Variables (Render / Host)

Set these in the Render Dashboard (**diet-planner-backend > Environment**):

| Variable Name | Required? | Purpose & Implementation Details |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **Yes** | Google Gemini API Key. Required by `@google/genai` in `server.ts` for meal photo nutrition estimation, barcode visual validation, recipe breakdown, and habit analysis. |
| `ALLOWED_ORIGINS` | **Recommended** | Comma-separated list of permitted CORS origins (e.g. `https://diet-planner.vercel.app,http://localhost:5173`). If unset, reflects the caller's origin. |
| `USDA_API_KEY` | Optional | API key for the USDA FoodData Central REST API (`api.nal.usda.gov`). Defaults to `DEMO_KEY` if omitted; dedicated key prevents public rate-limiting. |
| `NODE_ENV` | **Yes** | Set to `production` (configured automatically in `render.yaml`). Disables Vite development middleware and serves compiled static assets. |
| `PORT` | Managed | Managed dynamically by Render (e.g. `10000`). Local dev defaults to `3000`. |
| `FIREBASE_PROJECT_ID` | **Yes** | Project ID used by `firebase-admin` to verify user ID tokens in `src/middleware/auth.ts`. |
| `FIREBASE_CLIENT_EMAIL` | Optional | Service account email for privileged Firebase Admin operations. |
| `FIREBASE_PRIVATE_KEY` | Optional | Private key for Firebase service account (`"-----BEGIN PRIVATE KEY-----\n..."`). |
| `GOOGLE_APPLICATION_CREDENTIALS` | Optional | Path to Google Cloud service account JSON file if mounting credentials file on Render. |
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
