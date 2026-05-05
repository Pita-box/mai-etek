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
NEXT_PUBLIC_APP_URL=https://maietek.maiweb.zip
NEXT_PUBLIC_SITE_URL=https://maietek.maiweb.zip
TASK_CRON_BASE_URL=https://maietek.maiweb.zip
WEB_BUILD_NODE_OPTIONS=--max-old-space-size=3072

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

## 8. Docker compose kontrola a build

```bash
docker compose -f docker-compose.prod.yml config
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
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

## 11. Jak musi byt routovany provoz

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

## 12. Verejny smoke test

Z VPS nebo z lokalniho pocitace:

```bash
curl -I https://maietek.maiweb.zip
curl https://maietek.maiweb.zip/health
```

Pak rucne v prohlizeci over:

- login
- superadmin
- gallery zobrazeni
- gallery upload
- gallery delete
- chat nacteni zprav
- chat realtime pripojeni
- tasky

## 13. Cron kontrola

```bash
node scripts/run-task-cron.mjs expire
node scripts/run-task-cron.mjs recurring
node scripts/run-task-cron.mjs monitoring-cleanup
```

Pokud budou bezet z cronu mimo kontejner, spoustej je z rootu projektu, kde lezi `.env`.

## 14. Aktualizace po dalsim release

```bash
cd /opt/apps/maietek
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

## 15. Rychly troubleshooting

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

## 16. Co nedelat

- nedavat Maietek vlastni Nginx kontejner na `80/443`, kdyz na VPS pobezi vic aplikaci
- neposilat cele `/api/*` nebo cele `/api/chat/*` do Expressu
- neukladat realne secrety do gitu
- nepouzivat stare nebo revokovane Google OAuth hodnoty
