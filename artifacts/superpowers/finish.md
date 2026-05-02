# Finish: Oprava mobilního header navigation

## Hotovo
- Opraven dashboard shell layout v `apps/web/src/components/shared/DashboardShell.tsx`.
- Mobilní dashboard už používá sloupcový layout (`flex-col`) místo řádkového layoutu.
- Desktop zůstává řádkový přes `md:flex-row`.
- Root výška na mobilu používá `h-svh`, aby se lépe chovala s mobilním browser viewportem.
- Content wrapper a `<main>` mají `min-h-0`, takže scroll zůstává uvnitř hlavního obsahu a mobilní header nemá vytlačit/nepřekrýt celou stránku.

## Ověření
- `pnpm --filter web exec tsc --noEmit` -> prošlo.
- `pnpm --filter web exec eslint src/components/shared/DashboardShell.tsx` -> prošlo.
- `git diff --check -- apps/web/src/components/shared/DashboardShell.tsx` -> prošlo.
- `pnpm --filter web build` -> prošlo.

## Známé warningy
- Build dál ukazuje existující Next/Turbopack workspace-root warning kvůli lockfile mimo repo.
- Build dál ukazuje existující Gallery processing NFT trace warning z `src/lib/gallery/processing.ts`; není způsobený touto změnou.

## Review
- Blocker: žádný.
- Major: žádný po typechecku, cíleném ESLintu a buildu.
- Minor: neproběhl reálný mobilní Playwright screenshot; ověřeno staticky a buildem.
- Nit: žádný.
