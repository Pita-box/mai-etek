# Superpowers Plan Status

## Latest plan

**File:** `artifacts/superpowers/plan.md`  
**Title:** Tasks (Úkoly) Module Implementation Plan

Goal: implement a Tasks module where DOM/SuperAdmin can create, update, approve, reject, and manage tasks, while SUB users can view tasks, start them, upload evidence, and submit them for review.

## Planned steps

1. **API & Actions**
   - Create Next.js Server Actions for task CRUD and state transitions.
2. **UI Components**
   - Build `TaskCard`, `TaskForm`, `EvidenceUpload`, status and priority badges.
3. **Pages**
   - Implement DOM and SUB task list/detail/create views.
4. **Integration**
   - Connect frontend forms to Server Actions.
   - Add loading states and error toasts.

## Completed according to execution log

### Step 1: API & Actions — DONE

Changed files:
- `apps/web/src/actions/tasks.ts` created
- `apps/web/src/utils/supabase/server.ts` created

Recorded result:
- `cd apps/web && npm run build` — pass

### Step 2: UI Components — DONE

Changed files:
- `apps/web/src/components/tasks/TaskCard.tsx` created
- `apps/web/src/components/tasks/TaskForm.tsx` created
- `apps/web/src/components/tasks/EvidenceUpload.tsx` created
- `apps/web/src/components/tasks/TaskStatusBadge.tsx` created
- `apps/web/src/components/tasks/PriorityBadge.tsx` created

Recorded result:
- `cd apps/web && npm run build` — pass

## Remaining work

### Step 3: Pages — NOT DONE

Implement:
- `apps/web/src/app/(dashboard)/tasks/page.tsx`
- `apps/web/src/app/(dashboard)/tasks/new/page.tsx`
- `apps/web/src/app/(dashboard)/tasks/[id]/page.tsx`

Expected behavior:
- DOM/SuperAdmin: all-task list, filters/tabs, create button, create form, detail with approve/reject controls.
- SUB: focused to-do/active list, detail instructions, start task, upload evidence, submit for review.

### Step 4: Integration — NOT DONE

Implement:
- wire pages to `apps/web/src/actions/tasks.ts`
- handle loading states
- handle success/error toasts
- verify Czech UI copy
- verify role-based UX

## Suggested next move

Continue with **Step 3: Pages**, then **Step 4: Integration**.

Because the user invoked `/superpowers-execute-plan-parallel`, note that remaining steps likely have dependencies:
- Step 4 depends on Step 3 page structure.
- Both remaining steps touch related task pages/forms.

Recommendation: continue sequentially or as two batches:
1. Batch 1: Step 3 Pages
2. Batch 2: Step 4 Integration

## Verification commands

Run after Step 3:

```bash
cd apps/web && npm run build
```

Run after Step 4:

```bash
cd apps/web && npm run build
```

If test/lint scripts exist, also run:

```bash
cd apps/web && npm run lint
cd apps/web && npm test
```

## Review snapshot

- **Blocker:** none from artifact review.
- **Major:** cannot confirm current working tree matches execution log without inspecting files.
- **Minor:** no `finish.md` exists yet, so plan has not been completed.
- **Nit:** plan mentions API routes, but implementation log says Server Actions were created instead; this may be acceptable because the implementation steps specify Server Actions.
