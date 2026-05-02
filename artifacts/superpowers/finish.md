# Finish: Automatická správa SUB přístupu ke stránkám

## Hotovo
- Přidán centrální page access model:
  - `apps/web/src/types/page-access.ts`
  - `apps/web/src/lib/page-access/config.ts`
  - `apps/web/src/lib/page-access/dashboard-pages.ts`
- Dashboard stránky se zjišťují z `apps/web/src/app/(dashboard)` a normalizují do registry s českými labely, ikonami, pořadím a default stavem.
- Nový config tvar je `profiles.app_config.page_access[pageKey].enabled`.
- Starý `profiles.app_config.modules` se čte jako fallback kvůli kompatibilitě.
- Nové neznámé dashboard stránky jsou defaultně povolené pro SUB.
- Citlivé známé stránky mají metadata:
  - `punishments` defaultně nepovoleno, ale DOM může odemknout.
  - `monitoring` defaultně nepovoleno, až route vznikne.
  - `superadmin` je `systemOnly` a zůstává DOM-only.
- Dashboard layout je nově server wrapper + client shell:
  - `apps/web/src/app/(dashboard)/layout.tsx`
  - `apps/web/src/components/shared/DashboardShell.tsx`
- SUB při přímém otevření nepovolené stránky uvidí hlášku `K této stránce nemáš přístup.` přes `PageAccessDenied`.
- `Navigation.tsx` už nemá ruční `allNavItems`; renderuje stránky z registry a zobrazuje jen povolené stránky pro SUB.
- SuperAdmin stránka má nový chips UI:
  - povolené stránky jako primary chip/button s textem `Povoleno`,
  - nepovolené stránky jako destructive chip/button s textem `Nepovoleno`,
  - seznam stránek se generuje automaticky z registry.
- `docs/ARCHITECTURE.md` zaznamenává registry-driven SuperAdmin page access.

## Ověření
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web exec eslint src/types/page-access.ts src/lib/page-access/config.ts src/lib/page-access/dashboard-pages.ts src/components/shared/DashboardShell.tsx src/components/shared/Navigation.tsx src/components/shared/PageAccessDenied.tsx src/components/superadmin/SuperAdminClient.tsx src/app/\(dashboard\)/layout.tsx src/app/\(dashboard\)/superadmin/page.tsx` -> prošlo.
- `git diff --check -- <upravené soubory>` -> prošlo.
- `pnpm --filter web build` -> prošlo.
- Build route list potvrdil aktuální dashboard pages: `/dashboard`, `/tasks`, `/chat`, `/gallery`, `/punishments`, `/rewards`, `/settings`, `/superadmin`, `/wishes`, `/achievements`.

## Známé warningy
- Build dál ukazuje existující Next/Turbopack workspace-root warning kvůli lockfile mimo repo.
- Build dál ukazuje existující Gallery processing NFT trace warning z `src/lib/gallery/processing.ts`; není způsobený page access změnou.

## Review
- Blocker: žádný.
- Major: žádný po typechecku, cíleném ESLintu a buildu.
- Minor: Access denied kontrola je client-shell guard; datovou bezpečnost musí dál držet RLS/server actions.
- Nit: `/monitoring` se v auto seznamu objeví až ve chvíli, kdy vznikne skutečná dashboard route.
