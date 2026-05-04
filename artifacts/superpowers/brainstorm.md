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
2. Použijeme současný Supabase projekt i pro produkci, nebo vytvoříme nový produkční Supabase projekt?
3. Chceš před deployem rotovat všechny klíče, které se objevily v `.env` během vývoje?
4. Resend e-mail: bude `EMAIL_FROM` na ověřené vlastní doméně, nebo zatím zůstane testovací `onboarding@resend.dev`?
5. Má být první Vercel deploy produkční ostrý, nebo nejdřív preview/staging na stejné subdoméně až po kontrole?
