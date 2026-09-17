# AGENTS.md — Diet Planner / Meal Logging App

## Project summary
A 3D web app for diet-conscious users to log meals by photo. Core flow: user
photographs a meal → uploads to "Main Log" → Gemini vision analyzes the food →
agent asks only 3–4 clarifying questions that can't be deduced from the image →
meal is logged with calories/protein/carbs/fats + daily view.

Pipeline: photo → Gemini vision (structured JSON) → tiered nutrition lookup
(USDA FDC → Open Food Facts → local curated DB → Gemini estimate fallback) →
clarifying questions on low confidence → Firestore log, under enforced auth.

Stack: frontend on Vercel, backend on Render, code on GitHub, local folder
`DIET PLANNER` (Windows, `C:\Users\code\Desktop\DIET PLANNER`), branch `main`.

## Standing rules for every session
1. `git pull` before starting any work. Never begin editing on a stale branch.
2. `git push` when a unit of work is done and verified — don't leave work
   uncommitted at the end of a session.
3. Never commit secrets, API keys, or `.env` contents. Confirm `.gitignore`
   covers env files before the first commit of a session.
4. Prefer existing hosted AI/CV APIs (Gemini vision, USDA FDC, Open Food
   Facts) over training or hosting a custom model — this is a firm
   architectural constraint, not a suggestion to revisit.
5. When running multiple parallel agent sessions (frontend/UI, recognition
   pipeline, deployment), each session should touch only its own area of the
   codebase to avoid merge conflicts. Note in the commit message which area
   you worked on.
6. Deployment steps (Vercel deploy, Render deploy, changing GitHub remotes,
   force-pushing, rotating credentials) should be proposed and summarized
   before executing, even in autonomous mode — everything else can proceed
   without asking.
7. If a task is ambiguous or would require a destructive action (deleting
   data, resetting Firestore collections, overwriting the main branch
   history), stop and ask rather than guessing.

## Tools this project expects to have available
- **GitHub MCP / CLI** — for pull, commit, push, PR creation.
- **Google Cloud MCP** — for Firestore reads/writes, and any Gemini API
  calls that go through Vertex rather than the public Gemini API key.
- **Filesystem tools** — read/write within `DIET PLANNER` only.
- **Browser tool** — for checking the deployed Vercel/Render URLs render
  correctly after a deploy.
- **Vercel/Render MCP or CLI** — deploy status checks and redeploys.

If a listed tool isn't connected yet, say so explicitly rather than
simulating its output.

## Definition of done for a coding task
- Code compiles/builds locally.
- Relevant tests (or a manual smoke check of the changed flow) pass.
- Firestore writes go through the enforced-auth path, not a bypass.
- Change is committed with a clear message and pushed.
- If it touches the pipeline, confirm the tiered nutrition lookup fallback
  order (USDA FDC → Open Food Facts → local DB → Gemini estimate) is intact.

## 🚀 Core Philosophy: Maximum Flow, Minimum Friction
1. **Speed & Autonomy**: Implement complete, robust, production-ready solutions with minimal back-and-forth interruptions.
2. **Modern Aesthetics**: Use modern, clean UI patterns with Tailwind CSS v4, Motion (Framer Motion) micro-interactions, Lucide icons, and responsive layouts.
3. **Zero Regressions & Self-Healing**: Automatically run type-checking (`bunx tsc --noEmit`) and verify code after significant changes before completing tasks.
4. **Instant Prototyping**: Provide realistic mock data, smart defaults, and seamless user feedback states (loading skeletons, toast alerts, error boundaries).

## 🛠️ Stack Standards
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Motion
- **Backend & API**: Express.js + TypeScript + Firebase Admin / Firestore
- **AI & Logic**: Google GenAI SDK (`@google/genai`), Gemini 2.5 / Flash
- **Icons & Charts**: `lucide-react`, `recharts`
- **Package Runner**: `bun` / `bunx` (fallback to `npm` if needed)

