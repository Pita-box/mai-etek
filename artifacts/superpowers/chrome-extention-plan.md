# Plan: Chrome Extension Phase 4 - MMM Scaffold, Pairing, Heartbeat

## Goal

Postavit první bezpečný základ Chrome extension `MMM` a Monitoring stránky:

- Manifest V3 + Webpack build,
- popup s párováním přes jednorázový DOM kód,
- persistentní extension session v `chrome.storage.local`,
- HTTP heartbeat každých 5 minut,
- DOM Monitoring stránka se stavem instalací,
- možnost DOM zneplatnit konkrétní instalaci,
- prázdné připravené sekce pro budoucí logy a snímky.

## Scope

Tento plán implementuje pouze scaffold + pairing + heartbeat + základ Monitoring stránky.

Tento plán neimplementuje:

- historii webů,
- snímky obrazovky,
- webcam/offscreen recording,
- monitoring formulářové aktivity,
- cookies export webů (plain text soubory),
- raw input/key capture,
- Google Drive upload monitoring médií.

Google Drive struktura `Monitoring/DD.MM.YYYY/...` zůstává rozhodnutí pro další monitoring modul, ne pro scaffold.

## Assumptions

- Extension je jen pro SUB.
- DOM generuje párovací kód na `/monitoring`.
- DOM při generování kódu vybere konkrétní SUB účet.
- Párovací kód platí 30 minut a je jednorázový.
- SUB v extension zadává pouze kód.
- Jeden SUB může mít více instalací.
- Výchozí název instalace je `Zařízení 1`; název upravuje DOM na Monitoring stránce.
- DOM zneplatňuje konkrétní instalaci.
- Heartbeat interval je 5 minut.
- Stav `Aktivní` používá 10minutové okno od posledního heartbeat.
- Po zneplatnění se extension vrátí na pairing screen.
- Žádný runtime fallback na localhost; dev/live URL musí být explicitně v env/build configu.

## Data Model

Přidat migraci například:
`supabase/migrations/20260503_monitoring_extension_scaffold.sql`

Tabulky:

1. `public.monitoring_pairing_codes`
   - `id uuid primary key`
   - `dom_id uuid not null references profiles(id)`
   - `sub_id uuid not null references profiles(id)`
   - `code_hash text not null`
   - `expires_at timestamptz not null`
   - `used_at timestamptz`
   - `used_device_id uuid`
   - `created_at timestamptz`
   - `revoked_at timestamptz`

2. `public.monitoring_devices`
   - `id uuid primary key`
   - `dom_id uuid not null references profiles(id)`
   - `sub_id uuid not null references profiles(id)`
   - `name text not null default 'Zařízení 1'`
   - `token_hash text not null unique`
   - `paired_at timestamptz not null`
   - `last_heartbeat_at timestamptz`
   - `last_seen_at timestamptz`
   - `extension_version text`
   - `sync_status text not null default 'connected'`
   - `pending_items integer not null default 0`
   - `last_error text`
   - `revoked_at timestamptz`
   - `created_at timestamptz`
   - `updated_at timestamptz`

3. `public.monitoring_events`
   - scaffold metadata placeholder for future modules:
   - `id uuid primary key`
   - `device_id uuid references monitoring_devices(id)`
   - `dom_id uuid not null references profiles(id)`
   - `sub_id uuid not null references profiles(id)`
   - `event_type text not null`
   - `occurred_at timestamptz not null`
   - `metadata jsonb not null default '{}'`
   - `created_at timestamptz`

RLS:

- DOM can read/manage devices/pairing codes for SUB profiles where `profiles.dom_id = auth.uid()`.
- SUB should not read Monitoring records from web UI.
- Extension unauthenticated pairing/heartbeat routes will use server/admin context and validate code/token hashes manually.

## API / Server Actions

### Web server actions for DOM Monitoring page

Add `apps/web/src/actions/monitoring.ts`:

- `getMonitoringData()`
  - DOM-only.
  - Loads paired SUB accounts, active pairing codes, devices, and latest scaffold event metadata.
- `createMonitoringPairingCode(subId)`
  - DOM-only.
  - Generates a random human-friendly code.
  - Stores only a SHA-256 hash.
  - Expires in 30 minutes.
  - Returns the plain code once for display.
- `renameMonitoringDevice(deviceId, name)`
  - DOM-only.
  - Updates a specific device name.
- `revokeMonitoringDevice(deviceId)`
  - DOM-only.
  - Sets `revoked_at`.

### Public extension API routes

Add Next API routes under `apps/web/src/app/api/monitoring/extension/`:

1. `POST /api/monitoring/extension/pair`
   - Input: `{ code, extensionVersion? }`
   - Hashes code and finds unexpired, unused pairing code.
   - Creates `monitoring_devices` with default name `Zařízení N`.
   - Marks pairing code `used_at`.
   - Returns:
     - opaque device token,
     - device id,
     - device name,
     - heartbeat interval seconds.
   - Does not expose user data beyond what extension needs.

2. `POST /api/monitoring/extension/heartbeat`
   - Auth: `Authorization: Bearer <device_token>`.
   - Hashes token, finds non-revoked device.
   - Updates `last_heartbeat_at`, `last_seen_at`, `extension_version`, `sync_status`, `pending_items`.
   - Returns:
     - `active: true`,
     - `revoked: false`,
     - current device name,
     - heartbeat interval seconds.
   - If token is revoked/unknown, returns `401` or `{ revoked: true }`; extension clears local session.

Timeout/error handling:

