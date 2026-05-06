# Deploy Steps

Tento dokument je prakticky checklist pro prvni deploy aplikace Maietek na OVH VPS s Ubuntu 24.04, Cloudflare DNS a vice web aplikacemi na jednom serveru.

Predpoklady:

- DNS `maietek.maiweb.zip` uz smeruje na VPS
- Cloudflare proxy je zapnuta (`Proxied`)
- Cloudflare SSL/TLS mod je `Full (strict)`
- aplikace bude bezet za sdilenym host Nginx
- Maietek Docker stack nebude bindovat `80/443`, pouze loopback porty:
  - web: `127.0.0.1:3100`
  - server: `127.0.0.1:4100`

## 1. Lokalni priprava

Ujisti se, ze mas vsechny deploy zmeny commitnute a pushnute do gitu:

```bash
git status
git add .
git commit -m "Prepare OVH deploy"
git push
```

## 2. Prihlaseni na VPS

```bash
ssh root@141.227.135.23

nebo

ssh -i ~/.ssh/ovh_maietek ubuntu@141.227.135.23

```

## 3. Zakladni setup Ubuntu

```bash
apt update && apt upgrade -y
pro ubuntu user role:
sudo apt update && sudo apt upgrade -y

apt install -y git curl ca-certificates gnupg ufw nginx snapd
pro ubuntu user role:
sudo apt install -y git curl ca-certificates gnupg ufw nginx snapd

```

Firewall:

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

## 4. Instalace Dockeru

Když nejsi root, přidej před příkazy sudo, nebo nejdřív:
sudo -i

pak vlož spusť toto celý:
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do apt remove -y $pkg; done

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

tee /etc/apt/sources.list.d/docker.sources > /dev/null <<'EOF'
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: noble
Components: stable
Architectures: amd64
Signed-By: /etc/apt/keyrings/docker.asc
EOF

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

Ověření:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

## 5. Cloudflare Origin Certificate

V Cloudflare:

- otevri `SSL/TLS`
- otevri `Origin Server`
- klikni `Create Certificate`

Doporucene hostname:

```text
maietek.maiweb.zip
*.maiweb.zip
```

Na VPS uloz certifikat:

```bash
sudo mkdir -p /etc/ssl/cloudflare
sudo nano /etc/ssl/cloudflare/maiweb-origin.pem

sudo nano /etc/ssl/cloudflare/maiweb-origin.key
sudo chmod 600 /etc/ssl/cloudflare/maiweb-origin.key
sudo chmod 644 /etc/ssl/cloudflare/maiweb-origin.pem

```

## 6. Naklonovani projektu

```bash
mkdir -p /opt/apps
cd /opt/apps
git clone <TVUJ_REPO_URL> maietek
cd /opt/apps/maietek
```

## Pull Github new commits

cd /opt/apps
sudo chown -R ubuntu:ubuntu /opt/apps/maietek

cd /opt/apps/maietek
git pull

## CHYBA:

error: Your local changes to the following files would be overwritten by merge:
.env
Please commit your changes or stash them before you merge.
Aborting

## FIX:

cd /opt/apps/maietek

cp .env /opt/apps/maietek.env.backup
chmod 600 /opt/apps/maietek.env.backup

git restore -- .env
git pull

cp /opt/apps/maietek.env.backup .env
chmod 600 .env

## CHECK GOOGLE VARIABLE for example:

docker compose -f docker-compose.prod.yml config | grep -E 'GOOGLE_DRIVE_ROOT_FOLDER_ID|INTERNAL_API_URL|NEXT_PUBLIC_API_URL'

## 7. Produkcni env soubor

```bash
cp .env.example .env
nano .env
```

Minimalne zkontroluj a dopln:

