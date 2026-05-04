# UI/UX Pro Max: Phase 6 Polish & OVH Deploy Readiness

## Scope

Tento UI/UX pass doplňuje `artifacts/superpowers/plan.md` pro Phase 6. Neřeší deploy konfiguraci samotnou, ale definuje vizuální a interakční standard pro:

- `EmptyState`,
- bottom-center toast notifications,
- Framer Motion animace,
- stránkový polish v pořadí:
  1. Tasks
  2. Chat
  3. Gallery
  4. Monitoring
  5. Superadmin
  6. Achievements/Rewards
  7. Wishes

## Sources Read

- `design-system/MASTER.md`
- `design-system/pages/chat.md`
- `design-system/pages/achievements.md`
- `artifacts/superpowers/brainstorm.md`
- `artifacts/superpowers/plan.md`
- Current Phase 6 section in `docs/ARCHITECTURE.md`

## Global Direction

- Keep the app operational, dense, and scannable.
- No landing-page patterns, no oversized hero sections, no marketing copy.
- Follow Obsidian Glassmorphism:
  - black background,
  - thin white borders,
  - muted zinc text,
  - crimson/rose primary accent,
  - subtle glass cards.
- Use lucide icons only.
- Visible UI text must be Czech.
- Avoid green as a primary accent. Green is only a tiny semantic success/online indicator.
- No nested cards. Repeated items can be cards; sections should be clean panels/bands.
- Cards should stay practical, not decorative.

## EmptyState Design

### Purpose

Empty states must answer:

1. What is missing?
2. Why is the screen empty?
3. What can DOM/SUB do next, if anything?

### Component Shape

Recommended component props:

- `icon`
- `title`
- `description`
- `actionLabel`
- `actionHref` or `onAction`
- `secondaryActionLabel`
- `variant`: `default | compact | danger | success`

### Visual Rules

- Use a small icon container, not a large illustration.
- Icon container:
  - rounded `16px`,
  - border `border-white/10`,
  - background `bg-white/[0.04]`,
  - primary/rose icon when action-oriented.
- Title:
  - concise,
  - white,
  - not hero-scale.
- Description:
  - one short sentence,
  - zinc muted.
- CTA:
  - only when there is a natural next action.
  - primary CTA uses `bg-primary`.
  - secondary uses outline/glass.
- Compact empty states inside panels should not exceed ~160px height.

### Page-Specific Empty State Copy

Tasks:

- No tasks: `Zatím nejsou zadané žádné úkoly.`
- Filter empty: `Žádný úkol neodpovídá aktuálním filtrům.`
- DOM CTA: `Vytvořit úkol`

Chat:

- No messages: `Konverzace zatím čeká na první zprávu.`
- Search empty: `V chatu není žádná shoda.`
- No CTA needed unless composer is hidden.

Gallery:

- No media: `Galerie zatím neobsahuje žádné soubory.`
- Filter empty: `Žádné médium neodpovídá aktuálním filtrům.`
- CTA for allowed uploaders: `Vybrat soubory`

Monitoring:

- No devices: `Zatím není spárovaná žádná instalace MMM.`
- No timeline: `Zatím nejsou synchronizované žádné záznamy.`
- Filter empty: `Žádný záznam neodpovídá aktuálním filtrům.`
- CTA: pairing code generation if DOM has SUB accounts.

Superadmin:

- No unassigned users: `Žádné účty nečekají na přiřazení.`
- No SUB accounts: `Zatím nemáš přiřazený žádný SUB účet.`

Achievements:

- No active badges: `Zatím nejsou aktivní žádné odznaky.`
- No catalog: `Katalog odznaků je prázdný.`
- DOM CTA: `Vytvořit odznak`

Rewards:

- No rewards: `Zatím nejsou dostupné žádné odměny.`
- No claims: `Žádné odměny nečekají na schválení.`

Wishes:

- No wishes: `Zatím nejsou přidaná žádná přání.`
- Filter empty: `Žádné přání neodpovídá aktuálním filtrům.`
- SUB CTA: `Přidat přání`

## Toast System

### Behavior

- Position: always bottom center.
- Max visible toasts: 3.
- New toast appears above older bottom toast or replaces same-id toast.
- Auto-dismiss:
  - success: 3500ms,
  - info: 4500ms,
  - error: 6000ms unless persistent error is needed.
- User can close toast manually.
- Toasts must not block main workflows.

### Visual Rules

- Container:
  - fixed bottom safe-area aware,
  - centered,
  - max width `min(420px, calc(100vw - 32px))`.
