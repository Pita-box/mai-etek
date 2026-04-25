# Phase 1: Base Environment & Auth Scaffolding Plan

## 1. Monorepo Initialization
- Initialize Turborepo using pnpm.
- Configure workspace structure (`apps/web`, `apps/api`, `packages/config`, `packages/db`).
- Set up global `tsconfig.json` and basic linting/formatting in `packages/config`.

## 2. Next.js (Web) Scaffolding
- Create a Next.js 14+ (App Router) app in `apps/web`.
- Configure Tailwind CSS, setup initial `globals.css`.
- Install core UI dependencies (`lucide-react`, `clsx`, `tailwind-merge`).
- Setup basic app layout structure (Root layout).

## 3. Express (API) Scaffolding
- Create an Express + TypeScript app in `apps/api`.
- Setup basic middleware (CORS, JSON parsing).
- Create basic folder structure (`routes`, `controllers`, `services`, `middlewares`).
- Add simple health check endpoint.

## 4. Local Infrastructure (Docker)
- Create `docker-compose.yml` in project root.
- Configure Supabase local stack (PostgreSQL, GoTrue, PostgREST, Realtime, Storage).
- Verify Supabase starts correctly and is accessible.

## 5. Auth Scaffolding
- Define basic Supabase schema for Users in a migration file (or via Supabase CLI).
- **Web App:**
  - Create `app/(auth)/login/page.tsx` (simple UI placeholder).
  - Create `app/(auth)/register/page.tsx` (simple UI placeholder).
- **API App:**
  - Create stub routes for `POST /api/auth/register` and `POST /api/auth/login`.

## Execution Notes
- Execute sequentially to ensure dependencies are correctly configured.
- Focus strictly on scaffolding; deep implementations are left for subsequent phases.
