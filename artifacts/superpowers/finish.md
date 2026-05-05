# Finish: Phase 6 Batch 1-15 - Shared Polish + Page-by-page Polish + Performance + Testing

## Hotovo

### Batch 1: Shared foundations

- Přidaná závislost `framer-motion` do `apps/web`.
- Přidané sdílené motion helpery v `apps/web/src/lib/motion.ts`.
- Přidaný sdílený `EmptyState` komponent:
  - `default`, `compact`, `danger`, `success` varianta,
  - volitelná primární a sekundární akce,
  - reduced-motion aware vstupní animace.
- Přidaný globální toast systém:
  - `ToastProvider`,
  - `useToast`,
  - typy `success`, `error`, `info`,
  - max 3 aktivní toasty,
  - bottom-center pozice se safe-area,
  - auto-dismiss a ruční zavření,
  - Framer Motion enter/exit animace s reduced-motion fallbackem.
- Root layout používá `ToastProvider` a `html lang="cs"`.

### Batch 2: Tasks polish

- Tasks list/filter prázdný stav používá sdílený `EmptyState`.
- Task karty mají jemnou Framer Motion entrance animaci s reduced-motion fallbackem.
- Toasty jsou napojené na task mutace:
  - vytvoření úkolu,
  - DOM úprava / zrušení / smazání úkolu,
  - SUB textové odevzdání,
  - SUB odevzdání úkolu ke kontrole,
  - DOM schválení / odmítnutí úkolu,
  - upload task médií,
  - smazání task médií,
  - komentáře: přidání, editace, smazání, reakce.
- Vytvoření úkolu teď vrací data do client flow místo server `redirect`, aby se po úspěchu mohl zobrazit toast a stránka pak přejít na `/tasks`.
- DOM úprava/smazání úkolu po úspěchu refreshuje detail přes `onTaskMutated`.
- Doplněné aria labely pro hvězdičkové hodnocení a icon-only tlačítka v komentářích.

### Batch 3: Chat polish

- `design-system/MASTER.md` a `design-system/pages/chat.md` byly přečtené před úpravami.
- Chat prázdná konverzace a prázdné/failed search výsledky používají sdílený `EmptyState`.
- Chat toast feedback je napojený na:
  - příliš velkou přílohu,
  - chybu uploadu/odeslání zprávy,
  - smazání zprávy,
  - chybu reakce srdcem,
  - chybu načtení starších zpráv.
- Chat connection status už nepoužívá zelenou jako hlavní stavový text; primární akcent zůstává crimson, zelená zůstává jen drobný online indikátor.
- Doplněné aria labely pro delete/reply/reaction/attachment icon-only controls.
- Opravené přísné React lint nálezy v dotčených chat souborech:
  - čtení ref během renderu,
  - synchronní setState v effectu.

### Batch 4: Gallery polish

- Gallery prázdná galerie i prázdný filtr používají sdílený `EmptyState`.
- Empty state CTA otevírá existující file picker přes `GalleryUpload` ref.
- Gallery upload toasty jsou napojené na:
  - probíhající upload,
  - batch limit / neplatné soubory,
  - úspěšný upload,
  - částečné nebo úplné selhání uploadu.
- Favourite toasty jsou napojené v card i lightbox flow.
- Bulk toasty jsou napojené pro hromadné favourite a hromadné mazání.
- Masonry karty zůstaly bez nových vstupních animací, aby nevznikal layout shift.
- `docs/ARCHITECTURE.md` zaznamenává aktuální stav Phase 6 Batch 1-4.

### Batch 5: Monitoring polish

- Monitoring device, visited web, form activity and screenshot empty states používají sdílený `EmptyState`.
- Toasty jsou napojené na monitoring mutace:
  - vygenerování párovacího kódu,
  - přejmenování instalace,
  - zneplatnění instalace,
  - odebrání zneplatněné instalace,
  - smazání monitoring položky.
- Timeline a screenshot sekce zůstaly bez těžkých animací, aby se nezhoršil výkon dlouhých seznamů a gridů.
- `docs/ARCHITECTURE.md` zaznamenává aktuální stav Phase 6 Batch 1-5.

### Batch 6: Superadmin polish

