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

### B. Direct Client-Side Gemini & Zero-Backend Architecture
All AI recognition, tiered nutrition lookups, and personal memory recall run **directly in the client browser**:
- **Zero Backend Servers**: No external container servers, no Railway, no Fly.io, no Render, no cold starts, no server bills, no credit cards required.
- **Direct Gemini 2.5 Flash**: Browser calls Google Gemini API directly using the user's free API key (stored in `localStorage`).
- **Tiered Nutrition Hierarchy**:
  - Open Food Facts: Direct client-side CORS-enabled REST API.
  - USDA FoodData Central: Direct client-side REST API + Curated Local Reference Database.
  - Epistemic Uncertainty & Atwater Verification: Calculated deterministically in the client.
- **Personal Food Memory**: Fast-path perceptual hashing and category prior learning executed client-side.
- **Instant Key Configuration**: One-click setup modal in the app with direct link to Google AI Studio (free key).

---

## 3. Dedicated Endpoints & Verification Summary

| Service | Target URL | Status / Notes |
| :--- | :--- | :--- |
| 🚀 **Permanent Vercel Production URL** | **[https://diet-planner-sooty.vercel.app](https://diet-planner-sooty.vercel.app)** | 🟢 **LIVE & ACCESSIBLE WORLDWIDE** |
| 🤖 **Direct Client AI Engine** | Client-Side (`@google/genai` / REST) | 🟢 Zero-backend, 100% private, zero cost |
| 💻 **Local Standalone App** | `file:///c:/Users/code/Desktop/DIET%20PLANNER/release/Diet-Planner-App.html` | ✅ Ready immediately (Double-click) |
| ⚡ **Offline Nutrition Fallback** | USDA Curated Reference DB | Instant offline calorie & macro matching |
| 🔍 **Barcode Lookup** | Open Food Facts REST API | Direct client-side product resolution |
| 🔒 **Firestore Security Rules** | `firestore.rules` | User-isolated, append-only correctionLog |