- Toast card:
  - black/glass background,
  - border `border-white/10`,
  - subtle rose glow only for success/info if useful,
  - destructive/error border rose/red.
- Include icon + title + optional description.
- No emoji.
- Use Czech copy.

### Toast Copy Pattern

Success:

- `Uloženo.`
- `Úkol byl vytvořen.`
- `Soubor byl nahrán.`
- `Změna byla uložená.`

Error:

- `Akce se nepodařila.`
- Detail can use returned server error when safe and Czech.

Info:

- `Synchronizuji změny.`
- `Nahrávání běží na pozadí.`

### Where To Apply First

Tasks:

- create/update/delete,
- start/submit,
- approve/reject,
- evidence upload/delete.

Monitoring:

- create pairing code,
- rename/revoke/delete device,
- delete timeline event.

Gallery:

- upload,
- favorite,
- delete,
- bulk operations.

Superadmin:

- assign user,
- reveal failure,
- page access toggle.

## Framer Motion Rules

### Use Cases

- Toast enter/exit.
- Empty state enter.
- Page section fade/slide on first render.
- List item/card entrance for small/medium lists.
- Dialog/lightbox subtle fade/scale if existing primitives allow it cleanly.

### Avoid

- Animating masonry layout in a way that causes layout shift.
- Animating long Monitoring timelines heavily.
- Large springy motion.
- Animations on every hover if CSS already handles it.

### Motion Defaults

- Duration: 160-240ms for toasts and small UI.
- Page/card entrance: 220-320ms.
- Easing: standard ease-out, no dramatic bounce.
- Respect reduced motion:
  - if user prefers reduced motion, reduce to opacity-only or no animation.

## Accessibility Rules

- Every icon-only button needs `aria-label`.
- Every destructive action needs confirmation or undo pattern.
- Forms use labels, not placeholder-only.
- Toast region uses `aria-live`.
  - success/info: `polite`,
  - error: `assertive` only for blocking errors.
- Empty state CTA must be keyboard reachable.
- Focus rings must be visible on dark background.
- Dialog/sheet content must have accessible title/description.
- Color must not be the only state indicator; include icon/text.
- External links in Monitoring URL timelines should have clear accessible names.

## Page Polish Notes

### Tasks

- Highest priority.
- Keep task list dense and operational.
- Empty states should vary by role:
  - DOM sees create CTA.
  - SUB sees calm informational empty state.
- Toasts for all mutations.
- Avoid animated task card height changes that push content around.

### Chat

- Must follow `design-system/pages/chat.md`.
- No green primary accent.
- Message list scroll behavior is sacred; animations must not break auto-scroll or load-more position.
- Empty search state can use shared `EmptyState` in compact form.
- Composer icon buttons need accessible names.

### Gallery

- Preserve Pinterest/masonry feel.
- Empty states above grid area, not a marketing hero.
- Upload queue should remain hidden until files are selected.
- Toast upload success/error should not replace per-file queue status; both can coexist.

### Monitoring

- Operational dashboard style.
- Long timelines stay paginated and scannable.
- Empty states should sit inside each section:
  - devices,
  - visited web/click timeline,
  - form activity,
  - screenshots.
- Avoid heavy animations in screenshot grid.

### Superadmin

- Tables/lists need clear empty states.
- Page access chips remain primary/destructive as requested:
  - `Povoleno` primary,
  - `Nepovoleno` destructive.
- Password reveal remains explicit action, not automatic display.

### Achievements/Rewards

- Follow `design-system/pages/achievements.md`.
- No confetti/emoji celebration.
- Negative/discipline states use icon + text, not color alone.
- Rewards claims panel should use compact empty states.

### Wishes

- Empty state should encourage SUB to add a wish only when SUB has permission.
- DOM status changes use toast feedback.
- Media upload empty/queue states should mirror Gallery style.

## Implementation Guardrails

- Do not refactor unrelated logic while applying UI polish.
- Introduce shared components first, then migrate one page at a time.
- Avoid converting every component to Framer Motion in one pass.
- Avoid adding new color tokens unless needed.
- Do not add marketing-like sections.
- Do not add visible instructional copy explaining app features.

## Verification Checklist

- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web exec eslint <changed files>`
- `pnpm --filter web build` after dependency changes.
- Manual responsive checks:
  - 375px,
  - 768px,
  - 1024px,
  - 1440px.
- Keyboard pass:
  - navigation,
  - forms,
  - modals/sheets,
  - toast close button,
  - page action buttons.
- Reduced motion check:
  - system/browser reduced motion should not produce distracting transitions.

