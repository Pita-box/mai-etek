# Debug: Phase 6 DB Query Indexes

## Kontext

Další Performance krok po bundle splitu byl `Database query optimization (EXPLAIN ANALYZE)`.

Redis cache v `apps/web` zatím nemá hotovou runtime infrastrukturu. Redis je v architektuře a v `apps/server`, ale web app nemá sdílený cache klient ani jasný invalidation model pro server actions. Proto byl bezpečnější další krok DB query pass.

## Měřené dotazy

Read-only Supabase CLI spojení funguje:

- `pnpm exec supabase db query --linked "select 1 as ok;"` -> prošlo.

Spuštěné `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` dotazy:

- task feed: `SELECT * FROM public.tasks ORDER BY created_at DESC;`
- DOM SUB lookup: `profiles WHERE dom_id = ... AND role = 'sub' ORDER BY full_name`
- task media batch: `task_media WHERE task_id IN (...) ORDER BY created_at DESC`

Aktuální remote dataset je malý, takže planner u některých dotazů správně volí `Seq Scan`:

- `tasks`: cca 10 řádků, `Seq Scan + Sort`, execution cca `2.653 ms`.
- `profiles`: cca 2 řádky, `Seq Scan + Sort`, execution cca `0.162 ms`.
- `task_media`: cca 5 řádků, `Seq Scan + Sort`, execution cca `0.178 ms`.

To není aktuální runtime problém, ale jsou to budoucí hot-path dotazy, které porostou s běžným používáním aplikace.

## Přidaná migrace

`supabase/migrations/20260504190522_phase6_query_indexes.sql`

Přidává:

- `profiles_dom_full_name_idx`
  - pro DOM -> SUB lookupy v Monitoring, Wishes, Punishments, Chat participant discovery a create-task fallback.
- `tasks_created_at_idx`
  - pro task feed `ORDER BY created_at DESC`.
- `task_media_task_created_idx`
  - pro task detail/list media lookupy podle `task_id` řazené podle `created_at`.
- `task_comments_active_task_tab_created_idx`
  - pro `getTaskComments(taskId, tabType)`, které filtruje `deleted_at IS NULL` a řadí podle `created_at`.

## Ověření

- `pnpm exec supabase db query --linked "BEGIN; ... CREATE INDEX ...; ROLLBACK;"` -> prošlo.
- `pnpm exec supabase db push --dry-run --yes` -> syntakticky doběhlo, ale ukázalo víc starších pending migrací, nejen novou Phase 6 migraci.
- `pnpm exec supabase migration repair ... --status applied --linked --yes` -> označilo 12 už-fakticky-aplikovaných migrací jako aplikované v remote migration history.
- `pnpm exec supabase db push --yes` -> aplikovalo už jen `20260504190522_phase6_query_indexes.sql`.
- `pnpm exec supabase db push --dry-run --yes` -> `Remote database is up to date.`
- Kontrolní dotaz na `pg_indexes` potvrdil:
  - `profiles_dom_full_name_idx`,
  - `tasks_created_at_idx`,
  - `task_media_task_created_idx`,
  - `task_comments_active_task_tab_created_idx`.
- `git diff --check -- supabase/migrations/20260504190522_phase6_query_indexes.sql` -> prošlo.

## Poznámka k remote historii

Před aplikací index migrace `db push --dry-run` kromě nové migrace ukazoval i starší lokální migrace:

- `20260430200000_wishes.sql`,
- několik Phase 4/5/6 migrací,
- a teprve potom `20260504190522_phase6_query_indexes.sql`.

Kontrolní dotazy potvrdily, že objekty/sloupce/indexy/funkce/policies z těchto starších migrací na remote existují. Opravená byla tedy pouze migration metadata, ne aplikační schéma. Po repair šla bezpečně pushnout samotná Phase 6 index migrace.
