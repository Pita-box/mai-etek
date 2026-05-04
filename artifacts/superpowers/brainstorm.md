# Brainstorm: Phase 6 - Polish & Deploy

## Cíl

Dovést aplikaci z funkčního stavu do produkčně použitelného stavu podle `docs/ARCHITECTURE.md`:

- sjednocené empty states,
- toast notifikace pro akce,
- citlivé a střídmé animace,
- accessibility audit,
- performance průchod,
- základ testů,
- deploy checklist a produkční provoz.

Phase 5 je přeskočená produktovým rozhodnutím, takže Phase 6 pokračuje přímo po dokončeném Phase 4 monitoring scope.

## Aktuální stav

Hotové v Phase 6:

- Dark mode je výchozí.
- Loading skeletons jsou doplněné pro dashboard/auth routy a shell.
- Error boundaries + root `not-found` jsou doplněné.

Chybí:

- Empty states.
- Toast notifications.
- Animations.
- Accessibility audit.
- Performance.
- Testing.
- Deployment příprava.

## Zjištění z codebase

- Existuje `apps/web/src/components/ui/skeleton.tsx`.
- Toast knihovna zatím není v `apps/web/package.json`.
- Framer Motion zatím není v `apps/web/package.json`, i když je v architektuře uvedený jako plán.
- Playwright je v lockfile, ale ne v `apps/web/package.json` jako běžný script pro web.
- UI používá shadcn/base-ui styl, glassmorphism, tmavý vzhled a crimson accent.
- Page-specific design docs existují jen pro:
  - `design-system/pages/chat.md`
  - `design-system/pages/achievements.md`

## Doporučené pořadí

1. Empty states
   - Vytvořit sdílenou komponentu `EmptyState`.
   - Nahradit ručně psané prázdné stavy na klíčových stránkách.
   - Začít dashboard oblastmi, kde jsou seznamy: Chat, Tasks, Wishes, Gallery, Monitoring, Rewards, Achievements, Superadmin.

2. Toast notifications
   - Vybrat knihovnu nebo použít vlastní minimalistický toast store.
   - Napojit na úspěšné/chybové akce:
     - uploady,
     - smazání,
     - ukládání nastavení,
     - task submit/approve/reject,
     - wishes status,
     - monitoring delete/revoke/pairing.

3. Animations
   - Nejdřív mikrointerakce bez těžké animační knihovny, pokud stačí CSS/Tailwind.
   - Framer Motion přidat jen pokud opravdu potřebujeme layout transitions.
   - Respektovat `prefers-reduced-motion`.

4. Accessibility audit
   - Focus states.
   - Dialog/sheet keyboard behavior.
   - Icon-only buttons mají `aria-label`.
   - Form labels.
   - Kontrast.
   - Mobile navigation.

5. Performance
   - Images: používat lazy loading/proxy thumbnaily.
   - Heavy stránky rozdělit dynamic importy, kde dávají smysl.
   - Bundle check.
   - Query performance pro monitoring/gallery/chat.

6. Testing
   - Nejpraktičtější začít Playwright smoke testy:
     - login,
     - dashboard navigation,
     - chat page load,
     - tasks page load,
     - gallery page load,
     - monitoring DOM-only guard.
   - Unit testy doplnit až pro izolovanou business logiku.

7. Deployment
   - Rozhodnout platformu.
   - Nastavit env vars.
   - Cron jobs.
   - Google Drive service account.
   - Telegram bot.
   - Backup a health checks.

## Rizika

- Pokud se začne deployem před polish/test smoke, produkční chyby budou drahé na ladění.
- Toasty mohou snadno zdvojit existující inline message stavy; je potřeba sjednotit pattern.
- Framer Motion může přidat zbytečnou váhu, pokud půjde jen o drobné hover/fade efekty.
- Empty states nesmí působit jako landing/marketing bloky; aplikace je operational dashboard.
- Phase 6 deployment závisí na hostingu, který ještě není jasně potvrzený.

## Acceptance criteria pro Phase 6 plán

- Každá prázdná datová sekce má konzistentní empty state.
- Mutace ukazují toast úspěchu/chyby a neopírají se jen o `alert`.
- Error/loading/empty UI drží stejný vizuální jazyk.
- Základní accessibility audit má konkrétní checklist a opravy.
- Existuje základní smoke test sada nebo jasná ruční verifikace.
- Deploy postup má konkrétní cílové prostředí, env checklist, cron checklist a rollback/backup poznámku.

## Otevřené otázky pro DOM

