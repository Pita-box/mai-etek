# Execution Log: Chat Page – Hybrid Real-time

> Plán: `artifacts/superpowers/plan.md`
> Zahájeno: 2026-04-29T17:46:00+02:00

---

## Step 1: Socket.IO server setup ✅

- **Files changed:**
  - `apps/server/src/index.ts` – refaktor `app.listen()` → `http.createServer(app)` + `initSocketIO(httpServer)`
  - `apps/server/src/socket/index.ts` – nový: Socket.IO server, `/chat` namespace, user tracking, typing events
  - `apps/server/src/socket/auth.ts` – nový: JWT auth middleware pro Socket.IO handshake

- **What changed:**
  - Express server nyní běží přes `http.createServer()` místo `app.listen()`
  - Socket.IO server inicializován s CORS, auth middleware a `/chat` namespace
  - User online/offline tracking s multi-tab support (Map<userId, Set<socketId>>)
  - Exportované utility: `getIO()`, `getUserSocketIds()`, `isUserOnline()` pro broadcast z REST routes

- **Verify:** `pnpm --filter server exec tsc --noEmit` → ✅ PASS
- **Verify:** `curl http://localhost:4000/health` → ✅ `{"status":"ok"}`

## Step 2-9, 11, 16: Real-time UI a integrace ✅

- **Files changed:**
  - `packages/types/src/chat.ts` - socket.io events
  - `apps/server/src/routes/chat.ts` - pagination, mark read, delete
  - `apps/web/src/lib/socket.ts`, `apps/web/src/hooks/useSocket.ts` - klient infra
  - `apps/web/src/stores/chatStore.ts` - zustand
  - `apps/web/src/components/chat/ChatPageClient.tsx` - refaktor na zustand + sockets
  - `apps/web/src/components/chat/ChatComposer.tsx` - typing indicator logic
  - `apps/web/src/components/chat/TypingIndicator.tsx` - nová komponenta
  - `apps/web/src/components/chat/ChatMessageList.tsx` - paginace, auto-scroll
  - `apps/web/src/components/chat/ChatMessageBubble.tsx` - read receipts
  - `apps/web/src/components/chat/DateSeparator.tsx` - nová komponenta

- **What changed:**
  - Kompletní propojení real-time a UI.
  - Vytvořen store pro zachování stavu konverzace.
  - Vykreslování online stavu, read receipts (zpracování doručeno/přečteno), typing, scroll a history loading.

- **Verify:**
  `pnpm --filter web exec tsc --noEmit && pnpm --filter server exec tsc --noEmit` → ✅ ALL PASS

## Step 10: Mazání zpráv (DOM only) ✅

- **Files changed:**
  - `apps/web/src/actions/chat.ts` (viewerRole a onDeleteMessage předání)
  - `apps/web/src/app/(dashboard)/chat/page.tsx`
  - `apps/web/src/components/chat/ChatPageClient.tsx`
  - `apps/web/src/components/chat/ChatPanel.tsx`
  - `apps/web/src/components/chat/ChatMessageList.tsx`
  - `apps/web/src/components/chat/ChatMessageBubble.tsx`

- **What changed:**
  - Implementováno mazání zpráv pro DOM role.
  - `viewerRole` se předává stromem komponent.
  - V `ChatMessageBubble` se zobrazuje tlačítko pro smazání (ikona Trash2), když `viewerRole === 'dom'`.

- **Verify:**
  `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Step 12 & 13: Image & Video upload ✅

- **Files changed:**
  - `apps/server/src/routes/chat.ts` (multer upload to Supabase Storage)
  - `apps/web/src/components/chat/MediaPreview.tsx` (nová komponenta pro náhled)
  - `apps/web/src/components/chat/ChatComposer.tsx` (hidden input file, MediaPreview, nahrávání na /api/chat/upload před odesláním do Socketu/REST)
  - `apps/web/src/components/chat/ChatMessageBubble.tsx` (inline `<img>` a `<video>` vykreslení)

- **What changed:**
  - Plná podpora pro obrázky a videa v chatu. Uživatel může kliknout na "Příloha" (nebo drag&drop v budoucnu), zobrazí se MediaPreview a před odesláním textu se asynchronně nahraje soubor přes API.
  - Backend využívá dočasně Supabase Storage a odesílá `publicUrl`.
  - Přílohy jsou v bublině renderované inline pomocí standardních HTML5 tagů.

- **Verify:**
  `pnpm --filter web exec tsc --noEmit && pnpm --filter server exec tsc --noEmit` → ✅ PASS

## Step 14: Voice messages ✅

- **Files changed:**
  - `apps/web/src/components/chat/VoiceRecorder.tsx` (nová komponenta pro nahrávání)
  - `apps/web/src/components/chat/VoicePlayer.tsx` (nová komponenta pro přehrávání)
  - `apps/web/src/components/chat/ChatComposer.tsx` (integrace nahrávání)
  - `apps/web/src/components/chat/ChatMessageBubble.tsx` (integrace přehrávače)

- **What changed:**
  - Plná podpora pro hlasové zprávy. Uživatel klikne na ikonu mikrofonu v `ChatComposer`, spustí se `VoiceRecorder` s `MediaRecorder` API (podpora pro `audio/webm;codecs=opus` i fallbacky).
  - Po nahrání se blob nahraje na `/api/chat/upload` a odešle jako zpráva typu `voice`.
  - Příjemce/Odesílatel vidí v bublině `VoicePlayer` s custom UI (Play/Pause, progres, custom styly podle isOwn).
  - Opraveny typy pro audio -> voice podle `@maietek/types`.

- **Verify:**
  `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Step 15: Online/offline status + chat header ✅

- **Files changed:**
  - `apps/web/src/components/chat/ChatHeader.tsx` (nová komponenta pro hlavičku)
  - `apps/web/src/components/chat/ChatPanel.tsx` (refaktor na použití `ChatHeader`)

- **What changed:**
  - Vytvořena separátní komponenta `ChatHeader` pro lepší organizaci kódu.
  - V hlavičce se nyní dynamicky zobrazuje jméno a iniciály protistrany (odvozeno z posledních zpráv).
  - Online/Offline status a indikátor připojení k Socket.IO jsou vizuálně vylepšeny.
  - `Typing...` indikátor byl přesunut do hlavičky vedle jména protistrany (místo vykreslování v chatu pod zprávami).

- **Verify:**
  `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Step 17: Telegram notifikace (skeleton) ✅

- **Files changed:**
  - `apps/server/src/services/notifications.ts` (nový: mock notifikační služba)
  - `apps/server/src/routes/chat.ts` (integrace v POST `/messages`)

- **What changed:**
  - Přidán skeleton pro Telegram notifikace.
  - Při uložení nové zprávy se kontroluje `isUserOnline(recipientId)`. Pokud je uživatel offline, odešle se asynchronně fire-and-forget požadavek na `sendTelegramNotification`.
  - Notification service zkouší načíst `telegram_chat_id` z `profiles`, ošetří chybějící data a připraví zprávu pro budoucí napojení na Telegram Bot API.

- **Verify:**
  `pnpm --filter server exec tsc --noEmit` → ✅ PASS

## Step 18: Finální integrace + smoke ověření ✅

- **What changed:**
  - Žádné produkční soubory nebyly měněny v tomto kroku.
  - Finální ověření bylo provedeno přes lokální `tsc`, spuštěné dev servery a HTTP smoke testy.

- **Verify:**
  - `apps/web`: `./node_modules/.bin/tsc --noEmit` → ✅ PASS
  - `apps/server`: `./node_modules/.bin/tsc --noEmit` → ✅ PASS
  - `http://localhost:4000/health` → ✅ `{"status":"ok"}`
  - `http://localhost:3000/chat` → ✅ HTTP `200`

- **Notes:**
  - Neinteraktivní `curl /chat` běží bez přihlášené session, takže server-side props obsahují `initialError: "Not authenticated"`. Plné E2E odeslání zprávy vyžaduje přihlášený browser session.

## Step 19: Chat DB schema + autentizovaný smoke test ✅

- **Files changed:**
  - `supabase/migrations/20260430003000_chat_messages_schema.sql` – nová migrace pro `public.messages`, RLS, indexy a bucket `domsub-media`
  - `supabase/migrations/20260428174100_task_view_summary_dom_read_policy.sql` – idempotentní `DROP POLICY IF EXISTS` před znovuvytvořením policy
  - `apps/server/src/routes/chat.ts` – scope pro delete/read receipt přes účastníky konverzace, reálné volání Telegram skeletonu pro offline příjemce
  - `artifacts/superpowers/debug_chat_auth_session.md` – debug artefakt s root cause a plánem opravy

