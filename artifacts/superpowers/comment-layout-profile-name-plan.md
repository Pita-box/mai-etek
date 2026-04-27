# Plan: Comment layout + user display names

## Brainstorm

### Goal
1. Make the comments area feel like part of the existing evidence section instead of a separate bordered box.
2. Show a human-readable user name on each comment.
3. Let users set/change their display name during registration and in Settings.

### Constraints
- This is not a tiny change: it touches UI layout, auth/profile forms, database/profile data, and comment rendering.
- Keep the implementation minimal and aligned with the existing Supabase `profiles` table.
- Avoid breaking existing users who may not have a name yet.
- Preserve current working comment submit/read behavior.
- Because the request includes UI layout changes, project rules require `/ui-ux-pro-max` before implementation.

### Risks
- Existing `profiles` schema may use a different name column or no column at all.
- Registration flow may create profile rows in multiple places.
- Settings page may not already have a profile update action.
- Supabase joins from `task_comments.author_id` to `profiles.id` may be blocked by RLS or relationship naming.

### Acceptance criteria
- Comment section visually sits inside/with the evidence tab content with reduced nested borders.
- Each comment shows an author name.
- If no name is set, comment falls back to a safe label like `subíček`.
- Registration has a name field and stores it to the user profile.
- Settings has a name field and lets the user update it.
- Existing comment creation still works.

## Step-by-step plan

### Step 1: Run required UI/UX workflow
- User runs `/ui-ux-pro-max` as required by project rule for UI work.
- Use its guidance for the comment/evidence layout polish.

Verify:
- UI workflow has been invoked before implementation.

### Step 2: Inspect current auth/profile/settings/comment layout
Files to inspect:
- registration page/action files
- settings page/action files
- profile schema/migrations/types
- `TaskEvidenceTabs.tsx`
- `TaskCommentsThread.tsx`
- `tasks.ts`

Verify:
- identify existing profile name column or decide whether a migration is needed.

### Step 3: Adjust evidence/comments layout
Files likely affected:
- `apps/web/src/components/tasks/TaskEvidenceTabs.tsx`
- `apps/web/src/components/tasks/TaskCommentsThread.tsx`

Change:
- remove redundant outer comment card styling.
- make `TaskCommentsThread` render as an embedded subsection.
- keep loading/empty/comment states readable.

Verify:
- manual visual inspection in task popup.
- `pnpm exec eslint src/components/tasks/TaskEvidenceTabs.tsx src/components/tasks/TaskCommentsThread.tsx`

### Step 4: Add/display user names in comments
Files likely affected:
- `apps/web/src/actions/tasks.ts`
- `apps/web/src/components/tasks/TaskCommentsThread.tsx`

Change:
- update `getTaskComments` to include author profile display name.
- render author name per comment.
- keep fallback for missing names.

Verify:
- create comments as different users and confirm correct names show.
- `pnpm exec eslint src/actions/tasks.ts src/components/tasks/TaskCommentsThread.tsx`

### Step 5: Add name to registration
Files likely affected:
- registration page and signup action/component
- profile creation logic

Change:
- add display name input.
- store name into `profiles`.
- use non-breaking validation.

Verify:
- new user registration creates profile with name.
- lint affected files.

### Step 6: Add name edit to Settings
Files likely affected:
- settings page/component/action

Change:
- show current profile name.
- allow update and save.
- show success/error feedback.

Verify:
- existing user changes name.
- comments show updated name after reload/refetch.
- lint affected files.

### Step 7: Final verification and review
Commands:
- targeted eslint on affected files
- optionally broader `pnpm --filter web lint` if available/fast

Manual validation:
1. Register a test user with a name.
2. Change name in Settings.
3. Submit task comments as DOM/SUB.
4. Confirm comments show names and section layout is cleaner.

## Open question
Should the display name be required during registration, or optional with fallback `Uživatel`?
