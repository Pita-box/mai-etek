# Finish

## Summary of changes
- Extracted a shared `TaskDetailContent` component as the single source of truth for rich task detail UI.
- Refactored `TaskDetailPopup` to keep only popup shell responsibilities: modal layout, close button, and ESC behavior.
- Replaced the reduced standalone `/tasks/[id]` page with a premium page shell that renders the same full detail content as the popup.
- Added `TaskDetailPageClient` so standalone page mutations can refresh the route after submit/approval/comment/evidence changes.

## Verification commands run + results
- `pnpm exec eslint src/components/tasks/TaskDetailContent.tsx src/components/tasks/TaskDetailPopup.tsx && pnpm exec tsc --noEmit`
  - **Result:** pass
- `pnpm exec eslint src/components/tasks/TaskDetailContent.tsx src/components/tasks/TaskDetailPopup.tsx src/components/tasks/TaskDetailPageClient.tsx 'src/app/(dashboard)/tasks/[id]/page.tsx' && pnpm exec tsc --noEmit`
  - **Result:** pass

## Manual validation steps
1. Open dashboard tasks list and open a task in the popup.
2. Confirm popup still shows instructions, evidence/comments, DOM/SUB actions, metadata, and feedback.
3. Click a notification that routes to `/tasks/[id]`.
4. Confirm the standalone page shows the same rich sections as the popup.
5. As SUB, submit/comment/evidence and confirm the page refreshes to reflect latest state.
6. As DOM, review/approve/reject and confirm standalone page reflects the updated status and feedback.

## Review pass
- **Blocker:** none
- **Major:** none
- **Minor:** submit failure in `TaskDetailContent` currently logs to console only; if desired, this can be upgraded to visible inline error feedback on both page and popup.
- **Nit:** standalone page shell and popup shell are intentionally slightly different visually, but content parity is now shared.

## Follow-ups
- Optional: add a lightweight visible error banner for failed SUB submit actions in shared content.
- Optional: perform browser-level manual parity check for one DOM and one SUB account.