- **What changed:**
  - Přidána chybějící tabulka `public.messages`, kterou chat API používalo, ale aktuální Supabase migrace ji nevytvářely.
  - `sender_id` je navázaný na `auth.users(id)`, ne na starou legacy tabulku `users`.
  - Přidány indexy pro čas a odesílatele.
  - Přidány RLS policy pro čtení, vytvoření vlastních zpráv, označení cizích zpráv jako přečtených a mazání zpráv DOM uživatelem v jeho vlastní dvojici.
  - Přidán/updatován veřejný storage bucket `domsub-media` s limitem 50 MB pro dočasná chat media.
  - Backend delete a read receipt operace jsou scopeované na participant IDs i při použití service-role klienta.

- **Remote migration:**
  - `pnpm exec supabase db push --yes` aplikoval na remote migrace:
    - `20260426181530_tasks_realtime_publication.sql`
    - `20260427191500_fix_task_media_media_type_constraint.sql`
    - `20260427225000_task_media_delete_policies.sql`
    - `20260428174100_task_view_summary_dom_read_policy.sql`
    - `20260430003000_chat_messages_schema.sql`
  - První push se zastavil na existující policy `Assigning DOM can read task view summary`; migrace byla upravena na idempotentní a druhý push prošel.

- **Verify:**
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm exec supabase db push --dry-run --yes` → ✅ `Remote database is up to date.`
  - Auth smoke přes Supabase SDK + chat REST:
    - login DOM účtem → ✅ PASS
    - `GET /api/chat/messages?limit=1` → ✅ HTTP 200, `messages` pole existuje
    - `POST /api/chat/messages` textovou zprávou → ✅ HTTP 201
    - `DELETE /api/chat/messages/:id` pro test zprávu → ✅ HTTP 200, `deleted: true`
  - Storage bucket check:
    - `domsub-media` existuje → ✅
    - `public: true` → ✅
    - `fileSizeLimit: 52428800` → ✅

- **Review:**
  - **Blocker:** vyřešeno – `public.messages` už existuje a chat REST endpoint nepadá na schema cache.
  - **Major:** vyřešeno – remote migration history je podle `db push --dry-run` srovnaná.
  - **Minor:** plné browser E2E se dvěma přihlášenými sessions ještě nebylo provedeno.
  - **Nit:** `pnpm exec supabase migration list --linked` po ověření narazil na dočasné auth throttling chyby pooleru; nebylo potřeba pro dokončení, protože `db push --dry-run` potvrdil up-to-date stav.

## Step 20: Oprava `No authorization header` v Chat Page ✅

- **Files changed:**
  - `apps/web/src/actions/chat.ts` – server action už nepoužívá browserový `fetchApi`; posílá Express chat API requesty s access tokenem ze server-side Supabase session
  - `artifacts/superpowers/execution.md` – záznam debug opravy

- **Root cause:**
  - `getChatMessages`, `sendChatMessage`, `deleteChatMessage` a `markMessageAsRead` běží jako server actions.
  - Tyto server actions používaly `fetchApi` z `apps/web/src/lib/api-client.ts`.
  - `fetchApi` používá browser Supabase client, takže při server-side renderu `/chat` nenašel session token a Express API dostalo request bez `Authorization` headeru.
  - Výsledek v UI: `Nepodařilo se načíst konverzaci / No authorization header`.

- **What changed:**
  - Přidán lokální `fetchChatApi` helper přímo v `apps/web/src/actions/chat.ts`.
  - Helper bere `session.access_token` ze server-side Supabase session a explicitně nastavuje `Authorization: Bearer <token>`.
  - Klientský `fetchApi` zůstává beze změny pro klientské komponenty jako settings a superadmin hooks.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishments Step 12: Architecture checklist ✅

- **Files changed:**
  - `docs/ARCHITECTURE.md`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Phase 2 Punishments checklist označen jako hotový podle implementovaného scope.
  - Doplněna poznámka, že aktuální implementace používá Supabase `auth.users`/`profiles` a Next.js server actions místo staršího Express REST sketch.

- **Verify:**
  - `rg -n "Punishments|Punishment template library|Ad-hoc punishment creation|Punishment completion tracking" docs/ARCHITECTURE.md` → ✅ PASS

## Punishments Step 13: Finální kontroly ✅

- **Files changed:**
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Provedeny finální typové, DB dry-run a whitespace kontroly pro dotčené soubory.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm exec supabase db push --dry-run --yes` → ✅ PASS, pushnul by pouze `20260430143100_punishments.sql`
  - `git diff --check -- <dotčené soubory>` → ✅ PASS

## Punishments Runtime Fix: aplikovaná DB migrace ✅

- **Issue:**
  - `/punishments` hlásilo `Could not find the table 'public.punishments' in the schema cache`.

- **Root cause:**
  - Kód byl nasazený/lokálně spuštěný proti remote Supabase DB, ale migrace `20260430143100_punishments.sql` byla zatím jen dry-run ověřená a nebyla aplikovaná.

- **What changed:**
  - Aplikována remote migrace přes Supabase CLI.
  - Vynucen PostgREST schema cache reload přes `NOTIFY pgrst, 'reload schema';`.

- **Verify:**
  - `pnpm exec supabase db push --dry-run --yes` před pushem → ✅ pending `20260430143100_punishments.sql`
  - `pnpm exec supabase db push --yes` → ✅ PASS
  - `pnpm exec supabase db push --dry-run --yes` po pushi → ✅ `Remote database is up to date.`
  - `pnpm exec supabase db query --linked "NOTIFY pgrst, 'reload schema';"` → ✅ PASS
  - `pnpm exec supabase db query --linked "select to_regclass('public.punishments') as punishments_table;"` → ✅ `punishments`
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishments Scope Correction: DOM-only knihovna ✅

- **Issue:**
  - Produktové upřesnění: tresty nemají být SUB-facing workflow. Mají být pouze DOM-only knihovna trestů, aby DOM nemusel tresty pokaždé vymýšlet.

- **Files changed:**
  - `supabase/migrations/20260430150500_punishments_dom_library_only.sql`
  - `apps/web/src/components/shared/Navigation.tsx`
  - `apps/web/src/actions/punishments.ts`
  - `apps/web/src/app/(dashboard)/punishments/page.tsx`
  - `apps/web/src/components/punishments/PunishmentsClient.tsx`
  - `apps/web/src/components/punishments/PunishmentLibrary.tsx`
  - `docs/ARCHITECTURE.md`
  - `artifacts/superpowers/execution.md`
  - `artifacts/superpowers/finish.md`

