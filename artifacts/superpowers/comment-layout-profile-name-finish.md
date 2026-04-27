# Comment Layout + Profile Name Finish Report

## Scope completed
- Integrated comments visually into the evidence tab content with fewer nested borders.
- Added display names to comments.
- Added `subíček` fallback for missing/blank names.
- Added optional `Jméno` field to registration.
- Added editable `Jméno` field to Settings.
- Updated backend registration/settings routes to persist `full_name`.

## Files changed
- `apps/web/src/actions/tasks.ts`
- `apps/web/src/components/tasks/TaskCommentsThread.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(dashboard)/settings/page.tsx`
- `apps/server/src/routes/superadmin.ts`
- `apps/server/src/routes/user.ts`

## Verification

### Commands run
```bash
pnpm run lint
pnpm --filter server build
pnpm --filter web build
```

### Results
- `pnpm --filter server build`: passed.
- `pnpm --filter web build`: passed.
- `pnpm run lint`: failed on pre-existing unrelated lint errors:
  - `apps/web/src/components/shared/Navigation.tsx`
  - `apps/web/src/hooks/useSuperAdmin.ts`
  - `apps/web/tailwind.config.ts`

## Acceptance criteria
- Comment section visually sits inside/with evidence tab content: done.
- Each comment shows an author name: done.
- Missing name falls back to `subíček`: done.
- Registration has a name field and stores it: done.
- Settings has a name field and updates it: done.
- Existing comment creation still works: build verification passed; manual browser smoke test still recommended.

## Review pass

### Blocker
- None found.

### Major
- None found in changed code.

### Minor
- Full-workspace lint is blocked by unrelated existing errors, so lint cannot be used as a clean final gate yet.

### Nit
- The settings form always sends `full_name`, even if only email/password was intended. This is acceptable because it preserves or normalizes the display name to `subíček`.

## Recommended manual smoke test
1. Register without filling `Jméno`; verify profile/comment author shows `subíček`.
2. Register or update Settings with a custom name; add a task comment.
3. Verify the new comment shows the custom name immediately.
4. Reopen the task and verify older comments still show names or fallback.
