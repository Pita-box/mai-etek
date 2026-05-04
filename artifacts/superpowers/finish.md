# Finish: Chrome Extension Phase 4 - MMM Scaffold

## Hotovo
- Přidaná migrace `supabase/migrations/20260503120000_monitoring_extension_scaffold.sql`:
  - `monitoring_pairing_codes`,
  - `monitoring_devices`,
  - `monitoring_events`,
  - RLS pro DOM-scoped čtení/správu.
- Přidané monitoring server actions:
  - načtení Monitoring dat,
  - generování 30min jednorázového párovacího kódu,
  - přejmenování instalace,
  - zneplatnění konkrétní instalace.
- Přidané extension API routy:
  - `POST /api/monitoring/extension/pair`,
  - `POST /api/monitoring/extension/heartbeat`.
- Přidaná DOM stránka `/monitoring`:
  - stav `Aktivní / Neaktivní`,
  - stav sync,
  - pairing panel,
  - seznam instalací,
  - rename,
  - `Zneplatnit extension`,
  - prázdné připravené sekce pro budoucí logy a snímky.
- Přidaný Chrome Extension scaffold `MMM`:
  - Manifest V3,
  - Webpack build,
  - popup pairing/connected UI,
  - `chrome.storage.local` session,
  - background heartbeat přes `chrome.alarms`,
  - placeholder content script bez capture logiky.
- Aktualizovaný `README.md` a `docs/ARCHITECTURE.md`.

## Důležitý rozsah
- Scaffold neimplementuje historii webů, snímky obrazovky, webcam/offscreen recording, monitoring formulářové aktivity, cookies export ani raw input capture.
- Google Drive `Monitoring/DD.MM.YYYY/...` struktura je připravené rozhodnutí pro další monitoring modul, ne součást scaffold implementace.

## Ověření
- `pnpm --filter chrome-extension build` -> prošlo.
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web exec eslint 'src/app/(dashboard)/monitoring/page.tsx' 'src/components/monitoring/MonitoringClient.tsx' 'src/actions/monitoring.ts' 'src/app/api/monitoring/extension/pair/route.ts' 'src/app/api/monitoring/extension/heartbeat/route.ts'` -> prošlo.
- `git diff --check -- <upravené soubory>` -> prošlo.
- `pnpm exec supabase db query --linked --file supabase/migrations/20260503120000_monitoring_extension_scaffold.sql` -> prošlo, migrace aplikovaná.
- `rg -n "localhost|keylogger|cookies export|raw input" <runtime source + docs>` -> v runtime source bez nálezů; docs/finish obsahují jen explicitní poznámky o neimplementovaném rozsahu.

## Manual smoke
- Otevřít `/monitoring` jako DOM.
- Vygenerovat párovací kód pro SUB.
- Načíst `apps/chrome-extension/dist` v Chrome jako unpacked extension.
- Zadat párovací kód v popupu.
- Ověřit, že se instalace zobrazí na `/monitoring`.
- Ověřit heartbeat, rename a zneplatnění konkrétní instalace.