- **What changed:**
  - Punishments jsou skryté ze SUB navigace a `/punishments` pro SUB vrací DOM-only hlášku.
  - UI je zúžené na `Knihovna trestů`: create/edit/delete templates, filtrování podle textu a Náročnosti.
  - Odstraněny viditelné assignment/completion/task-linked prvky z UI a server actions.
  - Přidána a aplikována RLS migrace, která dropuje SUB/assignment policies.
  - `docs/ARCHITECTURE.md` upraveno na DOM-only library scope.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm exec supabase db push --yes` → ✅ aplikována `20260430150500_punishments_dom_library_only.sql`
  - `pnpm exec supabase db push --dry-run --yes` → ✅ `Remote database is up to date.`
  - `git diff --check -- <dotčené soubory>` → ✅ PASS
  - `rg -n "Knihovna trestů|Filtrovat podle názvu|SUB access disabled|Přiřadit trest|Navázané tresty|assignPunishment|submitPunishmentCompletion|completePunishment|cancelPunishment" apps/web/src docs/ARCHITECTURE.md` → ✅ jen očekávané DOM-only/library výsledky
  - `pnpm exec supabase db query --linked "NOTIFY pgrst, 'reload schema';"` → ⚠️ neproběhlo kvůli dočasnému Supabase pooler auth circuit breakeru; není blokující pro aplikovanou RLS změnu.
  - Pozdější opakovaný `pnpm exec supabase db push --dry-run --yes` také narazil na stejný dočasný pooler circuit breaker; první dry-run po migraci už předtím potvrdil `Remote database is up to date.`
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - Auth smoke přes Supabase SDK + Express chat REST:
    - login DOM účtem → ✅ PASS
    - `GET /api/chat/messages?limit=1` s Bearer tokenem → ✅ HTTP 200, `messages` pole existuje

- **Review:**
  - **Blocker:** vyřešeno – chat server action už neposílá API request bez Authorization headeru.
  - **Major:** žádné nové.
  - **Minor:** přihlášený browser `/chat` je potřeba refreshnout, aby Next dev server načetl novou server action.
  - **Nit:** helper nastavuje stejný JSON default jako původní `fetchApi`; pro chat JSON requesty je to v pořádku.

## Step 21: Chat UI sjednocení s design systémem ✅

- **Files changed:**
  - `apps/web/src/components/chat/ChatHeader.tsx`
  - `apps/web/src/components/chat/ChatPanel.tsx`
  - `apps/web/src/components/chat/ChatComposer.tsx`
  - `apps/web/src/components/chat/ChatMessageBubble.tsx`
  - `apps/web/src/components/chat/ChatMessageList.tsx`
  - `apps/web/src/components/chat/ChatState.tsx`
  - `apps/web/src/components/chat/TypingIndicator.tsx`
  - `apps/web/src/components/chat/VoicePlayer.tsx`
  - `apps/web/src/components/chat/VoiceRecorder.tsx`
  - `apps/web/src/components/chat/MediaPreview.tsx`

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **What changed:**
  - Zelené/emerald chat téma bylo odstraněno jako hlavní vizuální směr.
  - `ChatPanel` používá černý glass background s crimson/rose aurou podle `MASTER.md`.
  - `ChatHeader` používá primary/crimson labely, avatar fallback a české statusy `Připojeno` / `Obnovuji`.
  - Send button v `ChatComposer` používá `bg-primary text-primary-foreground` a crimson glow.
  - Attachment/voice ovládání používají neutrální glass styl s crimson hover/focus.
  - Vlastní zprávy v `ChatMessageBubble` používají crimson-tinted glass; protistrana neutrální glass.
  - `VoicePlayer`, loader, typing indicator a empty/error state byly přebarveny na primary/crimson.
  - Zelená zůstává jen jako malá online tečka v `ChatHeader`, což je povolený semantický stavový indikátor podle `design-system/pages/chat.md`.
  - Viditelné anglické texty v chat komponentách byly upraveny: `Live/Reconnecting` → `Připojeno/Obnovuji`, `Start/Stop` → `Spustit/Zastavit`, `Preview` alt → `Náhled přílohy`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "bg-emerald|text-emerald|border-emerald|hover:bg-emerald|rgba\\(34,197,94|rgba\\(16,185,129" apps/web/src/components/chat` → ✅ pouze online tečka zůstává jako povolený stavový indikátor

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** vizuální browser screenshot nebyl po změně pořízen; ověřeno staticky přes grep a TypeScript.
  - **Nit:** názvy socket event handlerů obsahují `Online/Offline`, ale nejsou viditelný UI text.

## Step 22: Finální ověření Chat UI ✅

- **What changed:**
  - Kód chat UI zůstává v souladu s `design-system/MASTER.md` a `design-system/pages/chat.md`.
  - Hlavní chat akcenty jsou `primary`/crimson; zelená zůstává pouze u malé online tečky v hlavičce.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "bg-emerald|text-emerald|border-emerald|hover:bg-emerald|bg-green|text-green|border-green|hover:bg-green|bg-teal|text-teal|border-teal|rgba\\(34,197,94|rgba\\(16,185,129|rgba\\(52,211,153" apps/web/src/components/chat` → ✅ pouze online tečka v `ChatHeader.tsx`
  - Dev servery běží na `localhost:3000` a `localhost:4000`.

## Step 23: Read receipt ikona jen po skutečném zobrazení ✅

- **Files changed:**
  - `apps/web/src/components/chat/ChatMessageBubble.tsx`

- **What changed:**
  - Nepřečtené vlastní zprávy už nezobrazují single `Check` ikonu hned po odeslání.
  - Read receipt se vykreslí jen při `message.isRead === true`, jako `CheckCheck` s českým popisem `Zobrazeno`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "Check|CheckCheck|isRead|Zobrazeno" apps/web/src/components/chat/ChatMessageBubble.tsx apps/web/src/stores/chatStore.ts apps/web/src/components/chat/ChatPageClient.tsx` → ✅ v bublině je jen `CheckCheck` navázaný na `message.isRead`

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** samotné backend označení přečtení zatím není v UI aktivně volané; tato oprava řeší zavádějící okamžitou ikonu po odeslání.

## Step 24: Presence sync + aktivní read receipts ✅

- **Files changed:**
  - `packages/types/src/chat.ts`
  - `apps/server/src/socket/index.ts`
  - `apps/web/src/components/chat/ChatPageClient.tsx`

- **Root cause:**
  - Zprávy chodily real-time, protože `message:new` broadcast byl napojený.
  - Online stav ale neměl počáteční snapshot: nově připojený klient dostal jen budoucí `user:online` eventy, takže už online protistranu viděl až po jejím refreshi/reconnectu.
  - `markMessageAsRead` existoval na backendu i ve server action, ale UI ho nikde nevolalo, takže se `message:read` event nikdy nespustil.

- **What changed:**
  - Přidán Socket.IO event `presence:sync`, který novému klientovi po připojení pošle aktuálně online user IDs.
  - `ChatPageClient` drží online user IDs lokálně a z nich počítá `isPartnerOnline`, takže funguje initial stav i `user:online/user:offline` bez refresh stránky.
  - `ChatPageClient` označí cizí nepřečtené zprávy jako přečtené, když je chat stránka viditelná; při návratu do tabu se pokus zopakuje.
  - Sender dostane existující `message:read` broadcast a jeho vlastní bublina následně zobrazí `Zobrazeno`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `lsof -nP -iTCP -sTCP:LISTEN | rg "(:3000|:4000|next|node)"` → ✅ dev web běží na `3000`, server na `4000`

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** plné dvou-browserové E2E není automatizované; ruční ověření je otevřít `/chat` ve dvou přihlášených sessions a sledovat online stav + `Zobrazeno`.

## Step 25: Online stav po přihlášení, ne až po otevření chatu ✅

- **Files changed:**
  - `apps/web/src/components/chat/ChatPresenceProvider.tsx`
  - `apps/web/src/app/(dashboard)/layout.tsx`
  - `apps/web/src/lib/socket.ts`
  - `apps/web/src/hooks/useSocket.ts`
  - `apps/web/src/components/chat/ChatPageClient.tsx`
  - `apps/server/src/socket/index.ts`
  - `packages/types/src/chat.ts`

- **Root cause:**
  - Online stav byl navázaný na `/chat` stránku, protože socket se otevíral až v `ChatPageClient`.
  - Přihlášený user mimo chat nebyl pro server online.
  - ChatPage mohla minout úvodní `presence:sync`, pokud socket už mezitím otevřel jiný klientský lifecycle.
  - Sdílený socket nebyl ref-counted, takže více komponent mohlo singleton při unmountu nechtěně odpojit.

- **What changed:**
  - Přidán `ChatPresenceProvider` do dashboard layoutu; DOM/SUB je online po přihlášení do dashboardu, i když není na `/chat`.
  - Socket singleton má `retainChatSocket` / `releaseChatSocket`, takže ho může držet layout i ChatPage současně.
  - `getChatSocket` znovu používá i právě připojovaný socket pro stejný token, aby se presence nepřerušovala při rychlém mountu více komponent.
  - Přidán client event `presence:get`; `ChatPageClient` si po registraci listenerů vyžádá aktuální snapshot.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check` pro dotčené soubory → ✅ PASS
  - `lsof -nP -iTCP -sTCP:LISTEN | rg "(:3000|:4000|next|node)"` → ✅ web `3000`, server `4000`

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** `server.log` obsahuje starší `EADDRINUSE` zápisy ze starých nodemon procesů; aktuální poslouchající server je jeden `ts-node` proces na `4000`.

## Step 26: Header user menu + logout ✅

- **Files changed:**
  - `apps/web/src/components/shared/Header.tsx`

- **Design sources read:**
  - `design-system/MASTER.md`

- **What changed:**
  - Header user icon (`lucide-react` `User`) nyní otevírá dropdown menu.
  - Dropdown obsahuje `Nastavení` a `Odhlásit se`.
  - `Nastavení` naviguje na `/settings`.
  - `Odhlásit se` odpojí chat socket přes `disconnectChatSocket()`, provede `supabase.auth.signOut()` a přesměruje na `/login`.
  - Logout má loading indikátor (`Loader2`) a používá glass/primary/rose styl v souladu s headerem.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- apps/web/src/components/shared/Header.tsx artifacts/superpowers/execution.md` → ✅ PASS
  - Dev servery běží na `localhost:3000` a `localhost:4000`.

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** logout je v desktop headeru; mobilní nav zatím vlastní user menu nemá.

