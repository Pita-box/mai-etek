# Comment Interactions Plan

## Brainstorm

### Goal
Doplnit comment thread o:
- barevné odlišení autora podle role
- editaci vlastního komentáře
- mazání komentářů pouze pro SuperAdmina
- heart/like interakci vpravo dole

### Constraints
- Zachovat současný task comment flow bez regresí.
- UI musí zůstat čisté a nepřeplácané.
- Oprávnění musí být vynucena nejen v UI, ale i na serveru / DB vrstvě.
- Pokud bude potřeba nový persistence model pro likes nebo edit/delete, musí být kompatibilní s RLS.

### Risks
- Současné `task_comments` možná ještě nemají pole pro soft delete / edited state dostupná v action vrstvě.
- Like interakce může vyžadovat novou tabulku nebo unikátní constraint (`user_id`, `comment_id`).
- Role autora komentáře nemusí být přímo v comment payloadu a bude nutné ji joinovat z `profiles`.
- SuperAdmin-only delete musí být ošetřen i proti ručnímu requestu.

### Acceptance criteria
- Běžný user má jméno u komentáře v `var(--color-blue-400)`.
- SuperAdmin má jméno u komentáře v `var(--primary)`.
- Autor svého komentáře vidí ikonku pencil vpravo nahoře a může komentář upravit.
- Pouze SuperAdmin vidí akci smazání vpravo nahoře a může komentář smazat.
- U komentáře je heart interakce vpravo dole.
- Stávající načítání a odeslání komentářů dál funguje.

## Step-by-step plan

### Step 1: Inspect comment schema, role source, and existing actions
Files / areas:
- `apps/web/src/actions/tasks.ts`
- `apps/web/src/components/tasks/TaskCommentsThread.tsx`
- task comment DB migration(s)
- `profiles` role/name source

Verify:
- Confirm whether edit/delete can use existing columns or need schema changes.
- Confirm where role is sourced for comment author coloring.

### Step 2: Design persistence for edit/delete/likes
- If possible, use existing `deleted_at` for delete behavior.
- Add/update server actions for:
  - update comment
  - delete comment
  - toggle like
- If likes are not modeled yet, add migration for a `task_comment_likes` table with uniqueness on user/comment.

Verify:
- Authorization rules are explicit:
  - author can edit own comment
  - only SuperAdmin can delete
  - authenticated participant can like/unlike

### Step 3: Enrich comment payload for UI state
- Return `author_name`, `author_role`, ownership flags, like state/count.
- Ensure optimistic or immediate UI refresh after edit/delete/like.

Verify:
- Payload contains enough information to render controls without extra roundtrips.

### Step 4: Implement comment card UI polish
- Author color by role.
- Pencil/delete actions in top-right.
- Heart action in bottom-right.
- Inline edit mode for author.

Verify:
- Layout stays visually balanced on desktop/mobile.
- Controls appear only when allowed.

### Step 5: Verify end-to-end
- Test add/edit/delete/like behavior.
- Run relevant build/lint checks.
- Record review pass by severity.

Verify commands:
```bash
pnpm --filter server build
pnpm --filter web build
pnpm run lint
```
