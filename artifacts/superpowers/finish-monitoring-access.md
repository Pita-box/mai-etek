# Finish: Monitoring DOM-only access documentation

## Hotovo
- `docs/ARCHITECTURE.md` zaznamenává, že SUB nemá přístup k Monitoring dashboardu.
- V roli SUB je doplněno `no access to Monitoring dashboard`.
- Phase 4 `Web App - Monitoring Dashboard (DOM)` obsahuje aktuální stav:
  - Monitoring je DOM-only v navigaci.
  - SUB nevidí `/monitoring` položku.
  - Server-side DOM-only route guard je označený jako budoucí krok při implementaci stránky.

## Ověření
- `git diff --check -- docs/ARCHITECTURE.md` prošlo.

## Review
- Blocker: žádný.
- Major: žádný.
- Minor: Monitoring stránka zatím neexistuje, takže dokumentace správně ponechává route guard jako budoucí položku.
