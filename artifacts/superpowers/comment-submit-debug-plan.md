# Debug plan: comment submit clears input but appears to do nothing

## Goal
Find why submitting a task comment clears the input but gives no visible result.

## Brainstorm
Likely causes:
1. insert succeeds, but UI has no read/render path so user sees no change
2. action returns success but revalidation does not update visible state
3. submit triggers a silent failure path not surfaced in UI
4. input reset happens before any visible optimistic or fetched update

## Constraints
- Root cause first, no blind fixes.
- Keep changes minimal.
- Verify with targeted lint and manual flow.

## Plan
1. Trace submit flow in `TaskCommentsThread` and `addTaskComment`.
2. Verify whether comment rows are actually being inserted.
3. Confirm whether the component has any read path or optimistic UI for new comments.
4. Implement the smallest correct fix:
   - either fetch/render comments, or
   - add optimistic state if appropriate, or both.
5. Verify with lint and manual comment submission flow.

## Acceptance criteria
- After submit, user sees the new comment in the active tab thread.
- No silent no-op behavior.

## Verification
- `pnpm exec eslint src/components/tasks/TaskCommentsThread.tsx src/actions/tasks.ts` from `apps/web`
- Manual: submit a comment and confirm it appears immediately or after refresh.