```env
NODE_ENV=production
SITE_URL=https://maietek.maiweb.zip
WEB_URL=https://maietek.maiweb.zip
NEXT_PUBLIC_API_URL=https://maietek.maiweb.zip/api
INTERNAL_API_URL=http://server:4000/api
NEXT_PUBLIC_APP_URL=https://maietek.maiweb.zip
NEXT_PUBLIC_SITE_URL=https://maietek.maiweb.zip
TASK_CRON_BASE_URL=https://maietek.maiweb.zip
WEB_BUILD_NODE_OPTIONS=--max-old-space-size=3072
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=...
NEXT_DEPLOYMENT_ID=...

NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...

GOOGLE_DRIVE_ROOT_FOLDER_ID=...
GOOGLE_DRIVE_OAUTH_CLIENT_ID=...
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=...
GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN=...

RESEND_API_KEY=...
EMAIL_FROM=onboarding@resend.dev

TELEGRAM_BOT_TOKEN=...

JWT_SECRET=...
CRON_SECRET=...
REDIS_URL=redis://redis:6379
```

Bezpecne secrety vygeneruj:

```bash
openssl rand -hex 32
```

Pouzij pro:

- `JWT_SECRET`
- `CRON_SECRET`

Next Server Actions key musi byt base64 AES key:

```bash
openssl rand -base64 32
```

Pouzij pro:

- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`

`NEXT_DEPLOYMENT_ID` nastav pri kazdem deployi na aktualni git commit, aby se klientovi nepletly stare a nove Server Actions:

```bash
export NEXT_DEPLOYMENT_ID=$(git rev-parse --short HEAD)
```

Po zmene `.env` vzdy zkontroluj, ze hodnoty vidi i Docker Compose:

```bash
docker compose -f docker-compose.prod.yml config | grep -E 'GOOGLE_DRIVE_ROOT_FOLDER_ID|INTERNAL_API_URL|NEXT_PUBLIC_API_URL|NEXT_PUBLIC_SUPABASE_URL|SUPABASE_URL|NEXT_SERVER_ACTIONS_ENCRYPTION_KEY|NEXT_DEPLOYMENT_ID'
```

Po restartu over hodnoty primo v bezicich kontejnerech bez vypsani secretu:

```bash
docker compose -f docker-compose.prod.yml exec web sh -lc 'for key in GOOGLE_DRIVE_ROOT_FOLDER_ID GOOGLE_DRIVE_OAUTH_CLIENT_ID GOOGLE_DRIVE_OAUTH_CLIENT_SECRET GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN INTERNAL_API_URL NEXT_PUBLIC_API_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY NEXT_SERVER_ACTIONS_ENCRYPTION_KEY NEXT_DEPLOYMENT_ID; do eval value=\$$key; printf "%s=%s\n" "$key" "${value:+<set>}"; done'

docker compose -f docker-compose.prod.yml exec server sh -lc 'for key in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY JWT_SECRET REDIS_URL; do eval value=\$$key; printf "%s=%s\n" "$key" "${value:+<set>}"; done'
```

## 8. Docker compose kontrola a build

## spustění build

```bash
cd /opt/apps/maietek

sudo docker compose -f docker-compose.prod.yml config
sudo docker compose -f docker-compose.prod.yml build
sudo docker compose -f docker-compose.prod.yml up -d
sudo docker compose -f docker-compose.prod.yml ps

```

Pokud Docker build spadne na `Cannot find module '/app/scripts/ensure-pnpm.js'`, stahni posledni verzi repozitare a rebuildni image:

```bash
git pull
docker compose -f docker-compose.prod.yml build --no-cache
docker compose -f docker-compose.prod.yml up -d
```

Pokud Docker build spadne na `JavaScript heap out of memory` pri `pnpm --filter web build`, zvys build heap a pripadne pridej swap:

```bash
free -h
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Pak nastav v `.env` napr.:

```env
WEB_BUILD_NODE_OPTIONS=--max-old-space-size=4096
```

A rebuildni web:

```bash
docker compose -f docker-compose.prod.yml build --no-cache web
docker compose -f docker-compose.prod.yml up -d
```

## 9. Lokalni smoke test na VPS

Nez zapnes Nginx proxy, over interni porty:

```bash
curl http://127.0.0.1:3100
curl http://127.0.0.1:4100/health
```

Pokud `127.0.0.1:4100/health` nevraci JSON se stavem `ok`, nejdriv oprav backend.