## Step 27: Offline stav s posledním online časem ✅

- **Files changed:**
  - `supabase/migrations/20260430024500_profiles_last_online_at.sql`
  - `packages/types/src/chat.ts`
  - `apps/server/src/socket/index.ts`
  - `apps/server/src/routes/chat.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/app/(dashboard)/chat/page.tsx`
  - `apps/web/src/types/chat.ts`
  - `apps/web/src/components/chat/ChatPageClient.tsx`
  - `apps/web/src/components/chat/ChatPanel.tsx`
  - `apps/web/src/components/chat/ChatHeader.tsx`

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **What changed:**
  - Přidán `profiles.last_online_at` s indexem a backfillem z `updated_at`.
  - Socket server ukládá `last_online_at` při připojení i při posledním odpojení usera.
  - `user:offline` event nese `lastOnlineAt`; `presence:sync` umí poslat `lastOnlineByUserId`.
  - `GET /api/chat/messages` vrací `participants` s `isOnline` a `lastOnlineAt`.
  - Chat header při offline partnerovi zobrazuje vedle jména `Naposledy online ...`.

- **Remote migration:**
  - `pnpm exec supabase db push --yes` → ✅ aplikováno `20260430024500_profiles_last_online_at.sql`
  - `pnpm exec supabase db push --dry-run --yes` → ✅ `Remote database is up to date.`

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check` pro dotčené soubory → ✅ PASS
  - `rg -n "last_online_at|lastOnlineAt|partnerLastOnlineAt|lastOnlineByUserId|formatLastOnline|participants" ...` → ✅ tok dat je napojený přes DB, server, action i UI

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** přesný text je formátovaný klientskou timezone browseru; pro lokální uživatele je to žádoucí.

## Step 28: Chat média přes Google Drive místo Supabase Storage ✅

- **Files changed:**
  - `apps/web/src/lib/google-drive/chat.ts`
  - `apps/web/src/app/api/chat/media/[fileId]/route.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/components/chat/ChatComposer.tsx`
  - `apps/server/src/routes/chat.ts`

- **What changed:**
  - Přidán Google Drive helper pro chat média.
  - Upload cesta vytváří strukturu `Chat/YYYY-MM-DD/<soubor>` pod `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
  - `ChatComposer` už nevolá Express `/chat/upload`; používá server action `uploadChatMedia`.
  - `uploadChatMedia` nahrává soubor na Google Drive a vrací proxy URL `/api/chat/media/<driveFileId>`.
  - Přidána Next route `/api/chat/media/[fileId]`, která ověří přihlášeného uživatele přes Supabase session a streamuje soubor z Google Drive.
  - Express chat upload route se Supabase Storage byla odstraněna z `apps/server/src/routes/chat.ts`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `rg -n "chat/upload|domsub-media|supabaseAdmin\\.storage|Supabase Storage|storage\\.from" apps/web/src/components/chat apps/web/src/actions/chat.ts apps/server/src/routes/chat.ts apps/web/src/lib/google-drive/chat.ts apps/web/src/app/api/chat` → ✅ žádné výsledky
  - `git diff --check` pro dotčené soubory → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** Google Drive upload nebyl fyzicky smoke-testnutý živým souborem v browseru; typy a statická upload cesta jsou ověřené.

## Step 29: Chat Drive filename prefix podle data ✅

- **Files changed:**
  - `apps/web/src/lib/google-drive/chat.ts`

- **What changed:**
  - Název chat media souboru už nepoužívá časový prefix `HH-MM-SS-`.
  - Nový formát je `DD.MM.YYYY_<původní-název>`, např. `12.01.2029_background.webp`.
  - Folder struktura zůstává `Chat/YYYY-MM-DD/`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- apps/web/src/lib/google-drive/chat.ts artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** Google Drive umožňuje více souborů se stejným názvem ve stejné složce; pokud bude potřeba vynucená unikátnost, přidáme další suffix mimo časový prefix.

## Step 30: Chat thumbnails, lightbox, reactions, replies ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `packages/types/src/chat.ts`
  - `supabase/migrations/20260430043000_chat_replies_reactions.sql`
  - `supabase/migrations/20260430044500_chat_reply_policy_hardening.sql`
  - `apps/server/src/routes/chat.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/lib/google-drive/chat.ts`
  - `apps/web/src/app/api/chat/media/[fileId]/route.ts`
  - `apps/web/src/stores/chatStore.ts`
  - `apps/web/src/components/chat/ChatPageClient.tsx`
  - `apps/web/src/components/chat/ChatPanel.tsx`
  - `apps/web/src/components/chat/ChatMessageList.tsx`
  - `apps/web/src/components/chat/ChatComposer.tsx`
  - `apps/web/src/components/chat/ChatMessageBubble.tsx`
  - `apps/web/src/components/chat/ChatMediaLightbox.tsx`

- **What changed:**
  - Chat upload ukládá pro obrázky a videa `thumbnailUrl` jako `/api/chat/media/<driveFileId>?variant=thumb`.
  - Google Drive helper a Next media proxy umí vracet Drive thumbnail s cache; originál se načítá až v lightboxu.
  - `ChatMessageBubble` renderuje image/video jako náhled; klik otevře lightbox s originálem.
  - Přidána DB podpora `reply_to_message_id` a `message_reactions` pro jednu heart reakci na uživatele a zprávu.
  - RLS insert policy pro zprávy nově ověřuje, že `reply_to_message_id` patří do dostupné chat konverzace.
  - Server vrací reply preview a reaction summary v `ChatMessage`.
  - Přidán endpoint `POST /chat/messages/:id/reactions/heart`, včetně Socket.IO eventu `message:reaction`.
  - UI bubliny mají lucide `Heart` a `Reply`; composer zobrazuje aktivní odpověď a posílá `replyToMessageId`.

- **Remote migration:**
  - `pnpm exec supabase db push --dry-run --yes` → ✅ ukázalo pouze `20260430043000_chat_replies_reactions.sql`
  - `pnpm exec supabase db push --yes` → ✅ aplikováno
  - `pnpm exec supabase db push --dry-run --yes` → ✅ ukázalo pouze `20260430044500_chat_reply_policy_hardening.sql`
  - `pnpm exec supabase db push --yes` → ✅ aplikováno
  - `pnpm exec supabase db push --dry-run --yes` → ✅ `Remote database is up to date.`

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `rg -n "chat/upload|supabaseAdmin\\.storage|storage\\.from|Supabase Storage|domsub-media" apps/web/src/actions apps/web/src/components/chat apps/web/src/app/api/chat apps/server/src/routes/chat.ts apps/web/src/lib/google-drive/chat.ts` → ✅ žádné výsledky
  - `lsof -nP -iTCP:3000 -iTCP:4000 -sTCP:LISTEN` → ✅ web běží na `3000`, API/server na `4000`

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** Google Drive thumbnail pro video může být krátce po uploadu nedostupný; UI má černý video preview fallback s play ikonou a originál se otevře v lightboxu.

## Step 31: Chat video thumbnail z prvního snímku ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `apps/web/src/components/chat/ChatComposer.tsx`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/lib/google-drive/chat.ts`
  - `apps/web/src/app/api/chat/media/[fileId]/route.ts`

