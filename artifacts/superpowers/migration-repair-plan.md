# Plan: repair remote Supabase migration history for maietek

## Goal
Apply the task workflow migration that creates `task_comments` and related tables on the remote Supabase project `maietek` without breaking the existing schema.

## Brainstorm
- Remote DB already contains at least `public.profiles`, so the earliest baseline migration cannot be replayed safely.
- The failure indicates migration history and actual schema are out of sync.
- The safest path is usually to mark already-existing baseline migrations as `applied`, then push only the new additive migrations.
- Risk: if we mark a migration as applied but the remote schema is missing parts of it, later migrations may fail or app behavior may drift.

## Constraints
- Remote production-like database; avoid destructive changes.
- Do not leak secrets.
- Prefer additive operations and migration-history repair over manual destructive edits.

## Proposed steps
1. Inspect the baseline migration files and identify which ones are historical/base schema migrations.
2. Repair Supabase migration history for the already-present baseline migration(s), starting with:
   - `20240424000000_init_schema.sql`
3. Retry `npx supabase db push`.
4. If the next historical migration also conflicts because schema already exists, repair that one too and retry.
5. Stop once the additive task workflow migration (`20260426033700_tasks_workflow_tables.sql`) applies cleanly.
6. Verify by testing the comment flow in the app.

## Likely commands
```bash
npx supabase migration repair --status applied 20240424000000
npx supabase db push
```
If another already-existing baseline migration conflicts next, repeat with that version only after reviewing the error.

## Acceptance criteria
- `npx supabase db push` finishes successfully.
- Remote DB contains `public.task_comments`.
- App no longer shows the missing-migration comment warning.

## Verification
- `npx supabase db push`
- In app: add a task comment successfully.

## Review (pre-execution)
- Blocker: We do not yet know how many historical migrations must be marked as applied.
- Major: Repairing the wrong migration version could hide missing schema.
- Minor: README currently contains pasted CLI output and should be cleaned later.
- Nit: none.


## Observed follow-up conflict
- `20240424000000` was repaired as applied successfully.
- Next `db push` failed on `20260424135357_init_schema.sql` because `profiles` policies already exist.

## Recommended next step
Mark `20260424135357` as applied too, then retry `db push`.

Commands:
```bash
npx supabase migration repair --status applied 20260424135357
npx supabase db push
```

If the next failure is another already-existing baseline object from `20260424185000_superpowers_schema.sql`, repeat the same targeted repair process for that version only.


## Observed follow-up conflict: superpowers schema
- `20260424135357` was repaired as applied successfully.
- Next `db push` failed on `20260424185000_superpowers_schema.sql` because `profiles.dom_id` already exists.

## Recommended next step
Mark `20260424185000` as applied too, then retry `db push`.

Commands:
```bash
npx supabase migration repair --status applied 20260424185000
npx supabase db push
```

Expected remaining migrations after this repair:
- `20260426033600_tasks_public_task_id.sql`
- `20260426033700_tasks_workflow_tables.sql`

These are task-specific additive migrations and should be the ones we actually need for comments/media/view tracking.


## New root cause: enum mismatch on `task_status`
- The remaining failure is not migration history.
- Remote `public.tasks.status` uses Postgres enum `task_status`, not a text column with a check constraint.
- Existing enum values in the repo baseline are:
  - `pending`, `in_progress`, `submitted`, `approved`, `rejected`, `failed`, `expired`
- The workflow migration needs additional values:
  - `in_review`, `revision_requested`, `completed`, `cancelled`

## Safe repair approach
Before retrying `db push`, extend the remote enum with the missing values, then rerun `db push`.

Suggested SQL:
```sql
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'in_review';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'revision_requested';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'completed';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'cancelled';
```

Then retry:
```bash
npx supabase db push
```

## Note
Depending on how the migration was authored, the `tasks_status_check` block may become redundant once enum values are extended, but the immediate blocker is the enum itself.