- Superadmin load error a empty states pro čekající účty i SUB účty používají sdílený `EmptyState`.
- Toasty jsou napojené na:
  - přiřazení uživatele,
  - chybu při odhalení hesla,
  - uložení přístupu ke stránce,
  - chybu při uložení přístupu ke stránce.
- Odhalení/skrytí hesla má explicitní `aria-label`.
- `useSuperAdmin` má doplněné konkrétní typy pro uživatele, app config a reveal password response.
- `docs/ARCHITECTURE.md` zaznamenává aktuální stav Phase 6 Batch 1-6.

### Batch 7: Achievements/Rewards polish

- `design-system/pages/achievements.md` byl přečtený před úpravami.
- Achievements empty states používají sdílený `EmptyState` pro aktivní odznaky, katalog, historii a kázeňský ledger.
- Rewards empty states používají sdílený `EmptyState` pro seznam odměn, čekající žádosti a historii claimů.
- Page-level load error stavy pro Achievements a Rewards používají `EmptyState` danger variantu.
- Toasty jsou napojené na:
  - vytvoření, úpravu a smazání odznaku,
  - přidělení a odebrání odznaku,
  - ruční přidání kázeňského dluhu,
  - vytvoření, úpravu a smazání odměny,
  - odeslání žádosti o odměnu,
  - schválení a odmítnutí žádosti.
- Achievement a reward karty mají jemnou Framer Motion entrance animaci s reduced-motion fallbackem.
- Aktivní odměna už nepoužívá zelenou jako hlavní stavovou barvu; primární akcent zůstává crimson.
- `docs/ARCHITECTURE.md` zaznamenává aktuální stav Phase 6 Batch 1-7.

### Batch 8: Wishes polish

- Wishes page-level load error a empty states pro prázdný seznam / prázdný filtr používají sdílený `EmptyState`.
- Toasty jsou napojené na:
  - vytvoření přání,
  - úpravu a smazání přání,
  - změnu stavu přání,
  - uložení DOM poznámky,
  - upload médií,
  - odebrání média.
- Wish card list má jemnou Framer Motion entrance animaci s reduced-motion fallbackem.
- Odebrání média z přání teď vyžaduje potvrzení před destruktivní akcí.
- `docs/ARCHITECTURE.md` zaznamenává aktuální stav Phase 6 Batch 1-8.

### Batch 9: Performance - image optimization slice

- Přečtené lokální Next 16 docs pro `next/image` a image optimization.
- Gallery, task evidence a wish media thumbnails používají `next/image` s:
  - pevnými existujícími kontejnery přes `fill`,
  - responzivním `sizes`,
  - `loading="lazy"`,
  - `unoptimized`, protože média tečou přes auth-protected Next API route a image optimizer neposílá auth hlavičky.
- Lightbox/full-size obrázky zůstaly na přímém browser requestu, aby se nezměnil auth/proxy model.
- `docs/ARCHITECTURE.md` zaznamenává první dokončený Performance image slice.

### Batch 10: Performance debug - Gallery NFT warning

- Cíleně rozebraný Turbopack/NFT warning:
  - `Encountered unexpected file in NFT list`,
  - import trace přes `apps/web/src/lib/gallery/processing.ts`.
- Potvrzená příčina: dynamické filesystem skenování ffmpeg binárky v `getFfmpegPath()`:
  - `existsSync(...)`,
  - `readdirSync(...)`,
  - workspace root kandidáti přes `process.cwd()`.
- Oprava: `getFfmpegPath()` už netrasuje filesystem při buildu a pouze vybere:
  - `FFMPEG_PATH`,
  - cestu z `ffmpeg-static`,
  - fallback `ffmpeg` / `ffmpeg.exe`.
- Runtime chyba chybějící binárky se řeší až při `execFile`, místo aby build-time tracer skenoval workspace.
- Po opravě `/gallery` NFT trace klesl z `src: 185, nextConfig: true` na `src: 17, nextConfig: false`.

### Batch 11: Performance - bundle analysis + task video code split

- Spuštěný `next experimental-analyze --output` pro produkční build.
- Největší původní task client chunky byly:
  - `/tasks` -> cca `768 KB`,
  - `/tasks/[id]` -> cca `768 KB`,
  - oba obsahovaly `video.js` / `videojs`.