- **What changed:**
  - Video thumbnail už nespoléhá na Google Drive `thumbnailLink`.
  - `ChatComposer` při odeslání videa vytvoří JPEG náhled z prvního načteného snímku přes lokální `<video>` + canvas.
  - Server action uploadne tento thumbnail jako samostatný soubor na Google Drive se stejným datem složky jako originální video.
  - `media_thumbnail_url` pro video teď ukazuje na samostatný proxy soubor `/api/chat/media/<thumbnailDriveFileId>`.
  - Chat media proxy povoluje načíst soubor, pokud je uložený buď v `media_url`, nebo v `media_thumbnail_url`.
  - `uploadChatFileToDrive` už nevrací Drive-generated thumbnail proxy pro video, pouze pro obrázky.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- apps/web/src/components/chat/ChatComposer.tsx apps/web/src/actions/chat.ts apps/web/src/lib/google-drive/chat.ts apps/web/src/app/api/chat/media/[fileId]/route.ts` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** pokud browser neumí načíst první snímek vybraného video souboru do canvasu, odeslání skončí chybou místo tichého uložení videa bez náhledu.

## Step 32: Chat video thumbnail bez černého prvního snímku ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `apps/web/src/components/chat/ChatComposer.tsx`

- **What changed:**
  - Generátor video thumbnailu už nekreslí slepě první `loadeddata` frame.
  - Po načtení metadat zkouší více časů ve videu: krátce po začátku, cca 0.75 s, 1.5 s a části 25/50/75 %.
  - Každý kandidát se vyhodnotí podle pixelů; pokud vypadá jako černá plocha, zkusí se další čas.
  - Přidána ochrana pro krátká videa a situaci, kdy seek na stejný čas nevyvolá `seeked`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- apps/web/src/components/chat/ChatComposer.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** již vytvořený černý thumbnail na Google Drive se tím automaticky nepřegeneruje; oprava platí pro nově nahraná videa nebo backfill.

## Step 33: Chat Enter submit a hledání zpráv ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `packages/types/src/chat.ts`
  - `apps/server/src/routes/chat.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/components/chat/ChatHeader.tsx`
  - `apps/web/src/components/chat/ChatPageClient.tsx`
  - `apps/web/src/components/chat/ChatPanel.tsx`
  - `apps/web/src/components/chat/ChatMessageList.tsx`
  - `apps/web/src/components/chat/ChatComposer.tsx`

- **What changed:**
  - `Enter` v composeru odesílá zprávu.
  - `Ctrl+Enter` i `Cmd+Enter` vloží nový řádek.
  - Chat header má lucide `Search` ikonu, která otevře hledací input.
  - Search se spouští od 3 znaků a hledá bez rozlišení velikosti písmen i diakritiky.
  - Server endpoint `GET /chat/messages/search?q=...` hledá pouze v dostupné konverzaci a vrací max. 50 shod.
  - Při aktivním hledání se hlavní seznam zpráv přepne na výsledky hledání.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- packages/types/src/chat.ts apps/server/src/routes/chat.ts apps/web/src/actions/chat.ts apps/web/src/components/chat/ChatHeader.tsx apps/web/src/components/chat/ChatPageClient.tsx apps/web/src/components/chat/ChatPanel.tsx apps/web/src/components/chat/ChatMessageList.tsx apps/web/src/components/chat/ChatComposer.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** hledání je textové nad obsahem zpráv; nehledá názvy souborů ani text uvnitř médií.

## Step 34: Chat search input focus background ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `apps/web/src/components/chat/ChatHeader.tsx`

- **What changed:**
  - Search input v hlavičce chatu má ve výchozím stavu stejný `background-color`, jaký globální CSS nastavuje inputům při `focus`.
  - Tím se odstraní vizuální změna pozadí při focusu.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- apps/web/src/components/chat/ChatHeader.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** žádný.

## Step 35: Chat unread badge a sound notification ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `packages/types/src/chat.ts`
  - `apps/server/src/routes/chat.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/stores/chatNotificationsStore.ts`
  - `apps/web/src/components/chat/ChatPresenceProvider.tsx`
  - `apps/web/src/components/shared/Navigation.tsx`

- **What changed:**
  - Přidán endpoint `GET /chat/messages/unread`, který vrací nepřečtené zprávy partnera v dostupné konverzaci.
  - Přidána server action `getChatUnreadSummary`.
  - Přidán samostatný Zustand store pro chat notification badge.
  - `ChatPresenceProvider` načte počáteční unread stav a realtime ho aktualizuje přes `message:new`, `message:read`, `message:deleted`.
  - Při nové nepřečtené příchozí zprávě mimo viditelnou `/chat` stránku se přehraje krátký WebAudio zvuk.
  - `Navigation` zobrazuje badge u položky `Chat` úplně vpravo; nad 99 ukáže `99+`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- packages/types/src/chat.ts apps/server/src/routes/chat.ts apps/web/src/actions/chat.ts apps/web/src/stores/chatNotificationsStore.ts apps/web/src/components/chat/ChatPresenceProvider.tsx apps/web/src/components/shared/Navigation.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** zvuk může browser zablokovat, dokud uživatel neprovede první interakci se stránkou; badge funguje nezávisle.

## Step 36: Chat sound pro starší unread po loginu ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `packages/types/src/chat.ts`
  - `apps/server/src/routes/chat.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/components/chat/ChatPresenceProvider.tsx`

- **What changed:**
  - Unread summary endpoint vrací kromě ID také `createdAt` nepřečtených zpráv.
  - `ChatPresenceProvider` po přihlášení pozná nepřečtené zprávy ze včerejška nebo starší.
  - Pokud takové zprávy existují, přehraje stejné chat notification upozornění.
  - Sound přehrávání je robustnější: když browser zvuk při loginu zablokuje, uloží se pending sound a přehraje se při nejbližší interakci uživatele.
  - Realtime příchozí nepřečtené zprávy dál spouští sound notification přes stejný helper.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- packages/types/src/chat.ts apps/server/src/routes/chat.ts apps/web/src/actions/chat.ts apps/web/src/components/chat/ChatPresenceProvider.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** browser může zvuk do první interakce stále odložit; pending sound ho přehraje hned při nejbližším kliknutí/klávese/dotyku.

## Step 37: Chat sound přesné podmínky ✅

- **Files changed:**
  - `packages/types/src/chat.ts`
  - `apps/server/src/routes/chat.ts`
  - `apps/web/src/actions/chat.ts`
  - `apps/web/src/components/chat/ChatPresenceProvider.tsx`

- **What changed:**
  - Odebrána chybná podmínka `včera nebo starší`.
  - Po přihlášení se sound spustí, pokud má user jakékoli nepřečtené chat zprávy a není na `/chat`.
  - Realtime příchozí nepřečtená zpráva spouští sound jen mimo `/chat`.
  - Pending sound se při nejbližší interakci nepřehraje, pokud už je user na `/chat`.
  - Unread summary už nepotřebuje `createdAt`, vrací jen count a ID zpráv.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- packages/types/src/chat.ts apps/server/src/routes/chat.ts apps/web/src/actions/chat.ts apps/web/src/components/chat/ChatPresenceProvider.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** browser může zvuk stále odložit do první interakce kvůli autoplay pravidlům.

## Step 38: Chat bell sound a auto focus psaní ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `apps/web/src/components/chat/ChatPresenceProvider.tsx`
  - `apps/web/src/components/chat/ChatComposer.tsx`

- **What changed:**
  - Sound notification pro unread zprávy je nově výraznější dvoutónový bell.
  - `notifyUnreadMessage` má tvrdou pojistku: nikdy nepřehraje sound, pokud je aktuální path `/chat`.
  - Pending sound se při interakci na `/chat` zahodí, aby nezazněl později po vlastním odeslání.
  - V composeru přibyl globální keydown listener: pokud user není v jiném inputu a začne psát na Chat page, první znak se rovnou vloží do textarea a textarea se fokusuje.
  - Listener ignoruje inputy, textarea, selecty, tlačítka, odkazy, contenteditable, Ctrl/Cmd/Alt zkratky a IME composing.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `pnpm --filter server exec tsc --noEmit` → ✅ PASS
  - `git diff --check -- apps/web/src/components/chat/ChatPresenceProvider.tsx apps/web/src/components/chat/ChatComposer.tsx artifacts/superpowers/execution.md` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** browser může první bell stále odložit do první interakce, pokud autoplay pravidla nedovolí okamžitý zvuk.

## Step 39: Chat unread při čtení historie ✅

- **Design sources read:**
  - `design-system/MASTER.md`
  - `design-system/pages/chat.md`

- **Files changed:**
  - `apps/web/src/components/chat/ChatPageClient.tsx`
  - `apps/web/src/components/chat/ChatPanel.tsx`
  - `apps/web/src/components/chat/ChatMessageList.tsx`

- **What changed:**
  - `markMessageAsRead` se nově spouští jen tehdy, když je Chat page viditelná, není aktivní search režim a user je dole u konce konverzace.
  - Když user scrolluje starší zprávy a přijde nová zpráva od partnera, zpráva zůstane nepřečtená a senderovi se nezobrazí stav `Zobrazeno`.
  - Při nepřečtených zprávách během scrollu nahoře se na tlačítku dolů zobrazí crimson indikátor `1 nová zpráva / N nových zpráv`.
  - Klik/scroll dolů znovu vyhodnotí stav konce konverzace a až potom označí nepřečtené zprávy jako přečtené.
  - Nová nepřečtená zpráva přijatá během čtení historie aktualizuje také chat notification store pro konzistentní badge stav.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** práh pro „jsem dole“ je 80 px od konce konverzace, aby se při téměř spodní pozici nechování necukalo.

## Step 40: Chat historie propsaná do ARCHITECTURE ✅

- **Files changed:**
  - `docs/ARCHITECTURE.md`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Do `docs/ARCHITECTURE.md` byl přidán TOC odkaz `Chat Page Implementation History`.
  - Přidána nová kapitola `## 14. Chat Page Implementation History`.
  - Kapitola shrnuje dosavadní obsah z tohoto execution logu pro Chat page:
    - realtime/socket základ,
    - DB/API/auth opravy,
    - UI sjednocení s design systémem,
    - presence a read receipts,
    - Google Drive média,
    - message features,
    - unread badge/sound notifications,
    - ověřovací historii a známé ruční testovací mezery.

