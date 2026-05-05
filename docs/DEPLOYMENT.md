# Deployment

Tento dokument popisuje prvni produkcni cil pro Phase 6. Realny deploy se nespousti automaticky; pred nasazenim musi byt potvrzene DNS, env promenne a rotace klicu.

## Cilovy runtime

- Web: `https://maietek.maiweb.zip`
- API a Socket.IO: `https://api.maietek.maiweb.zip`
- Databaze a auth: soucasny Supabase cloud projekt
- Media: Google Drive pres OAuth refresh token
- Cache: Redis pouze pro volitelne serverove cache
- Reverse proxy a SSL: OVH VPS + Nginx + Let's Encrypt

`NEXT_PUBLIC_API_URL` musi ukazovat na Express + Socket.IO server:

```env
NEXT_PUBLIC_API_URL=https://api.maietek.maiweb.zip/api
```

Tato URL neni webova domena. Chat bude fungovat az ve chvili, kdy `api.maietek.maiweb.zip` existuje v DNS, vede na `apps/server` a proxy podporuje Socket.IO upgrade.

## Env rozdeleni

### Web runtime

`apps/web` potrebuje:

```env
NODE_ENV=production
SITE_URL=https://maietek.maiweb.zip
NEXT_PUBLIC_API_URL=https://api.maietek.maiweb.zip/api
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_KEY=<supabase-service-role-key>
CRON_SECRET=<strong-random-cron-secret>
GOOGLE_DRIVE_ROOT_FOLDER_ID=<google-drive-root-folder-id>
GOOGLE_DRIVE_OAUTH_CLIENT_ID=<google-oauth-client-id>
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=<google-oauth-client-secret>
GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=<google-oauth-refresh-token>
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
```

`SUPABASE_SERVICE_ROLE_KEY` je podporovana alternativa k `SUPABASE_SERVICE_KEY` pro Next server-side admin helpery.

### Server runtime

`apps/server` potrebuje:

```env
NODE_ENV=production
PORT=4000
WEB_URL=https://maietek.maiweb.zip
SITE_URL=https://maietek.maiweb.zip
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_KEY=<supabase-service-role-key>
JWT_SECRET=<strong-random-jwt-secret>
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
REDIS_URL=redis://redis:6379
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=onboarding@resend.dev
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
```

Telegram channel variables jsou volitelne podle pouzitych notifikaci:

```env
TELEGRAM_CHAT_ID=<default-telegram-chat-id>
TELEGRAM_DOM_CHAT_ID=<dom-telegram-chat-id>
TELEGRAM_TASKS_CHAT_ID=<tasks-telegram-chat-id>
TELEGRAM_WISHES_CHAT_ID=<wishes-telegram-chat-id>
TELEGRAM_MONITORING_CHAT_ID=<monitoring-telegram-chat-id>
TELEGRAM_SECURITY_CHAT_ID=<security-telegram-chat-id>
TELEGRAM_PRESENCE_CHAT_ID=<presence-telegram-chat-id>
```

## Build a start

Produkci builduj z rootu repozitare:

```bash
pnpm install --frozen-lockfile
pnpm build
```

Samostatne runtime prikazy:

```bash
pnpm --filter server start
pnpm --filter web start
```

Root aliasy:

```bash
pnpm start:server
pnpm start:web
```

## Cron

Cron routy jsou na web runtime a chrani je `CRON_SECRET`. Secret se nacita z env, nepatri primo do crontabu.

```bash
node scripts/run-task-cron.mjs expire
node scripts/run-task-cron.mjs recurring
node scripts/run-task-cron.mjs monitoring-cleanup
```

Produkce:

```env
TASK_CRON_BASE_URL=https://maietek.maiweb.zip
CRON_SECRET=<strong-random-cron-secret>
```

## Smoke test po nasazeni

```bash
curl -I https://maietek.maiweb.zip
curl https://api.maietek.maiweb.zip/health
node scripts/run-task-cron.mjs expire
```

Rucne overit:

- prihlaseni a reset hesla,
- galerie: zobrazeni, upload, mazani,
- chat: REST nacteni zprav a Socket.IO pripojeni,
- ukoly: vytvoreni, odevzdani, schvaleni,
- monitoring extension sync pouze pokud je extension aktualne v rozsahu testu.

## Rotace pred ostrou produkci

Pred realnym deployem zrotovat vse, co se objevilo ve vyvojovych env souborech:

- Supabase service role key,
- Supabase anon key podle potreby,
- Google OAuth client secret a refresh token,
- Telegram bot token,
- Resend API key,
- `JWT_SECRET`,
- `CRON_SECRET`,
- databazove heslo, pokud bylo sdilene mimo secure storage.

Secret hodnoty nepatri do dokumentace, commitu ani shell historie.