- Potvrzená příčina: `TaskMediaLightbox` staticky importoval `TaskVideoPlayer`, který importuje `video.js` a `video.js/dist/video-js.css`.
- Oprava: `TaskVideoPlayer` se v `TaskMediaLightbox` načítá přes `next/dynamic` s `ssr: false` a kompaktním spinner fallbackem.
- Po buildu je `video.js` v samostatném lazy client chunku `0jat999ze~i6y.js` (`680 KB`) a související CSS v `0pcu84lvjbdmb.css` (`48 KB`).
- `/tasks` a `/tasks/[id]` route entry JS už tento video chunk neobsahují; oba route `react-loadable-manifest.json` ho evidují jako lazy asset.
- Detailní poznámky jsou v `artifacts/superpowers/debug_task_video_bundle_split.md`.

### Batch 12: Performance - DB query optimization

- Spuštěné read-only Supabase `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` pro:
  - task feed řazený podle `created_at`,
  - DOM -> SUB profile lookup,
  - task media batch lookup.
- Aktuální remote dataset je malý, takže planner právem používá sekvenční scany:
  - `tasks`: cca 10 řádků, execution cca `2.653 ms`,
  - `profiles`: cca 2 řádky, execution cca `0.162 ms`,
  - `task_media`: cca 5 řádků, execution cca `0.178 ms`.
- Přidaná migrace `supabase/migrations/20260504190522_phase6_query_indexes.sql` s hot-path indexy:
  - `profiles_dom_full_name_idx`,
  - `tasks_created_at_idx`,
  - `task_media_task_created_idx`,
  - `task_comments_active_task_tab_created_idx`.
- Migrace byla syntaxově ověřená na remote DB v rollbackované transakci.
- `supabase db push --dry-run --yes` původně ukázal, že remote migration history není s lokálními soubory sladěná.
- Kontrolní dotazy potvrdily, že objekty z 12 starších pending migrací na remote už existují.
- `supabase migration repair ... --status applied --linked --yes` srovnal remote migration metadata.
- `supabase db push --yes` potom aplikoval už jen `20260504190522_phase6_query_indexes.sql`.
- Finální `supabase db push --dry-run --yes` -> `Remote database is up to date.`
- Detailní poznámky jsou v `artifacts/superpowers/debug_phase6_db_query_indexes.md`.

### Batch 13: Performance - API response caching slice

- Přidaný volitelný Redis helper pro `apps/server`:
  - `apps/server/src/utils/redis-cache.ts`,
  - používá `REDIS_URL`,
  - bez `REDIS_URL` je no-op,
  - cache chyby neblokují API response.
- `GET /api/chat/messages/search` teď cacheuje odpovědi přes Redis:
  - per viewer,
  - per normalized query,
  - per sorted participant set,
  - TTL `30s`.
- Search endpoint vrací diagnostický header:
  - `X-Cache: HIT`,
  - `X-Cache: MISS`.
- Chat search cache se invaliduje po:
  - vytvoření zprávy,
  - reakci srdcem,
  - smazání zprávy,
  - označení zprávy jako přečtené.
- Záměrně nebyl cacheovaný realtime message feed ani unread endpoint.
- Detailní poznámky jsou v `artifacts/superpowers/debug_phase6_api_response_cache.md`.

### Batch 14: Testing - server Vitest foundation

- Zmapovaný aktuální test setup:
  - root `test` script spouští `turbo run test`,
  - žádný workspace package zatím neměl vlastní `test` script,
  - nebyl nalezený existující Vitest/Jest/Playwright config ani test soubory.
- Do `apps/server` byl přidaný první úzký Vitest setup:
  - `vitest` dev dependency,
  - `test` script `vitest run`.
- Chat search cache key logika byla vytažená do čistého helperu:
  - `apps/server/src/utils/chat-search-cache.ts`,
  - route dál používá stejný Redis cache prefix a invalidation pattern.
- Přidaný první unit test:
  - `apps/server/src/utils/chat-search-cache.test.ts`,
  - ověřuje deterministické řazení participantů bez mutace vstupu,
  - oddělení cache klíče podle vieweru a query,
  - invalidation pattern prefix.
- Serverový `tsconfig` vylučuje `src/**/*.test.ts`, aby se testy nekompilovaly do produkčního `dist`.
- Detailní poznámky jsou v `artifacts/superpowers/debug_phase6_testing_server_vitest.md`.

