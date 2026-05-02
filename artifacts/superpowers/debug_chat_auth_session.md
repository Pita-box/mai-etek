# Debug: Chat Page autentizované ověření

> Datum: 2026-04-30
> Kontext: poznámka v `artifacts/superpowers/execution.md`, že `curl /chat` běží bez přihlášené session.

## Cíl

Zjistit, jestli je poslední blokace Chat Page opravdu jen absence browser session při `curl`, nebo jestli se po přihlášení objeví další problém.

## Assumptions

1. `curl http://localhost:3000/chat` bez cookies neověřuje skutečný přihlášený stav.
2. Pro plné UI E2E je potřeba browser session vytvořená přes Supabase auth.
3. REST API chat endpoint lze ověřit i bez browseru, pokud se nejdřív získá Supabase access token přes SDK.

## Zjištění

### Prošlo

- `http://localhost:4000/health` vrací HTTP 200.
- `http://localhost:3000/chat` vrací HTTP 200.
- Přihlášení přes Supabase SDK s testovacím DOM účtem proběhlo úspěšně.

### Selhalo

Autentizované volání:

```bash
GET http://localhost:4000/api/chat/messages?limit=1
Authorization: Bearer <supabase-access-token>
```

vrátilo:

```json
{
  "chatStatus": 500,
  "error": "Could not find the table 'public.messages' in the schema cache"
}
```

## Root Cause

Poznámka v execution logu je pravdivá, ale neúplná.

`curl /chat` bez session opravdu neumí ověřit Chat Page E2E. Jenže po autentizaci chat REST endpoint padá na chybějící tabulce `public.messages`.

Tabulka `messages` existuje ve staré migraci:

- `database/migrations/001_initial_schema.sql`

Aktuální Supabase migrace pod:

- `supabase/migrations/`

ale žádnou migraci pro `public.messages` neobsahují.

Serverový chat route přitom používá:

- `apps/server/src/routes/chat.ts` → `.from('messages')`

## Rizika

- Pokud se jen otevře `/chat` v přihlášeném browseru, UI pravděpodobně zobrazí chybu načtení konverzace místo skutečných zpráv.
- Media upload v chatu navíc očekává storage bucket `domsub-media`; ten je potřeba ověřit samostatně po opravě tabulky.
- Staré `database/migrations` používají vlastní tabulku `users`, zatímco aktuální app používá Supabase `auth.users` + `profiles`. Nelze je zkopírovat celé.

## Doporučený plán opravy

1. Přidat novou Supabase migraci pouze pro chat schema.
   - Vytvořit `public.messages`.
   - `sender_id` referencovat `auth.users(id)`, ne starou tabulku `users`.
   - Typ řešit buď `TEXT CHECK`, nebo bezpečně vytvořeným enumem, podle stylu aktuálních migrací.

2. Přidat indexy.
   - `messages_created_idx` na `created_at DESC`.
   - `messages_sender_idx` na `sender_id`.

3. Přidat RLS policies.
   - Účastník konverzace smí číst zprávy vlastní DOM/SUB dvojice.
   - Auth user smí vložit vlastní zprávu.
   - DOM smí mazat zprávy v rámci své dvojice.
   - Účastník smí označit cizí zprávu jako přečtenou.

4. Přidat/ověřit storage bucket pro chat media.
   - `domsub-media` musí existovat.
   - Pokud zůstane public URL upload, bucket musí být public, nebo se musí změnit API na signed URL.

5. Ověřit bez browseru.
   - Supabase SDK login.
   - `GET /api/chat/messages?limit=1` musí vrátit 200 a `messages: []`.
   - `POST /api/chat/messages` musí vytvořit textovou zprávu.

6. Ověřit v browseru.
   - Přihlásit se jako DOM.
   - Otevřít `/chat`.
   - Odeslat zprávu.
   - Ideálně druhá session jako SUB pro realtime doručení.

## Acceptance Criteria

- Autentizované `GET /api/chat/messages?limit=1` vrací HTTP 200.
- Autentizované `POST /api/chat/messages` vrací HTTP 201 a uloženou zprávu.
- `/chat` v přihlášeném browseru nezobrazuje `Not authenticated` ani DB schema chybu.
- `pnpm --filter server exec tsc --noEmit` projde.
- `pnpm --filter web exec tsc --noEmit` projde.

## Review

- **Blocker:** `public.messages` chybí v aktuálně aplikované Supabase schema cache.
- **Major:** Execution log zatím prezentuje smoke ověření jako dokončené, ale autentizovaný chat API smoke test selhává.
- **Minor:** Plnohodnotné browser E2E stále vyžaduje přihlášenou browser session.
- **Nit:** Login page má stále anglické validační texty, ale to není příčina tohoto debug problému.