- **Verify:**
  - `rg -n "Chat Page Implementation History|Source log:.*execution.md|Current Chat Status|Verification History" docs/ARCHITECTURE.md` → ✅ PASS
  - `git diff --check -- docs/ARCHITECTURE.md` → ⚠️ našlo existující trailing whitespace mimo nově přidanou sekci (`docs/ARCHITECTURE.md:275`), ponecháno beze změny jako unrelated dirty diff.

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** `ARCHITECTURE.md` už měl před touto změnou jiné dirty úpravy; tato práce doplnila jen TOC a novou Chat history kapitolu.

## Step 41: Chat historie přesunuta do Phase 2 checklistu ✅

- **Files changed:**
  - `docs/ARCHITECTURE.md`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Na základě upřesnění byla odstraněna samostatná kapitola `Chat Page Implementation History` a její TOC odkaz.
  - Historie z `execution.md` je nyní propsaná přímo do `## 13. Development Phases` → `Phase 2: Core Features` → `Chat`.
  - Chat checklist obsahuje detailní hotové položky pro realtime, auth fix, Google Drive média, thumbnails, voice, typing, read receipts, unread indikátor, presence, logout, replies/reactions, search, keyboard behavior, unread badge/sound a design systém.
  - Do checklistu byly doplněny také zbývající ruční ověřovací mezery.

- **Verify:**
  - `rg -n "Chat Page Implementation History|## 14\\.|Source log:.*execution.md" docs/ARCHITECTURE.md` → ✅ žádné výsledky
  - `rg -n "Remaining manual verification|No authorization header|Google Drive" docs/ARCHITECTURE.md` → ✅ položky jsou v Phase 2 Chat checklistu

- **Review:**
  - **Blocker:** žádný.
  - **Major:** žádný.
  - **Minor:** `ARCHITECTURE.md` stále obsahuje unrelated dirty formátovací změny z předchozího stavu; nebyly revertovány.

## Punishments Step 1: DB migrace ✅

- **Files changed:**
  - `supabase/migrations/20260430143100_punishments.sql`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidána tabulka `public.punishments` pro šablony i přiřazené tresty, včetně statusů, task vazby, completion polí a audit timestampů.
  - Přidány indexy, RLS policies pro DOM/SUB přístupy, trigger na `updated_at`, punishment notification policy a idempotentní realtime publication blok.

- **Verify:**
  - `pnpm exec supabase db push --dry-run --yes` → ✅ PASS, pushnul by pouze `20260430143100_punishments.sql`
  - `rg -n "CREATE TABLE IF NOT EXISTS public\\.punishments|ALTER TABLE public\\.punishments ENABLE ROW LEVEL SECURITY" supabase/migrations` → ✅ PASS

## Punishments Step 2: Typy ✅

- **Files changed:**
  - `apps/web/src/types/punishment.ts`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidány lokální web typy `PunishmentStatus`, `PunishmentSeverity`, `Punishment`, `PunishmentTaskSummary` a pomocné typy pro viewer/sub profile.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "PunishmentStatus|export interface Punishment" apps/web/src/types/punishment.ts` → ✅ PASS

## Punishments Step 3: Čtecí server actions ✅

- **Files changed:**
  - `apps/web/src/actions/punishments.ts`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidán viewer context helper pro session/profile a DOM sub profily.
  - Přidány `getPunishments()` a `getPunishmentTemplates()` s normalizací Supabase task joinu a stabilním řazením.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "getPunishments|getPunishmentTemplates|getPunishmentViewerContext" apps/web/src/actions/punishments.ts` → ✅ PASS

## Punishments Step 4: Template CRUD actions ✅

- **Files changed:**
  - `apps/web/src/actions/punishments.ts`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidána validace template vstupu a DOM-only context helper.
  - Přidány `createPunishmentTemplate`, `updatePunishmentTemplate`, `deletePunishmentTemplate` s revalidací `/punishments`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "createPunishmentTemplate|updatePunishmentTemplate|deletePunishmentTemplate|revalidatePath\\(\\\"/punishments\\\"\\)" apps/web/src/actions/punishments.ts` → ✅ PASS

## Punishments Step 5: Assignment a completion actions ✅

- **Files changed:**
  - `apps/web/src/actions/punishments.ts`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidán sdílený helper pro vytvoření přiřazeného trestu z šablony nebo ad-hoc vstupu.
  - Přidány `assignPunishment`, `createLinkedPunishmentForTask`, `submitPunishmentCompletion`, `completePunishment` a `cancelPunishment`.
  - Mutace zapisují DB notifikace a revalidují `/punishments`, `/tasks` a task detail při task vazbě.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "assignPunishment|submitPunishmentCompletion|completePunishment|cancelPunishment" apps/web/src/actions/punishments.ts` → ✅ PASS

## Punishments Step 6: Route `/punishments` ✅

- **Files changed:**
  - `apps/web/src/app/(dashboard)/punishments/page.tsx`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidána dashboard route `/punishments` s force-dynamic server page a základním načtením `getPunishments()`.
  - Přidán dočasný server-rendered stav, který další krok nahradí plným klientským UI.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `test -f 'apps/web/src/app/(dashboard)/punishments/page.tsx'` → ✅ PASS

## Punishments Step 7: Základní UI komponenty ✅

- **Files changed:**
  - `apps/web/src/app/(dashboard)/punishments/page.tsx`
  - `apps/web/src/components/punishments/PunishmentsClient.tsx`
  - `apps/web/src/components/punishments/PunishmentCard.tsx`
  - `apps/web/src/components/punishments/PunishmentForm.tsx`
  - `apps/web/src/components/punishments/PunishmentLibrary.tsx`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - `/punishments` je napojené na klientské role-based UI s filtry Aktivní / Ke kontrole / Historie / Knihovna.
  - Přidány karty trestů s SUB submit akcí a DOM confirm/cancel akcemi.
  - Přidána DOM knihovna šablon s create/edit/delete formulářem.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "Aktivní|Ke kontrole|Knihovna|Odeslat ke kontrole" apps/web/src/components/punishments 'apps/web/src/app/(dashboard)/punishments/page.tsx'` → ✅ PASS

## Punishments Step 8: DOM přiřazení z `/punishments` ✅

- **Files changed:**
  - `apps/web/src/app/(dashboard)/punishments/page.tsx`
  - `apps/web/src/components/punishments/AssignPunishmentDialog.tsx`
  - `apps/web/src/components/punishments/PunishmentsClient.tsx`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Přidán DOM dialog pro přiřazení trestu ze šablony nebo jako ad-hoc trest.
  - `/punishments` předává `subProfiles` do klientského UI a DOM má akci `Přiřadit trest`.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "AssignPunishmentDialog|Přiřadit trest|template_id" apps/web/src/components/punishments apps/web/src/actions/punishments.ts` → ✅ PASS

## Punishments Step 9: Task reject/revision integrace ✅

