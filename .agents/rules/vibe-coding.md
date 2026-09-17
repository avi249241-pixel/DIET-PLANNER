# Vibe Coding Protocol & Automation Rules

## 1. Autonomous Execution Directives
- **Zero Interruption Principle**: Proactively solve errors, fix type issues, install missing types, and seed realistic mock data without waiting for user permission.
- **Modern UI Standard**: Always use Tailwind CSS v4, Motion (Framer Motion) micro-interactions, clean glassmorphism styles, Lucide icons, and responsive layouts.
- **Continuous Validation**: Automatically run type check (`bunx tsc --noEmit`) and verify code builds cleanly on every major update.
- **Local-First & Offline Resilience**: Ensure local storage and heuristic fallbacks prevent any empty screens or crashes if external network / APIs are unavailable.

## 2. Tech Stack Reference
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS v4 + Motion
- **Backend & Database**: Express.js + Drizzle ORM + PostgreSQL / Firebase Admin
- **AI Integration**: Google GenAI SDK (`@google/genai`)
- **Package Manager**: Bun (`bun`, `bunx`) / fallback npm
