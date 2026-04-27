# Execution

## Step 1 — Identify shared vs shell-specific responsibility
- **Files changed:** none
- **What changed:**
  - Confirmed popup-specific responsibilities: dialog shell, close button, ESC handling, view tracking.
  - Confirmed shared responsibilities: task hero, instructions, evidence/comments tabs, DOM/SUB actions, metadata, feedback.
  - Decided shared API: `TaskDetailContent({ task, role, layout, titleId, onTaskMutated })`.
- **Verification commands:** none, code structure review only.
- **Result:** pass

## Step 2 — Extract reusable task detail content component
- **Files changed:**
  - `apps/web/src/components/tasks/TaskDetailContent.tsx`
  - `apps/web/src/components/tasks/TaskDetailPopup.tsx`
- **What changed:**
  - Added shared rich task detail content component.
  - Refactored popup to keep only modal shell behavior and render shared content.
- **Verification commands:**
  - `pnpm exec eslint src/components/tasks/TaskDetailContent.tsx src/components/tasks/TaskDetailPopup.tsx && pnpm exec tsc --noEmit`
- **Result:** pass

## Step 3 — Upgrade standalone `/tasks/[id]` page to full detail
- **Files changed:**
  - `apps/web/src/components/tasks/TaskDetailPageClient.tsx`
  - `apps/web/src/app/(dashboard)/tasks/[id]/page.tsx`
- **What changed:**
  - Added a tiny client wrapper so standalone route can use shared task detail content and refresh after mutations.
  - Replaced the reduced legacy page with a premium standalone page shell and the same full detail content used by popup.
  - Preserved server-side task loading, role detection, and back navigation.
- **Verification commands:**
  - `pnpm exec eslint src/components/tasks/TaskDetailContent.tsx src/components/tasks/TaskDetailPopup.tsx src/components/tasks/TaskDetailPageClient.tsx 'src/app/(dashboard)/tasks/[id]/page.tsx' && pnpm exec tsc --noEmit`
- **Result:** pass

## Step 4 — Review UX parity and edge cases
- **Files changed:** none
- **What changed:**
  - Reviewed popup shell vs page shell responsibilities after extraction.
  - Confirmed page now uses the same evidence/comments/approval content path as popup.
  - Confirmed popup-only affordances remain isolated to the popup shell.
- **Verification commands:**
  - source review of `TaskDetailContent.tsx`, `TaskDetailPopup.tsx`, and `/tasks/[id]/page.tsx`
- **Result:** pass