- **Files changed:**
  - `apps/web/src/components/tasks/DOMApproval.tsx`
  - `apps/web/src/actions/tasks.ts`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - DOM approval panel má volitelný blok `Přiřadit trest při odmítnutí` s výběrem šablony nebo ad-hoc trestem.
  - `rejectTask()` zachovává `revision_requested` workflow a při zvoleném trestu volá `createLinkedPunishmentForTask()` s `task_id`.
  - Chyba při vytvoření trestu se vrací explicitně a není tiše ignorovaná.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "punishment|Přiřadit trest|rejectTask" apps/web/src/components/tasks/DOMApproval.tsx apps/web/src/actions/tasks.ts apps/web/src/actions/punishments.ts` → ✅ PASS

## Punishments Step 10: Navázané tresty v task detailu ✅

- **Files changed:**
  - `apps/web/src/actions/tasks.ts`
  - `apps/web/src/types/task.ts`
  - `apps/web/src/components/tasks/TaskDetailContent.tsx`
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - `getTasks()` i `getTask()` načítají ne-template tresty navázané přes `task_id`.
  - `Task` typ má optional `punishments`.
  - Task detail/popup zobrazuje panel `Navázané tresty` se stavem, Náročností a completion note.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS
  - `rg -n "Navázané tresty|punishments" apps/web/src/actions/tasks.ts apps/web/src/types/task.ts apps/web/src/components/tasks/TaskDetailContent.tsx` → ✅ PASS

## Punishments Step 11: Revalidate-only refresh ✅

- **Files changed:**
  - `artifacts/superpowers/execution.md`

- **What changed:**
  - Realtime hook nebyl přidán; první iterace používá `revalidatePath()` v server actions a `router.refresh()` v klientských komponentách.
  - Důvod: MVP workflow nepotřebuje live multi-session refresh a tabulka je už připravená v realtime publikaci pro pozdější rozšíření.

- **Verify:**
  - `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishment Plans Step 1: Context verification ✅

Files changed: none.

What changed:

- Verified current Punishments shape: DOM-only templates, category tags, manual `usage_count`, and template-card increment action.
- Confirmed relevant UI entry points: `PunishmentsClient`, `PunishmentLibrary`, `PunishmentForm`, and `/punishments` page.

Verification:

- `rg -n "usage_count|categories|increment_punishment_template_usage|PunishmentLibrary|PunishmentsClient" apps/web/src supabase/migrations` → ✅ PASS

## Punishment Plans Step 2: DB tables ✅

Files changed:

- `supabase/migrations/20260430181500_punishment_plans.sql`

What changed:

- Added `public.punishment_plans` for DOM-owned punishment collections.
- Added `public.punishment_plan_items` with template snapshot fields, position, done state, and usage-count tracking timestamp.
- Added indexes and `handle_updated_at` triggers for plans and plan items.

Verification:

- `pnpm exec supabase db push --dry-run --yes` → ✅ PASS; would push `20260430181500_punishment_plans.sql`

## Punishment Plans Step 3: DOM-only RLS ✅

Files changed:

- `supabase/migrations/20260430181500_punishment_plans.sql`

What changed:

- Enabled RLS for `public.punishment_plans` and `public.punishment_plan_items`.
- Added DOM-owned CRUD policies for plans.
- Added item policies scoped through the parent plan and own template library.

Verification:

- `rg -n "punishment_plans|punishment_plan_items|ENABLE ROW LEVEL SECURITY|CREATE POLICY" supabase/migrations/20260430181500_punishment_plans.sql` → ✅ PASS

## Punishment Plans Step 4: Toggle helper ✅

Files changed:

- `supabase/migrations/20260430181500_punishment_plans.sql`

What changed:

- Added `public.set_punishment_plan_item_done(item_uuid, next_done)`.
- Helper verifies DOM ownership, updates item done state, and adjusts template `usage_count` by `+1/-1` only when state changes.
- Decrement uses `greatest(usage_count - 1, 0)` to avoid negative counts.

Verification:

- `pnpm exec supabase db push --dry-run --yes` → ✅ PASS; would push `20260430181500_punishment_plans.sql`

## Punishment Plans Step 5: Types ✅

Files changed:

- `apps/web/src/types/punishment.ts`

What changed:

- Added `PunishmentPlanStatus`.
- Added `PunishmentPlanItem` with snapshot, position, and done-state fields.
- Added `PunishmentPlan` with metadata and nested items.

Verification:

- `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishment Plans Step 6: Read server actions ✅

Files changed:

- `apps/web/src/actions/punishments.ts`

What changed:

- Added plan/item row normalization helpers.
- Added `getPlansForContext`, `getPunishmentPlans()`, and `getPunishmentPlan(id)`.
- Extended `getPunishments()` to return DOM plans alongside templates.

Verification:

- `rg -n "getPunishmentPlans|getPunishmentPlan" apps/web/src/actions/punishments.ts && pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishment Plans Step 7: Plan CRUD actions ✅

Files changed:

- `apps/web/src/actions/punishments.ts`

What changed:

- Added `createPunishmentPlan`, `updatePunishmentPlan`, and `deletePunishmentPlan`.
- Added plan input parsing for title, description, and optional event date.
- Added delete safety: done items are unset before plan deletion so `usage_count` is decremented.

Verification:

- `rg -n "createPunishmentPlan|updatePunishmentPlan|deletePunishmentPlan|revalidatePath\\(\\\"/punishments\\\"\\)" apps/web/src/actions/punishments.ts` → ✅ PASS

## Punishment Plans Step 8: Plan item actions ✅

Files changed:

- `apps/web/src/actions/punishments.ts`

What changed:

- Added `addPunishmentToPlan` with template snapshot creation.
- Added `removePunishmentPlanItem`, `reorderPunishmentPlanItems`, and `setPunishmentPlanItemDone`.
- Item removal unsets done state first so template `usage_count` is decremented if needed.

Verification:

- `rg -n "addPunishmentToPlan|removePunishmentPlanItem|reorderPunishmentPlanItems|setPunishmentPlanItemDone" apps/web/src/actions/punishments.ts && pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishment Plans Step 9: Punishments tabs ✅

Files changed:

- `apps/web/src/app/(dashboard)/punishments/page.tsx`
- `apps/web/src/components/punishments/PunishmentsClient.tsx`

What changed:

- `/punishments` now passes plans to the client.
- Added a `Knihovna` / `Plány` segmented switch.
- Kept the SUB guard unchanged.

Verification:

- `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishment Plans Step 10: Plans list UI ✅

Files changed:

- `apps/web/src/components/punishments/PunishmentPlanForm.tsx`
- `apps/web/src/components/punishments/PunishmentPlans.tsx`
- `apps/web/src/components/punishments/PunishmentsClient.tsx`

What changed:

- Added create/edit form for punishment plans.
- Added plan cards with title, description, event time, done/item count, and actions.
- Wired the `Plány` tab to the new list UI.

Verification:

- `pnpm --filter web exec eslint src/components/punishments/PunishmentPlans.tsx src/components/punishments/PunishmentPlanForm.tsx` → ✅ PASS

## Punishment Plans Step 11: Plan detail UI ✅

Files changed:

- `apps/web/src/components/punishments/PunishmentPlanDetail.tsx`
- `apps/web/src/components/punishments/PunishmentsClient.tsx`

What changed:

- Added open plan detail card under the plans list.
- Added collapsed plan item rows with expandable descriptions.
- Added done checkbox wiring to `setPunishmentPlanItemDone`.

Verification:

- `pnpm --filter web exec tsc --noEmit` → ✅ PASS

## Punishment Plans Step 12: Add templates to plans ✅

Files changed:

- `apps/web/src/components/punishments/AddPunishmentToPlan.tsx`
- `apps/web/src/components/punishments/PunishmentPlanDetail.tsx`
- `apps/web/src/components/punishments/PunishmentsClient.tsx`

What changed:

- Added template picker with text/category filtering inside plan detail.
- Added add-to-plan action wiring and UI duplicate filtering.
- Added item removal from plan detail.

Verification:

- `pnpm --filter web exec eslint src/components/punishments/AddPunishmentToPlan.tsx src/components/punishments/PunishmentPlanDetail.tsx` → ✅ PASS

## Punishment Plans Step 13: Documentation ✅

Files changed:

- `docs/ARCHITECTURE.md`
- `artifacts/superpowers/execution.md`

What changed:

- Documented DOM-only punishment plans/collections under Phase 2 Punishments.
- Captured separate plan tables, snapshot items, collapsed checklist detail, and usage-count checkbox behavior.

Verification:

- `git diff --check -- docs/ARCHITECTURE.md artifacts/superpowers/execution.md artifacts/superpowers/finish.md` → ✅ PASS

## Punishment Plans Step 14: Final verification ✅

Files changed:

- `apps/web/src/actions/punishments.ts`
- `apps/web/src/types/punishment.ts`
- `apps/web/src/app/(dashboard)/punishments/page.tsx`
- `apps/web/src/components/punishments/AddPunishmentToPlan.tsx`
- `apps/web/src/components/punishments/PunishmentPlanDetail.tsx`
- `apps/web/src/components/punishments/PunishmentPlanForm.tsx`
- `apps/web/src/components/punishments/PunishmentPlans.tsx`
- `apps/web/src/components/punishments/PunishmentsClient.tsx`
- `supabase/migrations/20260430181500_punishment_plans.sql`
- `docs/ARCHITECTURE.md`
- `artifacts/superpowers/execution.md`

