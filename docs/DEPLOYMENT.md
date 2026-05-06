# Deployment

Tento dokument popisuje prvni produkcni cil pro Phase 6. Realny deploy se nespousti automaticky; pred nasazenim musi byt potvrzene DNS, env promenne a rotace klicu.

## Cilovy runtime

- Web: `https://maietek.maiweb.zip`
- API a Socket.IO: pod stejnou subdomenou `https://maietek.maiweb.zip/api` a `https://maietek.maiweb.zip/socket.io`
- Databaze a auth: soucasny Supabase cloud projekt
- Media: Google Drive pres OAuth refresh token
- Cache: Redis pouze pro volitelne serverove cache
- Reverse proxy a SSL: jeden sdileny Nginx na OVH VPS pro vice aplikaci + Let's Encrypt / Cloudflare

`NEXT_PUBLIC_API_URL` musi ukazovat na Express + Socket.IO server:

```env
NEXT_PUBLIC_API_URL=https://maietek.maiweb.zip/api
INTERNAL_API_URL=http://server:4000/api
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64-32-byte-key>
NEXT_DEPLOYMENT_ID=<deployment-version>
```

Chat funguje pres stejnou subdomenu jen tehdy, kdyz sdileny reverse proxy smeruje pouze Express cesty na `apps/server` a nenecha spolknout Next API routy pro media a cron.
Server-side chat akce ve web kontejneru pouzivaji `INTERNAL_API_URL`, aby pri Docker deployi nemusely obchazet pres Cloudflare.

## Env rozdeleni

### Web runtime

`apps/web` potrebuje:

```env
NODE_ENV=production
SITE_URL=https://maietek.maiweb.zip
NEXT_PUBLIC_API_URL=https://maietek.maiweb.zip/api
INTERNAL_API_URL=http://server:4000/api
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<supabase-anon-key>
SUPABASE_SERVICE_KEY=<supabase-service-role-key>
CRON_SECRET=<strong-random-cron-secret>
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=<base64-32-byte-key>
NEXT_DEPLOYMENT_ID=<deployment-version>
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

## Docker Compose

Produkci lze spustit pres samostatny compose soubor:

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Soubor `docker-compose.prod.yml` obsahuje:

- `web` - Next.js runtime dostupny na `127.0.0.1:3100`,
- `server` - Express + Socket.IO runtime dostupny na `127.0.0.1:4100`,
- `redis` - volitelna cache pro serverove API,
- bez vlastniho Nginx reverse proxy kontejneru.

Produkce zamerne neobsahuje MinIO ani lokalni PostgreSQL. Databaze zustava v Supabase cloudu a media zustavaji v Google Drive.

Env hodnoty se predavaji pres shell environment nebo `.env` soubor na serveru. Jako vychozi seznam slouzi `.env.example`; skutecne hodnoty nepatri do repozitare.

`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` a `NEXT_DEPLOYMENT_ID` se predavaji i jako Docker build args pro `web`, protoze Next.js je potrebuje uz pri buildu klienta.

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` musi zustat stabilni mezi buildy. Vygeneruj ho jednou pres `openssl rand -base64 32` a nemen pri beznych deployich. `NEXT_DEPLOYMENT_ID` naopak nastavuj pro kazdy release, napr. na `git rev-parse --short HEAD`, aby Next dokazal detekovat version skew a klient nevolal stare Server Actions po novem deployi.

## DNS a SSL

DNS:

- `maietek.maiweb.zip` smeruje na verejnou IPv4/IPv6 adresu OVH VPS,
- Cloudflare muze zustat v rezimu `Proxied`,
- SSL/TLS mod v Cloudflare ma byt `Full (strict)`.

Ukazkova konfigurace pro sdileny host Nginx je v `docker/nginx/maietek.shared-host.conf`.

Konfigurace ocekava Let's Encrypt certifikat v:

```text
/etc/letsencrypt/live/maietek.maiweb.zip/fullchain.pem
/etc/letsencrypt/live/maietek.maiweb.zip/privkey.pem
```

Po vydani nebo obnoveni certifikatu restartuj sdileny host Nginx:

```bash
sudo systemctl reload nginx
```

Sdileny host Nginx musi routovat:

- `/socket.io/` -> `127.0.0.1:4100`
- `/api/auth/*` -> `127.0.0.1:4100`
- `/api/superadmin/*` -> `127.0.0.1:4100`
- `/api/user/*` -> `127.0.0.1:4100`
- `/api/chat/messages*` -> `127.0.0.1:4100`
- vse ostatni -> `127.0.0.1:3100`

Toto rozdeleni je dulezite, protoze Next app ma vlastni `/api/*` routy pro media proxy a cron endpointy. Hlavne neposilat cele `/api/chat/*` do Expressu, protoze `/api/chat/media/*` patri Next media proxy.

Pokud je Cloudflare v rezimu `Proxied`, `/socket.io/`, `/api/*` a `/health` musi mit cache bypass. Socket.IO handshake nesmi vracet `cf-cache-status: HIT`, jinak klienti muzou dostat stary session id a realtime bude nestabilni.

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
curl https://maietek.maiweb.zip/health
curl -i 'https://maietek.maiweb.zip/socket.io/?EIO=4&transport=polling&t=smoke1'
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