### Batch 15: Testing - API integration, E2E and Chrome Extension

- Server testing byl rozšířený o API integration testy v `apps/server/src/routes/chat.integration.test.ts`:
  - Redis `HIT` path pro `GET /api/chat/messages/search`,
  - Redis `MISS` path včetně `setCachedJson(..., 30)`,
  - invalidace search cache pro DOM/SUB participanty po `POST /api/chat/messages`.
- Web má první Vitest unit test v `apps/web/src/lib/tasks/ids.test.ts`:
  - preferovaný `public_task_id`,
  - legacy fallback suffix,
  - výběr DB lookup sloupce podle UUID/public id formátu.
- Web má Playwright E2E smoke v `apps/web/e2e/login.spec.ts`:
  - render login formuláře,
  - odkaz na zapomenuté heslo,
  - client-side validace prázdných credentials před auth requestem.
- `apps/web/playwright.config.ts` startuje E2E proti produkčnímu `next start` na buildu a nastavuje testovací public Supabase env fallbacky.
- Chrome Extension má Vitest unit testy pro `event-buffer` a `sync-backoff`:
  - mock `chrome.storage.local`,
  - queue duplicate replacement,
  - batch cap 100 events,
  - removal jen pro přesně synchronizovaný payload,
  - retry backoff / clear flow.
- Root `pnpm test` přes Turbo teď pokrývá:
  - build dependency,
  - `server` Vitest unit + API integration,
  - `web` Vitest unit + Playwright E2E,
  - `chrome-extension` Vitest unit.
- Detailní poznámky jsou v `artifacts/superpowers/debug_phase6_testing_completion.md`.

## Ověření

- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web exec eslint 'src/lib/motion.ts' 'src/components/shared/EmptyState.tsx' 'src/components/shared/ToastProvider.tsx' 'src/components/shared/useToast.ts' 'src/app/layout.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/actions/tasks.ts' 'src/app/(dashboard)/tasks/new/page.tsx' 'src/components/tasks/TasksClient.tsx' 'src/components/tasks/TaskDetailContent.tsx' 'src/components/tasks/DomTaskControls.tsx' 'src/components/tasks/DOMApproval.tsx' 'src/components/tasks/TaskTextEvidence.tsx' 'src/components/tasks/TaskMediaGallery.tsx' 'src/components/tasks/TaskMediaUpload.tsx' 'src/components/tasks/TaskCommentsThread.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/actions/chat.ts' 'src/components/chat/ChatPageClient.tsx' 'src/components/chat/ChatPanel.tsx' 'src/components/chat/ChatComposer.tsx' 'src/components/chat/ChatMessageList.tsx' 'src/components/chat/ChatMessageBubble.tsx' 'src/components/chat/ChatHeader.tsx' 'src/components/chat/MediaPreview.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/actions/gallery.ts' 'src/app/(dashboard)/gallery/page.tsx' 'src/components/gallery/GalleryClient.tsx' 'src/components/gallery/GalleryMasonryGrid.tsx' 'src/components/gallery/GalleryMediaCard.tsx' 'src/components/gallery/GalleryUpload.tsx' 'src/components/gallery/GalleryBulkToolbar.tsx' 'src/components/gallery/GalleryLightbox.tsx' 'src/components/gallery/GalleryFilters.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/components/monitoring/MonitoringClient.tsx' 'src/actions/monitoring.ts'` -> prošlo.
- `pnpm --filter web exec eslint 'src/components/superadmin/SuperAdminClient.tsx' 'src/hooks/useSuperAdmin.ts'` -> prošlo.
- `pnpm --filter web exec eslint 'src/components/achievements/**/*.tsx' 'src/components/rewards/**/*.tsx' 'src/actions/gamification.ts' 'src/actions/rewards.ts' 'src/app/(dashboard)/achievements/page.tsx' 'src/app/(dashboard)/rewards/page.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/components/wishes/**/*.tsx' 'src/actions/wishes.ts' 'src/app/(dashboard)/wishes/page.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/components/gallery/GalleryMediaCard.tsx' 'src/components/tasks/TaskMediaGallery.tsx' 'src/components/wishes/WishMediaStrip.tsx'` -> prošlo.
- `pnpm --filter web exec eslint 'src/actions/gallery.ts' 'src/lib/gallery/processing.ts'` -> prošlo.
- `pnpm --filter web build` -> prošlo.
- `pnpm --filter web build` -> prošlo bez Turbopack/NFT warningu.
- Gallery NFT trace smoke -> `total: 268`, `src: 17`, `ffmpeg: 9`, `sharp: 32`, `nextConfig: false`.
- `pnpm --filter web exec eslint 'src/components/tasks/TaskMediaLightbox.tsx' 'src/components/tasks/TaskVideoPlayer.tsx'` -> prošlo.
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web build` -> prošlo.
- `pnpm --filter web exec next experimental-analyze --output` -> prošlo, výstup je v `apps/web/.next/diagnostics/analyze`.
- Bundle smoke:
  - `rg -l 'videojs|Video\\.js|video\\.js' apps/web/.next/static/chunks` -> pouze `apps/web/.next/static/chunks/0jat999ze~i6y.js`,
  - `rg -l 'videojs|Video\\.js|video\\.js' apps/web/.next/server/app apps/web/.next/server/chunks` -> žádný výskyt,
  - task `react-loadable-manifest.json` -> lazy `static/chunks/0jat999ze~i6y.js` + `static/chunks/0pcu84lvjbdmb.css`.
