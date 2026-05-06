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

Pokud jsi projekt naklonoval jako `root`, ale deploy bude delat uzivatel `ubuntu`, srovnej vlastnictvi:

```bash
cd /opt/apps
sudo chown -R ubuntu:ubuntu /opt/apps/maietek
```

## 6.1 Pull novych commitu

Bezpecny zaklad pro kazdy dalsi pull:

```bash
cd /opt/apps/maietek
if test -f .env; then
  cp .env /opt/apps/maietek.env.backup
  chmod 600 /opt/apps/maietek.env.backup
fi

git status --short
git pull

if test -f /opt/apps/maietek.env.backup; then
  test -f .env || cp /opt/apps/maietek.env.backup .env
  chmod 600 .env
fi
```

Pokud `git pull` spadne na lokalni zmenu `.env`, nedelej commit produkcnich secretu. Zalohuj `.env`, vrat tracked soubor, pullni a produkcni `.env` vrat zpatky:

```bash
cd /opt/apps/maietek

cp .env /opt/apps/maietek.env.backup
chmod 600 /opt/apps/maietek.env.backup

git restore -- .env
git pull

cp /opt/apps/maietek.env.backup .env
chmod 600 .env
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
git rev-parse --short HEAD
```

Vystup zkopiruj do `.env`:

```env
NEXT_DEPLOYMENT_ID=<short-commit-hash>
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

```bash
cd /opt/apps/maietek

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

Po kazdem buildu over, ze produkcni env hodnoty jsou v kontejnerech nastavene. Prikazy nevypisuji hodnoty secretu, jen jestli existuji:

```bash
docker compose -f docker-compose.prod.yml exec web sh -lc 'for key in GOOGLE_DRIVE_ROOT_FOLDER_ID INTERNAL_API_URL NEXT_PUBLIC_API_URL NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY NEXT_SERVER_ACTIONS_ENCRYPTION_KEY NEXT_DEPLOYMENT_ID; do eval value=\$$key; printf "%s=%s\n" "$key" "${value:+<set>}"; done'
docker compose -f docker-compose.prod.yml exec server sh -lc 'for key in SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_KEY JWT_SECRET REDIS_URL; do eval value=\$$key; printf "%s=%s\n" "$key" "${value:+<set>}"; done'
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
curl -i "https://maietek.maiweb.zip/socket.io/?EIO=4&transport=polling&t=$(date +%s)"
```

Ocekavani:

- web vraci `HTTP 307` na `/dashboard` nebo `HTTP 200` podle aktualni route
- `/health` vraci `{"status":"ok"}`
- `/socket.io/` vraci `HTTP 200`
- telo `/socket.io/` zacina `0{...}`
- `cf-cache-status` u `/socket.io/` nema byt `HIT`

Pak rucne v prohlizeci over:

- login
- Dashboard bez `Auth session missing`
- Superadmin page bez `fetch failed`
- Chat nacte zpravy
- Chat odesle novou zpravu
- Chat smaze zpravu
- Galerie zobrazi media z Google Drive
- Galerie uploadne nove medium
- Galerie smaze medium
- Tasks page bez layout shiftu pri live sync indikatoru

Pokud se po deployi objevi `POST /chat 404` nebo `UnrecognizedActionError`, je to typicky stara klientská Server Actions verze. Ověř, že `.env` ma aktualni `NEXT_DEPLOYMENT_ID`, rebuildni `web` a udelej hard refresh v prohlizeci.

## 14. Cron kontrola

Jednorazove smoke spust pres `web` kontejner, aby se pouzily stejne env hodnoty jako v produkcni Next appce:

```bash
cd /opt/apps/maietek
docker compose -f docker-compose.prod.yml exec web node scripts/run-task-cron.mjs expire
docker compose -f docker-compose.prod.yml exec web node scripts/run-task-cron.mjs recurring
docker compose -f docker-compose.prod.yml exec web node scripts/run-task-cron.mjs monitoring-cleanup
```

Pokud budou bezet z host cronu, spoustej je porad pres Docker Compose z rootu projektu, kde lezi `.env`.

Produkci lze nastavit pres system cron uzivatele, ktery ma pristup k `/opt/apps/maietek/.env`:

```bash
crontab -e
```

Priklad rozvrhu:

```cron
*/10 * * * * cd /opt/apps/maietek && docker compose -f docker-compose.prod.yml exec -T web node scripts/run-task-cron.mjs expire >> /var/log/maietek-cron.log 2>&1
*/15 * * * * cd /opt/apps/maietek && docker compose -f docker-compose.prod.yml exec -T web node scripts/run-task-cron.mjs recurring >> /var/log/maietek-cron.log 2>&1
0 3 * * * cd /opt/apps/maietek && docker compose -f docker-compose.prod.yml exec -T web node scripts/run-task-cron.mjs monitoring-cleanup >> /var/log/maietek-cron.log 2>&1
```

## 15. Chrome extension build

Production extension se builduje zvlast a musi mit live API URL:

```bash
cd /opt/apps/maietek
EXTENSION_API_BASE_URL=https://maietek.maiweb.zip/api pnpm --filter chrome-extension build
```

Do Chrome nacitej slozku:

```text
apps/chrome-extension/dist
```

Po kazdem rebuildu otevri `chrome://extensions` a klikni `Reload` u unpacked extension. Bez reloadu muze zustat aktivni stary service worker s puvodni API URL.

## 16. Kazdy dalsi release

Toto je bezny deploy checklist po tom, co uz VPS bezi:

```bash
cd /opt/apps/maietek

cp .env /opt/apps/maietek.env.backup
chmod 600 /opt/apps/maietek.env.backup

git status --short
git pull

test -f .env || cp /opt/apps/maietek.env.backup .env
chmod 600 .env

git rev-parse --short HEAD
nano .env

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps

curl http://127.0.0.1:4100/health
curl -I https://maietek.maiweb.zip
curl -i "https://maietek.maiweb.zip/socket.io/?EIO=4&transport=polling&t=$(date +%s)"
```

V `.env` pri kazdem release zmen jen:

```env
NEXT_DEPLOYMENT_ID=<short-commit-hash-z-git-rev-parse>
```

`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` nemen pri beznem deployi.

## 17. Rollback

Pokud novy release rozbije produkci, vrat se na predchozi commit a rebuildni kontejnery:

```bash
cd /opt/apps/maietek

git log --oneline -5
git checkout <predchozi-funkcni-commit>

nano .env
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml ps
```

V `.env` pri rollbacku nastav `NEXT_DEPLOYMENT_ID` na commit, na ktery ses vratil:

```bash
git rev-parse --short HEAD
```

Po oprave na `main` se vrat zpatky:

```bash
git checkout main
git pull
```

## 18. Rychly troubleshooting

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

Google Drive hlasi `GOOGLE_DRIVE_ROOT_FOLDER_ID is not configured`:

```bash
cd /opt/apps/maietek
docker compose -f docker-compose.prod.yml config | grep -E 'GOOGLE_DRIVE_ROOT_FOLDER_ID|GOOGLE_DRIVE_OAUTH|INTERNAL_API_URL|NEXT_PUBLIC_API_URL'
docker compose -f docker-compose.prod.yml exec web sh -lc 'for key in GOOGLE_DRIVE_ROOT_FOLDER_ID GOOGLE_DRIVE_OAUTH_CLIENT_ID GOOGLE_DRIVE_OAUTH_CLIENT_SECRET GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN; do eval value=\$$key; printf "%s=%s\n" "$key" "${value:+<set>}"; done'
```

Chat submit/delete timeout:

```bash
docker compose -f docker-compose.prod.yml logs --tail=200 server
docker compose -f docker-compose.prod.yml logs --tail=200 web
```

Chrome extension hlasi `Web API neni dostupne`:

```bash
rg -n 'API_BASE_URL =|maietek\\.maiweb\\.zip|localhost:3000' apps/chrome-extension/dist
EXTENSION_API_BASE_URL=https://maietek.maiweb.zip/api pnpm --filter chrome-extension build
```

Po buildu v Chrome znovu nacti unpacked extension.

## 19. Co nedelat

- nedavat Maietek vlastni Nginx kontejner na `80/443`, kdyz na VPS pobezi vic aplikaci
- neposilat cele `/api/*` nebo cele `/api/chat/*` do Expressu
- necachovat `/socket.io/`, `/api/*` ani `/health` na Cloudflare
- neukladat realne secrety do gitu
- nepouzivat stare nebo revokovane Google OAuth hodnoty
