# Brainstorm: Chrome Extension Phase 4 - Extension Scaffold

## Cíl
Začít Phase 4 podle `docs/ARCHITECTURE.md` a postavit základ Chrome Extension tak, aby šla bezpečně rozšiřovat o monitoring:
- Manifest V3,
- build konfigurace,
- popup UI,
- přihlášení SUB účtu,
- ukládání session do `chrome.storage`,
- API client,
- základní connection/status heartbeat,
- safe word toggle jako první viditelný bezpečnostní prvek.

## Aktuální stav
- `apps/chrome-extension` už existuje.
- Má `package.json` s TypeScript/Webpack dependencies.
- `src/background`, `src/content`, `src/popup`, `src/shared`, `src/webcam` adresáře existují, ale aktuálně neobsahují zdrojové soubory.
- `build` script zatím jen vypisuje `Skipping build for now`.
- Web aplikace už má:
  - Supabase Auth,
  - role DOM/SUB,
  - DOM-only Monitoring stránku v navigaci,
  - Telegram/Socket.IO infra,
  - `NEXT_PUBLIC_API_URL` bez localhost fallbacků ve web runtime kódu.

## Doporučený první krok
Nezačínat hned monitoringem. Nejdřív udělat pevný extension scaffold:
1. `manifest.json` pro Manifest V3.
2. Webpack build pro:
   - background service worker,
   - popup HTML/TS/CSS,
   - content script placeholder.
3. Shared config:
   - `API_BASE_URL` z build-time env,
   - žádný hardcoded localhost fallback.
4. Auth flow:
   - SUB zadá e-mail/heslo v popupu,
   - extension zavolá API/Supabase auth endpoint,
   - uloží access/refresh token do `chrome.storage.local`,
   - umí logout.
5. Popup:
   - login view,
   - connected/status view,
   - safe word toggle,
   - poslední sync/status/chyba.
6. API client:
   - automatický bearer token,
   - JSON error handling,
   - timeout,
   - jasné české chybové zprávy.
7. Background heartbeat:
   - periodicky ověří přihlášení a uloží `lastSeenAt`,
   - později se napojí na monitoring sync.

## Bezpečnostní a produktové hranice
- Extension musí být viditelná a ovladatelná v popupu.
- Monitoring nesmí být skrytý nebo maskovaný.
- Safe word musí mít přednost před synchronizací a budoucím monitoringem.
- Nejdřív scaffold + auth + status. Až potom samostatně řešit history/screenshot/content script/webcam.
- Bez `localhost` fallbacků v runtime; pro dev/live musí být explicitní env/config.
- Tokeny neukládat do plain souborů ani logů; `chrome.storage.local` je minimum pro MVP.

## Co zatím nedělat
- Keylogger/content capture.
- Screenshot capture.
- Webcam/offscreen recording.
- Batch sync do databáze.
- Monitoring dashboard detail.

Tyto věci přijdou až po ověřeném základu, protože jinak by se špatně ladilo, co selhalo: auth, storage, build, permissions, nebo samotný capture.

## Návrh architektury extension
```text
apps/chrome-extension
  public/
    manifest.json
  src/
    background/
      service-worker.ts
    content/
      index.ts
    popup/
      popup.html
      popup.ts
      popup.css
    shared/
      api-client.ts
      auth-storage.ts
      config.ts
      types.ts
  webpack.config.js
  tsconfig.json
```

## Manifest permissions pro MVP
Minimum pro scaffold:
- `storage`
- `alarms`

Host permissions:
- jen explicitní API origin podle configu.

Zatím nepřidávat:
- `tabs`
- `activeTab`
- `scripting`
- `desktopCapture`
- `offscreen`
- `<all_urls>`

Tyto permissions přidat až ve chvíli, kdy budeme implementovat konkrétní monitoring modul.

## API otázka
Máme dvě možné cesty:

### Varianta A: Přihlášení přes Express API
- Extension volá `POST /api/auth/login`.
- Dostane Supabase session/access token.
- Použije stejný token pro protected Express monitoring endpointy.
- Výhoda: drží se existující serverové vrstvy.

### Varianta B: Přímé Supabase auth z extension
- Extension používá `@supabase/supabase-js`.
- Potřebuje public Supabase env v extension buildu.
- Výhoda: méně vlastního auth kódu.
- Nevýhoda: větší bundle a více env hodnot v extension.

Doporučení: Varianta A pro MVP. Máme už Express auth route a extension bude stejně potřebovat Express monitoring API.

## Rizika
- Chrome MV3 service worker se uspává; heartbeat/sync musí počítat s krátkým runtime.
- Refresh token flow musí být vyřešený, jinak bude extension často odpadávat.
- Pokud se přidají moc široká permissions hned, bude těžší auditovat, co extension opravdu používá.
- Build-time env pro extension není totéž co Next env; musíme jasně nastavit vlastní extension config.
- Monitoring data mohou rychle růst, takže buffer limit a FIFO pravidla budou nutná v další etapě.

## Acceptance criteria pro první implementační plán
- `pnpm --filter chrome-extension build` reálně vytvoří `dist`.
- `dist/manifest.json` je validní Manifest V3.
- Extension jde načíst v Chrome přes `chrome://extensions` jako unpacked.
- Popup zobrazí login formulář.
- Po přihlášení se uloží session do `chrome.storage.local`.
- Popup umí zobrazit přihlášený stav a odhlásit.
- Safe word toggle je viditelný UI prvek, i kdyby backend endpoint byl v první iteraci jen placeholder/naplánovaný.
- Žádný runtime `localhost` fallback.

## Otázky před plánem
1. Má být extension určena jen pro SUB účet, nebo se do ní může přihlásit i DOM pro testování?
2. Chceš login v extension přes e-mail/heslo, nebo párovací kód vygenerovaný ve webové aplikaci?
3. Má safe word toggle už v první iteraci měnit stav v databázi, nebo stačí UI + lokální stav a backend napojíme v dalším kroku?
4. Má se extension buildovat přes Webpack, jak naznačuje package, nebo chceš raději Vite pro jednodušší DX?

## Doporučení
Jít cestou:
- Webpack ponechat, protože dependencies už jsou připravené.
- Přihlášení přes Express `POST /api/auth/login`.
- Extension jen pro SUB.
- Safe word v první implementaci už napojit na backend, pokud existuje vhodný endpoint; pokud ne, přidat malý endpoint jako součást scaffold plánu.