1. Phase 6 chceš dělat jako produkční přípravu na reálný deploy, nebo zatím jen polish v lokálním/dev režimu? **Rozhodnuto: reálný deploy.**
2. Kde plánuješ deployovat web a server: Vercel + samostatný server pro Express, VPS/Docker, nebo jiné řešení? **Rozhodnuto: nyní Vercel, časem VPS (OVH).**
3. Empty states mají být čistě utilitární textové panely, nebo mohou mít jemnou ikonografii a krátkou větu s akcí? **Rozhodnuto: jemná ikonografie + krátká akční věta.**
4. Toasty chceš používat pro všechny akce, nebo jen pro mutace, které dnes nemají žádnou viditelnou zpětnou vazbu? **Rozhodnuto: všude pro mutace.**
5. Toast pozice: pravý horní roh na desktopu a dole na mobilu, nebo vždy dole? **Rozhodnuto: vždy dole uprostřed.**
6. Animace chceš minimalistické CSS-only, nebo povolit Framer Motion? **Rozhodnuto: Framer Motion.**
7. Chceš v Phase 6 nejdřív udělat UI polish napříč celou aplikací, nebo jít stránku po stránce podle důležitosti? **Rozhodnuto: stránku po stránce.**
8. Které stránky jsou pro polish priorita? **Rozhodnuto: Tasks, Chat, Gallery, Monitoring, Superadmin, Achievements/Rewards, Wishes.**
9. Testy: chceš začít Playwright E2E smoke testy, nebo unit testy pro business logiku? **Rozhodnuto: unit testy pro business logiku.**
10. Má být Chrome extension součástí Phase 6 test/deploy checklistu hned, nebo později samostatně? **Rozhodnuto: později samostatně.**
11. Pro deploy chceš hned řešit HTTPS/doménu, nebo nejdřív staging URL? **Rozhodnuto: subdoména `maietek.maiweb.zip`.**
12. Zůstává cílové persistentní úložiště všude Google Drive a MinIO už nemá být v deploy checklistu? **Rozhodnuto: persistentní úložiště pouze Google Drive.**

## Rozhodnutí pro plán

- Phase 6 je produkční příprava na reálný deploy, ne jen lokální polish.
- První cílový hosting je Vercel; budoucí cílová varianta je VPS na OVH.
- Doména/subdoména: `maietek.maiweb.zip`.
- Persistentní média a monitoring soubory: pouze Google Drive.
- UI polish půjde stránku po stránce v pořadí:
  1. Tasks
  2. Chat
  3. Gallery
  4. Monitoring
  5. Superadmin
  6. Achievements/Rewards
  7. Wishes
- Empty states: jemná ikonografie + krátká akční věta.
- Toast notifications: všude pro mutace, pozice vždy dole uprostřed.
- Animace: povolit Framer Motion, ale používat střídmě a respektovat `prefers-reduced-motion`.
- Testy: začít unit testy pro business logiku.
- Chrome extension test/deploy checklist bude samostatný pozdější krok.

## Doporučení

Aktualizované doporučení po rozhodnutích:

1. Vytvořit Phase 6 plán ve dvou proudech:
   - UI polish po stránkách.
   - Deploy readiness pro Vercel.
2. Nejdřív zavést sdílené základy:
   - `EmptyState`,
   - toast systém dole uprostřed,
   - Framer Motion provider/pattern,
   - unit test setup.
3. Potom polishovat stránky v dohodnutém pořadí.
4. Současně připravit deploy checklist pro Vercel a subdoménu `maietek.maiweb.zip`.
5. Před samotným deployem ověřit aktuální Vercel limity a podporu pro cron/server runtime podle oficiální dokumentace.

## Doplňující otázky před plánem

1. Kam půjde `apps/server` s Express + Socket.IO při první Vercel verzi?
   - Vercel samotný je ideální pro Next web, ale současný chat používá dloužící Socket.IO server.
   - Potřebujeme rozhodnout, zda Express server poběží dočasně na jiné službě, nebo ho budeme před deployem migrovat.
   - **Odpověď DOM: zatím nevím.**
2. Použijeme současný Supabase projekt i pro produkci, nebo vytvoříme nový produkční Supabase projekt?
   - **Rozhodnuto: použít současný Supabase projekt.**
3. Chceš před deployem rotovat všechny klíče, které se objevily v `.env` během vývoje?
   - **Rozhodnuto: ano, před deployem rotovat klíče.**
4. Resend e-mail: bude `EMAIL_FROM` na ověřené vlastní doméně, nebo zatím zůstane testovací `onboarding@resend.dev`?
   - **Rozhodnuto: zatím může zůstat `onboarding@resend.dev`; DOM to ručně změní později.**
5. Má být první Vercel deploy produkční ostrý, nebo nejdřív preview/staging na stejné subdoméně až po kontrole?
   - **Rozhodnuto: rovnou ostrý deploy na `maietek.maiweb.zip`.**

