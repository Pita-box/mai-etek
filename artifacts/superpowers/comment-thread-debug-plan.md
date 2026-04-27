# Debug plan: comment thread message persists after DB migrations

## Goal
Find the root cause of why the frontend still shows `Vlákno komentářů pro tento tab se načte po aplikaci DB migrací.` even though remote Supabase migrations are now up to date.

## Brainstorm
- The message may be shown only when a relation/query throws a specific error and that error may still be happening.
- Possible causes:
  1. frontend/dev server still running stale code
  2. app points to a different Supabase project than `maietek`
  3. code checks the wrong relation name / catches too broad an error
  4. RLS or query shape triggers an error that is being misclassified as "migration missing"
  5. generated types / schema assumptions are stale

## Constraints
- Root cause first, no blind fix.
- Prefer targeted inspection of the exact message source and the server action/query path.
- Avoid changing DB state during investigation.

## Plan
1. Find the exact source of the Czech message in code.
2. Trace which query/action sets that fallback state.
3. Inspect environment/project configuration used by the web app.
4. Reproduce or inspect server logs / browser-visible behavior to capture the real error.
5. Form a single root-cause hypothesis.
6. Only then propose or implement a fix.

## Verification
- Confirm the real backend error or stale-config issue.
- After fix: reload app and verify the fallback message disappears and comments load correctly.

## Review (pre-implementation)
- Blocker: Root cause not yet identified.
- Major: Could be wrong Supabase project or misclassified runtime error.
- Minor: Dev server may need restart after env/schema changes.
- Nit: none.
