# Plan — Full task detail page parity with popup

## Goal
Make `/tasks/[id]` show the full task detail experience, not the current reduced legacy page.

## Current gap
- `TaskDetailPopup` already contains the rich task detail UX.
- `/app/(dashboard)/tasks/[id]/page.tsx` still renders an older simplified detail page.
- Clicking a notification opens the standalone route, so users see a degraded experience compared to the popup.

## Plan

### Step 1 — Identify shared vs shell-specific responsibility
- Separate popup-only responsibilities from reusable detail content.
- Define a shared component API for full task detail content.
- Verification: code review of extracted props/interfaces.

### Step 2 — Extract reusable task detail content component
- Create a shared task detail content/layout component used by both views.
- Move rich content from `TaskDetailPopup` into the shared component.
- Keep popup shell responsibilities in `TaskDetailPopup` only.
- Verification: `pnpm exec eslint <touched-files> && pnpm exec tsc --noEmit`.

### Step 3 — Upgrade standalone `/tasks/[id]` page to use shared full detail view
- Replace simplified legacy layout with the shared full detail content.
- Preserve route-specific needs such as back navigation and page shell.
- Ensure role-based actions work in standalone mode.
- Verification: `pnpm exec eslint <touched-files> && pnpm exec tsc --noEmit`.

### Step 4 — Review UX parity and edge cases
- Check DOM vs SUB behavior.
- Confirm feedback/evidence/comments sections appear correctly.
- Confirm no popup-only affordances appear on the standalone page.
- Verification: manual route walkthrough via `/tasks/[id]` and optional dev runtime check.

## Files likely involved
- `apps/web/src/components/tasks/TaskDetailPopup.tsx`
- `apps/web/src/app/(dashboard)/tasks/[id]/page.tsx`
- new shared task detail component file under `apps/web/src/components/tasks/`

## Acceptance criteria
- `/tasks/[id]` visually exposes the same core detail information and controls as the popup.
- Evidence/comments/approval-related sections are available on the page route too.
- Role-based behavior matches popup behavior.
- Existing popup still works.
- No TypeScript or lint errors.
- Manual validation confirms notification click -> full detail page parity.
