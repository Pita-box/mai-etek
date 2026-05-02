# Plan: Automatické stránky a SUB page access v SuperAdmin

## Goal
Zavést jeden centrální systém pro dostupnost dashboard stránek pro SUB. DOM v SuperAdmin uvidí automaticky nalezené stránky jako štítky a může je přepnout mezi `Povoleno` a `Nepovoleno`. Navigace i zobrazení stránky se budou řídit stejným nastavením, takže nové budoucí stránky nebude nutné ručně dopisovat do navigace ani SuperAdmin page access UI.

## Assumptions
- `/superadmin` zůstane vždy DOM-only a nebude možné ho SUBovi odemknout.
- Top-level permission platí i pro child routes, např. `/tasks` řídí `/tasks`, `/tasks/[id]`, `/tasks/new`.
- Nové dashboard stránky jsou defaultně povolené pro SUB, dokud je DOM nevypne.
- Citlivá data dál chrání RLS/server actions; tento plán řeší viditelnost stránky a navigaci, ne nahrazení databázového zabezpečení.

## Plan
1. Zavést shared typy a normalizaci app_config
   - Files: `apps/web/src/types/page-access.ts`, případně `apps/web/src/lib/page-access/config.ts`.
   - Nový tvar configu: `app_config.page_access[pageKey] = { enabled: boolean }`.
   - Zachovat kompatibilitu se starým `app_config.modules`, pokud existuje.
   - Verify: unit-like runtime helper test přes `tsc` a pár ručních případů v kódu.

2. Přidat automatický dashboard page registry
   - Files: `apps/web/src/lib/page-access/dashboard-pages.ts`.
   - Server-side helper projde `apps/web/src/app/(dashboard)` a najde top-level dashboard pages.
   - Z child routes vytvoří parent permission key (`tasks/[id]` -> `tasks`).
   - Fallback metadata pro známé stránky: český label, href, icon key, pořadí.
   - Neznámá nová stránka dostane fallback label z route segmentu a default icon.
   - `/superadmin` bude `systemOnly` a neprojde do SUB navigace.
   - Verify: helper vrací aktuální stránky: dashboard, tasks, chat, gallery, wishes, rewards, achievements, punishments, settings; monitoring se objeví automaticky až po vytvoření route.

3. Upravit Dashboard layout na centrální permission evaluation
   - Files: `apps/web/src/app/(dashboard)/layout.tsx` a případně nový client shell component.
   - Layout načte profile + page registry + vypočtené povolené stránky.
   - Pro SUB ověří aktuální pathname proti page access mapě.
   - Pokud není povoleno, místo page content zobrazí glass panel s textem `K této stránce nemáš přístup.`
   - DOM vidí vše kromě běžných RLS omezení.
   - Verify: SUB s vypnutou stránkou nevidí content ani při přímé URL.

4. Upravit Navigation na registry-driven položky
   - Files: `apps/web/src/components/shared/Navigation.tsx`.
   - Odstranit ruční `allNavItems` jako zdroj pravdy.
   - Navigation dostane list povolených page items z layoutu.
   - Badge mapping zůstane pro známé page keys (`tasks`, `chat`, `gallery`, `wishes`, `rewards`, `achievements`), neznámé stránky mají count 0.
   - Verify: SUB navigace ukáže jen povolené pages; DOM navigace ukáže DOM stránky včetně Superadmin.

5. Přestavět SuperAdmin page access UI na štítky
   - Files: `apps/web/src/app/(dashboard)/superadmin/page.tsx`.
   - Nahradit checkboxy `Chat / Úkoly / Galerie` za automatický seznam page chips.
   - Povolené chips: primary button.
   - Nepovolené chips: destructive button.
   - Každý chip má ikonu, název a stav `Povoleno`/`Nepovoleno`.
   - Při kliknutí update `app_config.page_access` přes stávající `useUpdateAppConfig`.
   - Verify: DOM přepne libovolnou page a po refreshi stav zůstane.

6. Upravit server route pro app_config update jen minimálně
   - Files: `apps/server/src/routes/superadmin.ts`, případně bez změny pokud endpoint už akceptuje celý `app_config`.
   - Endpoint dnes ukládá celý JSON; stačí posílat nový tvar a nemazat ostatní config.
   - Verify: PATCH uloží `page_access` a zachová ostatní klíče.

7. Aktualizovat dokumentaci a artifact
   - Files: `docs/ARCHITECTURE.md`, `artifacts/superpowers/finish.md`.
   - Zapsat, že page access je registry-driven, default allow, DOM configurable, Superadmin system-only.
   - Verify: `git diff --check`.

8. Kompletní ověření
   - `pnpm --filter web exec tsc --noEmit`
   - Targeted ESLint pro upravené soubory
   - `pnpm --filter web build`
   - Manual smoke:
     - DOM vidí page chips v SuperAdmin.
     - DOM vypne `Galerie` pro SUB.
     - SUB po refreshi nevidí `Galerie` v navigaci.
     - SUB otevře `/gallery` přímo a vidí `K této stránce nemáš přístup.`
     - DOM znovu povolí `Galerie` a SUB ji opět vidí.

## Risks & mitigations
- Runtime filesystem discovery v Next buildu nemusí být dostupné ve všech deployment modech.
  - Mitigation: self-hosted projekt + fallback známých routes, build ověření.
- Starý `app_config.modules` může být nekonzistentní.
  - Mitigation: normalizace přečte starý tvar, ale nový zápis už používá `page_access`.
- Nové citlivé stránky budou default allowed.
  - Mitigation: `/superadmin` je system-only; pro jiné citlivé stránky lze při vytvoření route rovnou v SuperAdmin vypnout bez úprav navigace/SuperAdmin UI.
