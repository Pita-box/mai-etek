# Plan: Phase 6 - Polish & OVH Deploy Readiness

## Goal

Připravit aplikaci na první ostrý deploy na `maietek.maiweb.zip` s runtime na OVH VPS:

- `apps/web` jako Next.js aplikace,
- `apps/server` jako Express + Socket.IO server,
- Nginx reverse proxy,
- Let's Encrypt SSL,
- současný Supabase projekt,
- persistentní úložiště pouze Google Drive,
- Chrome extension deploy/test checklist později samostatně.

Současně dokončit Phase 6 polish v aplikaci:

- empty states,
- toast notifications dole uprostřed,
- Framer Motion pro střídmé animace,
- accessibility audit,
- unit testy pro business logiku,
- performance/deploy checklist.

## Scope

Tento plán řeší Phase 6 v několika dávkách. První `/superpowers-execute-plan` by měl implementovat dávku 1, případně dávku 2, pokud bude změna stále rozumně malá. Deploy na reálný VPS se nebude provádět automaticky bez samostatného potvrzení.

## Assumptions

- OVH VPS je cílový runtime pro web i server.
- Vercel se pro první ostrý deploy přeskočí kvůli Socket.IO.
- Doména/subdoména: `maietek.maiweb.zip`.
- API může běžet buď na `https://api.maietek.maiweb.zip/api`, nebo za stejnou doménou přes `/api`; plán preferuje `api.maietek.maiweb.zip`.
- Supabase cloud zůstává současný projekt.
- Před deployem se rotují všechny klíče, které se objevily ve vývojovém `.env`.
- Resend zatím může používat `onboarding@resend.dev`.
- Google Drive je jediné persistentní úložiště médií.
- MinIO nemá být v nové produkční deploy konfiguraci.
- Phase 5 je přeskočená.

## Non-goals

- Nepřepisovat Chat ze Socket.IO na Supabase Realtime.
- Neřešit Chrome extension produkční distribuci v tomto plánu.
- Nemigrovat Supabase cloud na self-hosted Supabase.
- Nemigrovat Google Drive na jiné úložiště.
- Neprovádět reálný deploy bez explicitního dalšího souhlasu.

## Batch 1: Shared Polish Foundations

### 1. EmptyState component

Files:

- `apps/web/src/components/shared/EmptyState.tsx`

Implementation:

- Sdílený empty state s lucide ikonou, titulkem, krátkým popisem a volitelným CTA.
- Styl držet operational dashboard, ne landing/marketing blok.
- Podpora `compact` varianty pro karty/seznamy.
- Vizuálně sladit s existujícím `ErrorState` a skeletony.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/shared/EmptyState.tsx'`

### 2. Toast system

Files:

- `apps/web/src/components/shared/ToastProvider.tsx`
- `apps/web/src/components/shared/useToast.ts`
- `apps/web/src/app/layout.tsx`

Implementation:

- Toasty dole uprostřed vždy.
- Typy: `success`, `error`, `info`.
- Framer Motion použít pro enter/exit animace, respektovat `prefers-reduced-motion`.
- Toasty mají auto-dismiss a ruční zavření.
- Zatím bez externí toast knihovny, pokud vlastní implementace zůstane malá. Pokud bude implementace bobtnat, použít `sonner`.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/shared/ToastProvider.tsx' 'src/components/shared/useToast.ts' 'src/app/layout.tsx'`

### 3. Framer Motion dependency and motion helpers

Files:

- `apps/web/package.json`
- `pnpm-lock.yaml`
- případně `apps/web/src/lib/motion.ts`

Implementation:

- Přidat `framer-motion`.
- Vytvořit malé sdílené motion varianty pro page/card/list entrance.
- Respektovat reduced motion.

Verification:

- `pnpm install`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web build`

## Batch 2: Page-by-page Polish - Tasks First

Priority order from brainstorm:

1. Tasks
2. Chat
3. Gallery
4. Monitoring
5. Superadmin
6. Achievements/Rewards
7. Wishes

### 1. Tasks page polish

Files to inspect first:

- `apps/web/src/components/tasks/TasksClient.tsx`
- `apps/web/src/components/tasks/TaskCard.tsx`
- `apps/web/src/components/tasks/TaskDetailContent.tsx`
- `apps/web/src/actions/tasks.ts`

Implementation:

- Nahradit ruční empty states sdílenou `EmptyState`.
- Přidat toasty pro task create/update/delete/start/submit/approve/reject.
- Přidat jemné list/card animace.
- Zkontrolovat icon-only buttons a doplnit `aria-label`.
- Zkontrolovat mobile layout text overflow.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/tasks/**/*.tsx' 'src/actions/tasks.ts'`
- Ruční smoke:
  - DOM vytvoří task.
  - SUB otevře task list.
  - SUB odešle text evidence.
  - DOM approve/reject.
  - Empty list/filter stav ukáže konzistentní empty state.

### 2. Chat page polish

Design docs:

- Před prací číst `design-system/pages/chat.md`.

Implementation:

- Toasty pro delete/reaction/load/search errors, pokud dávají smysl.
- EmptyState pro prázdný chat/search.
- Animace zpráv jen jemně, bez rozbití scroll behavior.
- Accessibility: composer buttons, voice controls, media lightbox.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/chat/**/*.tsx' 'src/actions/chat.ts'`
- Ruční smoke:
  - načtení chatu,
  - poslání zprávy,
  - vyhledávání bez výsledku,
  - delete/reaction,
  - socket stále funguje.

### 3. Gallery page polish

Implementation:

- EmptyState pro žádná média / žádný výsledek filtru.
- Toasty pro upload/delete/favorite/bulk.
- Animace masonry items opatrně, bez layout shift.
- Accessibility u lightboxu, upload tlačítek a drag/drop oblasti.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/gallery/**/*.tsx' 'src/actions/gallery.ts'`
- Ruční smoke:
  - upload přes file picker,
  - drag/drop,
  - favorite,
  - delete/bulk,
  - empty filter.

### 4. Monitoring page polish

Implementation:

- EmptyState pro timelines, screenshots, devices.
- Toasty pro pairing, rename, revoke, delete event/device.
- Animace jen pro list sections, ne pro screenshot grid heavy load.
- Accessibility pro pagination, filters, external links.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/monitoring/MonitoringClient.tsx' 'src/actions/monitoring.ts'`
- Ruční smoke:
  - pairing code,
  - rename device,
  - revoke/delete,
  - timeline filters,
  - screenshot load more.

### 5. Superadmin polish

Implementation:

- EmptyState pro žádné volné uživatele a žádné SUB účty.
- Toasty pro assign, reveal failure, page access update.
- Accessibility pro password reveal button and page access chips.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/superadmin/SuperAdminClient.tsx' 'src/hooks/useSuperAdmin.ts'`
- Ruční smoke:
  - list users,
  - toggle page access,
  - reveal password.

### 6. Achievements/Rewards polish

Design docs:

- Před Achievements prací číst `design-system/pages/achievements.md`.

Implementation:

- EmptyState pro žádné achievementy/rewards/claims.
- Toasty pro create/edit/delete/manual award/remove/reward claim/approve.
- Framer Motion pro badge/card entrance.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/achievements/**/*.tsx' 'src/components/rewards/**/*.tsx' 'src/actions/gamification.ts' 'src/actions/rewards.ts'`

### 7. Wishes polish

Implementation:

- EmptyState pro žádná přání / žádný výsledek filtru.
- Toasty pro create/update/delete/status/media upload.
- Accessibility pro status controls, media upload, lightbox.