- Routes should return Czech, non-secret errors.
- No token/code values in logs.

## Web UI

Add `/monitoring` page:
`apps/web/src/app/(dashboard)/monitoring/page.tsx`

DOM-only behavior:

- Existing page-access config already hides Monitoring for SUB by default.
- Page itself must also check DOM role and show access error for non-DOM.

UI sections:

1. Header/status summary
   - `Aktivní` if at least one device heartbeat is within 10 minutes.
   - `Neaktivní` otherwise.
   - `Naposledy u počítače` from latest `last_seen_at`.
   - Sync summary: `Připojeno` / `Data čekají na odesílání`.

2. Pairing panel
   - Select SUB account.
   - Button `Vygenerovat párovací kód`.
   - Shows code and expiration time.
   - Explains that code is one-time and valid 30 minutes.

3. Devices table/list
   - Device name.
   - Status `Aktivní / Neaktivní`.
   - Last heartbeat.
   - Last seen.
   - Extension version.
   - Pending items.
   - Inline rename action.
   - `Zneplatnit extension` action for the concrete installation.

4. Prepared empty sections
   - `Navštívené weby` placeholder.
   - `Formulářová aktivita` placeholder.
   - `Snímky` placeholder.
   - These are visual placeholders only; no capture implementation in this step.

Design:

- Follow `design-system/MASTER.md`.
- Operational dashboard style, dense and scannable.
- No landing/marketing layout.

## Chrome Extension

Create real source in `apps/chrome-extension`:

```text
apps/chrome-extension
  public/
    manifest.json or manifest template
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

Build:

- Update `apps/chrome-extension/package.json`:
  - `build`: `webpack --mode production`
  - keep `dev`: watch mode.
- Add Webpack config for:
  - background service worker bundle,
  - popup bundle,
  - placeholder content script bundle,
  - copy/generate Manifest V3.

Config:

- Use explicit build env, e.g.:
  - `EXTENSION_API_BASE_URL=https://...`
  - `EXTENSION_API_ORIGIN=https://...`
- Build should fail clearly when required values are missing.
- No hardcoded localhost fallback.

Manifest MVP permissions:

- `storage`
- `alarms`

Host permissions:

- explicit API origin from build config.

No MVP permissions yet:

- `tabs`
- `activeTab`
- `scripting`
- `offscreen`
- `desktopCapture`
- `<all_urls>`

Popup:

- Pairing screen:
  - code input,
  - submit button,
  - error/success state.
- Connected screen:
  - device name,
  - `Aktivní / Neaktivní`,
  - last heartbeat,
  - sync status,
  - revoked/session error state.
- No logout button unless needed for development; production access is controlled by DOM revoke.

Background:

- On install/start, load session from `chrome.storage.local`.
- Schedule heartbeat via `chrome.alarms` every 5 minutes.
- Send heartbeat immediately after successful pairing.
- If heartbeat response says revoked/unauthorized, clear session and notify popup state.

Content script:

- Placeholder only.
- No data capture in scaffold.

## Documentation

Update:

- `docs/ARCHITECTURE.md`
  - Phase 4 Extension Scaffold current implementation state.
  - Monitoring scaffold data model/API decisions.
- `artifacts/superpowers/finish.md`
  - Implementation result and verification.

Optional README note:

- How to set `EXTENSION_API_BASE_URL` and load unpacked `apps/chrome-extension/dist`.

## Verification

Commands:

1. `pnpm --filter chrome-extension build`
2. `pnpm --filter web exec tsc --noEmit`
3. `pnpm --filter web exec eslint 'src/app/(dashboard)/monitoring/page.tsx' 'src/actions/monitoring.ts'`
4. `git diff --check -- <changed files>`

Migration verification:

- Apply migration through the project’s Supabase workflow:
  - `pnpm exec supabase db query --linked --file supabase/migrations/20260503_monitoring_extension_scaffold.sql`
- If not applied automatically, document that the user must apply it before using Monitoring.

Manual smoke:

1. Open `/monitoring` as DOM.
2. Generate pairing code for SUB.
3. Build extension.
4. Load `apps/chrome-extension/dist` in Chrome as unpacked.
5. Enter pairing code.
6. Confirm device appears on `/monitoring`.
7. Confirm heartbeat updates status.
8. Rename device on Monitoring page.
9. Revoke concrete device.
10. Confirm extension returns to pairing screen after next heartbeat/manual refresh.

## Risks & Mitigations

- MV3 service worker may sleep.
  - Use `chrome.alarms` and HTTP heartbeat instead of depending on an always-open socket.
- Pairing code leakage.
  - Store only hash, expire in 30 minutes, one-time use.
- Device token leakage.
  - Store only token hash in DB, never log token.
- DOM accidentally revokes all devices.
  - Revoke action targets one concrete device id.
- UI claims real-time while heartbeat is periodic.
  - Label as last heartbeat/last seen and use clear active window.
- Future monitoring modules may need wider permissions.
  - Keep scaffold permissions minimal and add permissions only with the module that needs them.

## Success Criteria

- `pnpm --filter chrome-extension build` creates loadable `dist`.
- `/monitoring` exists and is DOM-only.
- DOM can generate a 30-minute one-time pairing code.
- Extension can pair with code and persist device session.
- Extension sends heartbeat every 5 minutes.
- Monitoring page shows `Aktivní` for devices seen within 10 minutes.
- DOM can rename and revoke a specific installation.
- Revoked extension returns to pairing screen.
- No runtime localhost fallback is introduced.