What changed:

- Ran final TypeScript, lint, diff, migration, DB schema, and route smoke checks.
- Applied `20260430181500_punishment_plans.sql` to the linked remote Supabase DB.
- Confirmed `/punishments` responds with `200` on the local dev server.

Verification:

- `pnpm --filter web exec tsc --noEmit` → ✅ PASS
- `pnpm --filter web exec eslint src/actions/punishments.ts 'src/components/punishments/*.tsx' src/types/punishment.ts` → ✅ PASS
- `git diff --check -- ...` → ✅ PASS after quoting the dashboard route path
- `pnpm exec supabase db push --dry-run --yes` → ✅ PASS; showed pending plan migration before push, then remote up to date after push
- `pnpm exec supabase db push --yes` → ✅ PASS; applied `20260430181500_punishment_plans.sql`
- `pnpm exec supabase db query --linked "select ..."` → ✅ PASS; `punishment_plans`, `punishment_plan_items`, and `set_punishment_plan_item_done` exist
- `curl -I http://localhost:3000/punishments` → ✅ PASS; `HTTP/1.1 200 OK`

Notes:

- First ESLint attempt used an unquoted shell glob and zsh rejected it; rerun with quoted glob passed.
- First `git diff --check` attempt used an unquoted `(dashboard)` path and zsh rejected it; rerun with the path quoted passed.

## Punishment Plans Runtime Fix: PostgREST schema cache ✅

Files changed:

- `supabase/migrations/20260430181500_punishment_plans.sql`
- `artifacts/superpowers/execution.md`

What changed:

- Investigated checkbox failure: `Could not find the table 'public.punishment_plans' in the schema cache`.
- Confirmed the linked database already had `punishment_plans`, `punishment_plan_items`, and `set_punishment_plan_item_done`.
- Forced PostgREST schema cache reload and added the same reload notification to the plan migration for fresh deploys.

Verification:

- `pnpm exec supabase db query --linked "select ..."` → ✅ PASS; plan tables and RPC function exist.
- `pnpm exec supabase db query --linked "NOTIFY pgrst, 'reload schema';"` → ✅ PASS
- REST check for `punishment_plans` → ✅ PASS; `200`, no schema-cache error.
- REST check for `punishment_plan_items` → ✅ PASS; `200`, no schema-cache error.
- REST check for `set_punishment_plan_item_done` → ✅ PASS; function is visible, test UUID returns expected `Punishment plan item not found`.
- `curl -I http://localhost:3000/punishments` → ✅ PASS; `HTTP/1.1 200 OK`

## Punishment Plans Runtime Fix: ambiguous usage_count ✅

Files changed:

- `supabase/migrations/20260430181500_punishment_plans.sql`
- `supabase/migrations/20260430190000_fix_punishment_plan_usage_count_ambiguity.sql`
- `artifacts/superpowers/execution.md`

What changed:

- Fixed `column reference "usage_count" is ambiguous` in `set_punishment_plan_item_done`.
- Qualified the update with `public.punishments AS p`, using `p.usage_count` on the right side of increment/decrement expressions.
- Added a follow-up migration because the original punishment plan migration had already been pushed.

Verification:

- `git diff --check -- supabase/migrations/20260430181500_punishment_plans.sql supabase/migrations/20260430190000_fix_punishment_plan_usage_count_ambiguity.sql` → ✅ PASS
- `pnpm exec supabase db push --dry-run --yes` → ✅ PASS before applying; one pending migration.
- `pnpm exec supabase db push --yes` → ✅ PASS; applied `20260430190000_fix_punishment_plan_usage_count_ambiguity.sql`.
- Transactional DB smoke test toggling an existing plan item and rolling back → ✅ PASS; no ambiguous `usage_count` error.
- `select count(*) ... punishment_plan_items where template_id is not null` → ✅ PASS; 4 testable plan items exist.
- `curl -I http://localhost:3000/punishments` → ✅ PASS; `HTTP/1.1 200 OK`.
- Follow-up `db push --dry-run` after applying → ⚠️ blocked by temporary Supabase pooler auth circuit breaker; not blocking because migration push and SQL smoke already passed.

## Phase 3 Wishes MVP ✅

Files changed:

- `supabase/migrations/20260430200000_wishes.sql`
- `apps/web/src/types/wish.ts`
- `apps/web/src/actions/wishes.ts`
- `apps/web/src/lib/google-drive/wishes.ts`
- `apps/web/src/lib/wishes/media-limits.ts`
- `apps/web/src/app/(dashboard)/wishes/page.tsx`
- `apps/web/src/app/api/wishes/media/[mediaId]/route.ts`
- `apps/web/src/components/wishes/WishesClient.tsx`
- `apps/web/src/components/wishes/WishForm.tsx`
- `apps/web/src/components/wishes/WishFilters.tsx`
- `apps/web/src/components/wishes/WishCard.tsx`
- `apps/web/src/components/wishes/WishDomControls.tsx`
- `apps/web/src/components/wishes/WishMediaUpload.tsx`
- `apps/web/src/components/wishes/WishMediaStrip.tsx`
- `apps/web/src/components/shared/Navigation.tsx`
- `apps/web/src/components/shared/Header.tsx`
- `docs/ARCHITECTURE.md`
- `artifacts/superpowers/brainstorm.md`
- `artifacts/superpowers/plan.md`
- `artifacts/superpowers/execution.md`
- `artifacts/superpowers/finish.md`

What changed:

- Added `/wishes` as the first Phase 3 module.
- Added SUB wish CRUD with status locking: SUB can edit/delete while status is `new` or `noted`.
- Added DOM status management: `noted`, `planned`, `fulfilled`, `declined`.
- Added DOM-only private notes in separate `public.wish_dom_notes`.
- Added Google Drive wish media uploads:
  - Drive folder path: root -> `Přání` -> wish-specific folder.
  - Metadata table: `public.wish_media`.
  - Authenticated proxy route: `/api/wishes/media/[mediaId]`.
  - Client-side batch limit: 300 MB.
- Added Czech navigation/header copy for `Přání`.
- Updated Phase 3 architecture notes and superpowers artifacts.

Verification:

- `pnpm --filter web exec tsc --noEmit` → ✅ PASS
- `pnpm --filter web exec eslint src/actions/wishes.ts src/types/wish.ts src/lib/google-drive/wishes.ts src/lib/wishes/media-limits.ts 'src/components/wishes/*.tsx' 'src/app/(dashboard)/wishes/page.tsx' 'src/app/api/wishes/media/[mediaId]/route.ts' src/components/shared/Navigation.tsx src/components/shared/Header.tsx` → ✅ PASS
- `git diff --check -- ...` → ✅ PASS
- `curl -I http://localhost:3000/wishes` → ✅ PASS; `HTTP/1.1 200 OK`
- `pnpm exec supabase db push --dry-run --yes` → ⚠️ blocked by Supabase temp-role auth/circuit breaker.
- `pnpm exec supabase db query --linked "select 1 as ok;"` → ⚠️ initially blocked by the same Supabase pooler auth/circuit breaker.
- `pnpm exec supabase db query --linked --file supabase/migrations/20260430200000_wishes.sql` → ✅ PASS after pooler reset; applied Wishes schema.
- `pnpm exec supabase db query --linked "select to_regclass(...)"` → ✅ PASS; `wishes`, `wish_dom_notes`, `wish_media`, and Wishes RPC helpers exist.
- REST checks for `wishes`, `wish_dom_notes`, and `wish_media` → ✅ PASS for schema visibility; anonymous requests return permission errors, not schema-cache errors.
- `curl -I http://localhost:3000/wishes` → ✅ PASS; `HTTP/1.1 200 OK`

Notes:

- `db push` still cannot be used until Supabase temp-role auth recovers, but the Wishes SQL migration has been applied directly through `db query --file`.

## Socket.IO Console Overlay Fix ✅

Files changed:

- `apps/web/src/lib/socket.ts`
- `artifacts/superpowers/execution.md`

What changed:

- Downgraded Socket.IO `connect_error` logging from `console.error` to throttled `console.warn`.
- Kept Socket.IO reconnect behavior unchanged.
- Prevented Next.js dev overlay from showing a blocking Console Error on pages like `/wishes` when the chat realtime backend is temporarily unavailable.

Verification:

- `pnpm --filter web exec eslint src/lib/socket.ts` → ✅ PASS
- `pnpm --filter web exec tsc --noEmit` → ✅ PASS
- `git diff --check -- apps/web/src/lib/socket.ts` → ✅ PASS