- `pnpm exec supabase db query --linked "select 1 as ok;"` -> prošlo.
- `pnpm exec supabase db query --linked "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ..."` -> prošlo pro task feed, profile lookup a task media lookup.
- `pnpm exec supabase db query --linked "BEGIN; CREATE INDEX ...; ROLLBACK;"` -> prošlo pro nové Phase 6 indexy.
- `pnpm exec supabase db push --dry-run --yes` -> prošlo, ale ukázalo starší pending migrace vedle nové index migrace.
- `pnpm exec supabase migration repair 20260430200000 20260501093000 20260501103000 20260501190000 20260501203000 20260501220000 20260502150007 20260503120000 20260503143000 20260503152000 20260503165000 20260503173000 --status applied --linked --yes` -> prošlo.
- `pnpm exec supabase db push --yes` -> aplikovalo `20260504190522_phase6_query_indexes.sql`.
- `pnpm exec supabase db push --dry-run --yes` -> `Remote database is up to date.`
- `pnpm exec supabase db query --linked "select indexname ..."` -> potvrdilo nové Phase 6 indexy.
- `pnpm --filter server build` -> prošlo.
- `pnpm --filter server test` -> prošlo, 1 test file / 3 testy.
- `pnpm --filter server build` -> prošlo po přidání Vitest foundation.
- `pnpm --filter server test` -> prošlo, 2 test files / 6 testů.
- `pnpm --filter web test:unit` -> prošlo, 1 test file / 3 testy.
- `pnpm --filter chrome-extension test` -> prošlo, 2 test files / 5 testů.
- `pnpm --filter web exec playwright install chromium` -> stáhlo lokální Chromium runtime pro Playwright.
- `pnpm --filter web test:e2e` -> prošlo, 2 Playwright testy.
- `pnpm test` -> prošlo, Turbo 7/7 tasks successful.
- `git diff --check -- supabase/migrations/20260504190522_phase6_query_indexes.sql` -> prošlo.
- `git diff --check -- <upravené soubory>` -> prošlo.

## Poznámky

- Poslední build už neukázal dřívější workspace-root warning kvůli lockfilu `/Users/mai/package-lock.json`.
- Turbopack/NFT warning přes `gallery/processing.ts` je opravený.
- Page-by-page UI polish z aktuálního Phase 6 pořadí je dokončený.
- Performance image slice, Gallery NFT warning fix, první bundle/code-splitting pass, DB index pass a první API response cache slice jsou dokončené.
- Testing slice je dotažený do praktického Phase 6 základu: unit, API integration, E2E smoke i Chrome Extension unit testy běží přes root `pnpm test`.
- Turbo po root `pnpm test` jednou vypsal warning `Invalid file path` pro Next `.next/static/...` symlink, ale command skončil `0` a všechny tasky byly successful.
- Další krok v Phase 6 plánu je Deployment / deploy readiness.