## Otevřené rozhodnutí: Express + Socket.IO server

`apps/web` může běžet na Vercelu, ale `apps/server` dnes drží Express routes a Socket.IO pro Chat. Pro první produkční deploy je potřeba vybrat jednu z cest:

1. **Samostatný Node hosting pro `apps/server`**
   - Web běží na Vercelu.
   - Express/Socket.IO běží na službě typu Railway/Render/Fly.io nebo dočasný VPS.
   - `NEXT_PUBLIC_API_URL` ve Vercelu ukazuje na tento server.
   - Nejmenší zásah do kódu.

2. **Dočasný malý VPS už teď**
   - Web může běžet na Vercelu, server na VPS.
   - Pozdější migrace na OVH bude přímočařejší.
   - Vyžaduje více deploy/infrastruktury hned.

3. **Migrace z Express/Socket.IO do Vercel-friendly architektury**
   - REST přes Next API routes/server actions.
   - Realtime chat přes Supabase Realtime nebo jinou managed realtime službu.
   - Větší zásah do kódu před deployem.

Pracovní doporučení pro plán: pro první ostrý deploy zvolit variantu 1, pokud DOM nechce hned řešit VPS.

## Vercel + Socket.IO zjištění

Ověřeno podle aktuálních Vercel dokumentů:

- Vercel Functions neumí fungovat jako WebSocket server.
- Fluid Compute zlepšuje serverless runtime/concurrency, ale neřeší vlastní persistentní Socket.IO server.
- Vercel Services existují jako Private Beta pro více backendů v jednom projektu, ale není to bezpečný základ pro náš první produkční deploy.

Praktické možnosti:

1. **Nechat Socket.IO a dát `apps/server` mimo Vercel**
   - Nejmenší zásah do kódu.
   - Web na Vercelu, API/Socket.IO na samostatném Node hostingu.
   - Vercel env: `NEXT_PUBLIC_API_URL=https://api...`.

2. **Přepsat realtime chat na managed realtime službu**
   - Například Supabase Realtime, Ably/Pusher, nebo jiná služba.
   - Web může zůstat čistě na Vercelu.
   - Větší zásah do chatu, presence, typing, read events a badges.

3. **Azure Web PubSub for Socket.IO Serverless Mode**
   - Teoreticky umožňuje Socket.IO-like provoz v serverless modelu přes managed službu.
   - Znamená vendor-specific integraci a refactor serverové Socket.IO vrstvy.

4. **Počkat na / žádat Vercel Services**
   - Služba je v Private Beta.
   - Nevhodné jako jistý produkční plán bez ověřeného přístupu a WebSocket podpory.

Závěr pro plán: pokud chceme deploy brzy a bez velkého přepisování chatu, nejbezpečnější je Vercel pro web + samostatný Node hosting pro `apps/server`.

## OVH VPS varianta

DOM má k dispozici VPS od OVH. Tím se dá vyřešit Socket.IO i celý deploy jednodušeji:

- `apps/web` běží jako Next server na VPS.
- `apps/server` běží jako Express + Socket.IO server na stejném VPS.
- Nginx dělá reverse proxy:
  - `https://maietek.maiweb.zip` -> Next web,
  - `https://maietek.maiweb.zip/api` nebo `https://api.maietek.maiweb.zip` -> Express API,
  - Socket.IO upgrade requesty -> Express Socket.IO server.
- SSL řeší Let's Encrypt.
- PM2 nebo Docker Compose drží procesy běžící po restartu.
- Cron jobs mohou běžet buď přes systémový cron, nebo voláním Next cron endpointů.

Výhody:

- Jeden hosting/runtime pro web i server.
- Socket.IO funguje bez refactoru.
- Jednodušší debug produkce.
- Přirozený mezikrok k finálnímu OVH cíli.

Nevýhody:

- Odpovědnost za server maintenance, security updates, firewall, backup a monitoring.
- Vercel automatické preview/deploy workflow nebude primární.

Poznámka: `Supabase` a `Google Drive` zůstávají externí služby podle aktuálních rozhodnutí. Pokud by DOM chtěl opravdu úplně vše na jednom VPS, znamenalo by to samostatnou pozdější migraci ze Supabase cloudu na self-hosted Supabase/PostgreSQL a z Google Drive na jiné úložiště. To nyní není doporučené, protože rozhodnutí je používat současný Supabase projekt a Google Drive only.

Aktualizované doporučení: pro první ostrý deploy použít OVH VPS jako hlavní runtime pro `apps/web` i `apps/server`, ne Vercel. Vercel může zůstat jako budoucí alternativa pouze pro web, pokud se realtime vrstva někdy přepíše na managed realtime službu.