Logy:

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f server
```

## 10. Sdileny host Nginx

Pouzij sdilenou site konfiguraci:

```bash
cp docker/nginx/maietek.shared-host.conf /etc/nginx/sites-available/maietek.conf
```

Prepis cesty na certifikaty:

```bash
sed -i 's|/etc/letsencrypt/live/maietek.maiweb.zip/fullchain.pem|/etc/ssl/cloudflare/maiweb-origin.pem|' /etc/nginx/sites-available/maietek.conf
sed -i 's|/etc/letsencrypt/live/maietek.maiweb.zip/privkey.pem|/etc/ssl/cloudflare/maiweb-origin.key|' /etc/nginx/sites-available/maietek.conf
```

Zapni site:

```bash
ln -sf /etc/nginx/sites-available/maietek.conf /etc/nginx/sites-enabled/maietek.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

## 11. Cloudflare cache pravidlo

Realtime a backend API nesmi byt cachovane na Cloudflare. V `Rules` -> `Cache Rules` vytvor pravidlo pro `maietek.maiweb.zip`:

```text
(http.host eq "maietek.maiweb.zip" and (starts_with(http.request.uri.path, "/socket.io/") or starts_with(http.request.uri.path, "/api/") or http.request.uri.path eq "/health"))
```

Akce:

```text
Bypass cache
```

Toto pravidlo dej nad pripadna obecna cache pravidla pro web.

## 12. Jak musi byt routovany provoz

Sdileny Nginx musi routovat:

- `/socket.io/` -> `127.0.0.1:4100`
- `/api/auth/*` -> `127.0.0.1:4100`
- `/api/superadmin/*` -> `127.0.0.1:4100`
- `/api/user/*` -> `127.0.0.1:4100`
- `/api/chat/messages*` -> `127.0.0.1:4100`
- vse ostatni -> `127.0.0.1:3100`

To je dulezite, protoze:

- Express obsluhuje auth, superadmin, user a chat messages API
- Next obsluhuje media proxy a cron routy
- cele `/api/chat/*` se nesmi posilat do Expressu, protoze `/api/chat/media/*` patri Next appce

## 13. Verejny smoke test

Z VPS nebo z lokalniho pocitace:

```bash
curl -I https://maietek.maiweb.zip
curl https://maietek.maiweb.zip/health
curl -i 'https://maietek.maiweb.zip/socket.io/?EIO=4&transport=polling&t=smoke1'
```

U `/socket.io/` cekej `HTTP/2 200`, telo zacinajici `0{...}` a `cf-cache-status` nema byt `HIT`.

Pak rucne v prohlizeci over:

- login
- superadmin
- gallery zobrazeni
- gallery upload
- gallery delete
- chat nacteni zprav
- chat realtime pripojeni
- tasky

## 14. Cron kontrola

```bash
node scripts/run-task-cron.mjs expire
node scripts/run-task-cron.mjs recurring
node scripts/run-task-cron.mjs monitoring-cleanup
```

Pokud budou bezet z cronu mimo kontejner, spoustej je z rootu projektu, kde lezi `.env`.

## 15. Aktualizace po dalsim release

```bash
cd /opt/apps/maietek
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

## 16. Rychly troubleshooting

Backend nebezi:

```bash
docker compose -f docker-compose.prod.yml logs -f server
curl http://127.0.0.1:4100/health
```

Web nebezi:

```bash
docker compose -f docker-compose.prod.yml logs -f web
curl http://127.0.0.1:3100
```

Nginx chyba:

```bash
nginx -t
journalctl -u nginx -n 200 --no-pager
```

Cloudflare / SSL problem:

- over, ze DNS stale ukazuje na `141.227.135.23`
- over, ze Cloudflare zustal v `Full (strict)`
- over, ze origin cert odpovida `maietek.maiweb.zip`

## 17. Co nedelat

- nedavat Maietek vlastni Nginx kontejner na `80/443`, kdyz na VPS pobezi vic aplikaci
- neposilat cele `/api/*` nebo cele `/api/chat/*` do Expressu
- necachovat `/socket.io/`, `/api/*` ani `/health` na Cloudflare
- neukladat realne secrety do gitu
- nepouzivat stare nebo revokovane Google OAuth hodnoty
