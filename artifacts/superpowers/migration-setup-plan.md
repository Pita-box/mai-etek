# Setup plan: task comments database migration

## Goal
Enable task comments by applying the prepared Supabase migration that creates `public.task_comments` and related workflow tables.

## Constraints
- Do not mutate the database until the user approves the setup execution.
- Avoid leaking secrets from `.env` or Supabase config.
- Prefer Supabase CLI migration commands over manual SQL where possible.

## Plan
1. Verify project scripts and Supabase CLI/link state.
2. Confirm the migration containing `task_comments` is present.
3. Choose the correct migration command:
   - remote linked project: `supabase db push`
   - local project: local Supabase migration flow
4. Apply migration only after explicit approval.
5. Verify `task_comments` exists and app comments work.

## Current finding
- `supabase/migrations/20260426033700_tasks_workflow_tables.sql` contains `CREATE TABLE IF NOT EXISTS public.task_comments`.

## Awaiting user approval
Ask user before running any DB-mutating migration command.


## Remote setup check

Commands run:
- `npx supabase --version && npx supabase status`
- `npx supabase projects list`

Findings:
- Supabase CLI version: `2.95.1`.
- `supabase status` attempted local Docker inspection and failed because Docker is not running; this is expected/not needed for remote DB.
- `npx supabase projects list` failed because CLI is not authenticated: `Access token not provided`.

Next safe options:
1. Run `npx supabase login`, then run `npx supabase db push` after confirming the linked project.
2. Or apply `supabase/migrations/20260426033700_tasks_workflow_tables.sql` manually via Supabase Dashboard SQL Editor.