Verification:

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint 'src/components/wishes/**/*.tsx' 'src/actions/wishes.ts'`

## Batch 3: Unit Test Setup

Files:

- `apps/web/package.json`
- `apps/web/vitest.config.ts`
- `apps/web/src/**/*.test.ts`
- případně `packages/*` test scripts

Implementation:

- Přidat Vitest pro business logic.
- Začít pure helper testy:
  - `apps/web/src/lib/api-url.ts`
  - `apps/web/src/lib/page-access/config.ts`
  - `apps/web/src/lib/tasks/ids.ts`
  - vybrané limity/normalizace pro gallery/wishes/tasks media.
- Přidat script `test` do `apps/web/package.json`.
- Upravit root/turbo test pipeline jen pokud bude potřeba.

Verification:

- `pnpm --filter web test`
- `pnpm test`

## Batch 4: Accessibility Audit

Implementation:

- Projít hlavní stránky podle priority.
- Doplnit:
  - `aria-label` pro icon-only buttons,
  - `aria-live` pro důležité async stavy,
  - focus-visible ring,
  - dialog/sheet title/description tam, kde chybí,
  - správné labels u inputů/selectů.
- Zkontrolovat mobile navigation.

Verification:

- `pnpm --filter web exec eslint`
- Ruční keyboard pass:
  - Tab/Shift+Tab v navigation,
  - forms,
  - modals/lightbox,
  - gallery upload,
  - monitoring filters.

## Batch 5: Performance Pass

Implementation:

- Zkontrolovat `next/image` použití a lazy loading.
- Heavy client sections připravit na dynamic imports, pokud bundle check ukáže problém.
- Monitoring/gallery dotazy: zkontrolovat pagination, limitování a případné server-side filtry.
- Přidat bundle analyze script, pokud bude potřeba.

Verification:

- `pnpm --filter web build`
- Lighthouse nebo lokální browser performance smoke.
- Network smoke pro Gallery/Monitoring thumbnails.

## Batch 6: OVH VPS Deploy Readiness

### 1. Production scripts

Files:

- `apps/server/package.json`
- `apps/web/package.json`
- root `package.json`

Implementation:

- Doplnit `start` script pro `apps/server` (`node dist/index.js`).
- Ověřit Next production start.
- Ověřit build order: packages -> server -> web.

Verification:

- `pnpm --filter server build`
- `pnpm --filter web build`

### 2. Production env templates

Files:

- `.env.example`
- případně `docs/DEPLOYMENT.md`

Implementation:

- Rozdělit / jasně popsat:
  - web env,
  - server env,
  - shared env.
- Použít:
  - `SITE_URL=https://maietek.maiweb.zip`
  - `NEXT_PUBLIC_API_URL=https://api.maietek.maiweb.zip/api`
  - server CORS origin pro `https://maietek.maiweb.zip`
  - Supabase current project values after rotation
  - Google Drive service account after rotation
  - Telegram token/chat id after rotation
  - Resend `onboarding@resend.dev` for now.
- Explicitně nedokumentovat skutečné secret hodnoty.

Verification:

- `rg -n "localhost|MINIO|SUPABASE_SERVICE_KEY=.*eyJ|TELEGRAM_BOT_TOKEN=.*:" .env.example README.md docs`

### 3. Docker/PM2 decision

Recommended implementation:

- Prefer Docker Compose for OVH runtime:
  - `web` service
  - `server` service
  - `redis` service only if current runtime requires it
  - `nginx` service or host Nginx
  - `certbot` optional
- No MinIO service.
- No local PostgreSQL/Supabase service for production because current Supabase cloud is used.

Files:

- `docker-compose.prod.yml`
- `docker/Dockerfile.web`
- `docker/Dockerfile.server`
- `docker/nginx/maietek.conf`
- `docs/DEPLOYMENT.md`

Verification:

- `docker compose -f docker-compose.prod.yml config`
- local build smoke if Docker is available:
  - `docker compose -f docker-compose.prod.yml build`

### 4. Nginx routing

Preferred production routing:

- `https://maietek.maiweb.zip` -> web `localhost:3000`
- `https://api.maietek.maiweb.zip` -> server `localhost:4000`
- Socket.IO upgrade:
  - `proxy_http_version 1.1`
  - `Upgrade`
  - `Connection "upgrade"`

Verification:

- Nginx config test on VPS:
  - `sudo nginx -t`
- Runtime smoke:
  - `curl https://api.maietek.maiweb.zip/health`
  - open web and Chat.

### 5. Cron jobs

Use existing script:

- `scripts/run-task-cron.mjs expire`
- `scripts/run-task-cron.mjs recurring`
- `scripts/run-task-cron.mjs monitoring-cleanup`

Implementation:

- Update deployment docs with production crontab paths.
- Ensure `CRON_SECRET` is loaded server-side, not inline in crontab.

Verification:

- `node scripts/run-task-cron.mjs expire`
- Check logs.

### 6. Key rotation checklist

Must rotate before production:

- Supabase service role key if exposed.
- Supabase anon key if desired.
- Google Drive service account private key.
- Telegram bot token.
- Resend API key.
- JWT secret.
- Cron secret.
- Any DB password or old MinIO values that are no longer used.

Verification:

- `rg -n "eyJ|AA[A-Za-z0-9_-]{20,}|re_[A-Za-z0-9_]+|BEGIN PRIVATE KEY|SuperSecretPassword|1Hummer" . README.md docs apps -g '!node_modules/**'`
- Confirm no real secrets in tracked docs/templates.

## Batch 7: Documentation Updates

Files:

- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DEPLOYMENT.md`
- `artifacts/superpowers/finish.md`

Implementation:

- Update Phase 6 checklist as batches complete.
- Document OVH as current production deploy target.
- Remove/mark outdated Vercel-first instructions where misleading.
- Document Google Drive only.
- Document Chrome extension production checklist as later separate task.

Verification:

- `rg -n "Vercel|MinIO|localhost:4000|Phase 5|Safe Word|WebRTC" README.md docs/ARCHITECTURE.md docs/DEPLOYMENT.md`
- Manual review.

## Overall Verification Matrix

Run after each meaningful batch:

```bash
pnpm --filter web exec tsc --noEmit
pnpm --filter web exec eslint <changed web files>
pnpm --filter server build
pnpm --filter web build
git diff --check -- <changed files>
```

Run after test setup:

```bash
pnpm --filter web test
pnpm test
```

Run before production deploy:

```bash
pnpm build
docker compose -f docker-compose.prod.yml config
rg -n "localhost|MINIO|BEGIN PRIVATE KEY|TELEGRAM_BOT_TOKEN=.*:|SUPABASE_SERVICE_KEY=.*eyJ|RESEND_API_KEY=re_" .env.example README.md docs apps -g '!node_modules/**'
```

## Review Pass

### Blocker

- `apps/server` with Socket.IO cannot run on Vercel Functions as-is; OVH VPS runtime solves this without chat refactor.
- Real production deploy must not happen before key rotation.

### Major

- Current `docker/docker-compose.yml` includes local Supabase DB and MinIO; production config must not reuse it blindly.
- Toast rollout across all mutations can create duplicated feedback if inline messages are not reviewed.
- Framer Motion should be used sparingly to avoid performance regressions.

### Minor

- Some old docs may still mention Vercel/MinIO; documentation cleanup should be part of deploy readiness.
- Unit tests should start with pure business logic, not component tests, to keep initial test setup stable.

## Success Criteria

- Phase 6 UI foundations are present and used on priority pages.
- Mutations produce bottom-center toast feedback.
- Empty states are consistent and not marketing-like.
- Framer Motion is installed and used with reduced-motion awareness.
- Unit test setup exists and has meaningful business logic coverage.
- OVH deploy docs/config exist for web + server + Nginx + cron.
- Production env checklist is clear and secrets are not committed.
- `docs/ARCHITECTURE.md` accurately reflects OVH VPS + Google Drive + current Supabase.

