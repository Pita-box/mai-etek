# UI/UX Pro Max Notes: Gamification MVP

## Scope
- This UI pass applies to Phase 3 Gamification MVP: `/dashboard`, `/rewards`, `/achievements`, plus navigation badges for Rewards/Achievements.
- It is an implementation brief, not a redesign of the whole app.
- The UI must support both roles:
  - DOM sees paired SUB stats, reward claims, and achievement progress.
  - SUB sees own XP, spendable points, rewards to claim, own claims, and achievement progress.

## Sources Read
- `design-system/MASTER.md`
- `artifacts/superpowers/brainstorm.md`
- `artifacts/superpowers/plan.md`
- Existing dashboard/navigation/task/wish component patterns
- Local `ui-ux-pro-max` search for dashboard/accessibility/Next.js guidance

## Design Direction
- Follow the existing project direction from `design-system/MASTER.md`: black Obsidian Glassmorphism, thin white borders, backdrop blur, rose/crimson primary accent, Lucide icons.
- Ignore the skill-generated green CTA recommendation. Green is allowed only as a semantic success indicator, not as the primary action color.
- Keep the pages dense and operational. Do not build a landing-page hero.
- Use full-width page sections and individual cards/panels only where they represent repeated items or tool surfaces.
- Avoid nested cards. If a panel contains repeated rows, rows should be lightweight list items with borders/dividers.
- Keep all visible copy in Czech.

## Shared Layout Rules
- Page wrapper: use the established dashboard content spacing, with responsive padding and a max width only if existing dashboard layout requires it.
- Header area: compact title + short supporting sentence + role-aware context, not a marketing headline.
- Primary action placement:
  - DOM Rewards: `Nová odměna` in the page header or filter/action row.
  - SUB Rewards: claim actions live on each reward card.
  - Achievements: no primary CTA; page is primarily read/progress.
- Use Lucide icons: `Trophy`, `Gift`, `Flame`, `Star`, `CheckCircle2`, `Lock`, `Coins`, `TrendingUp`, `CalendarDays`, `ClipboardCheck`.
- Buttons and clickable cards must use `cursor-pointer`, visible hover state, and `focus-visible` rings.
- Keep hover transitions to color/border/glow/opacity. Avoid layout-shifting scale effects for dashboard cards.
- Error messages must use `role="alert"` or equivalent announced region.
- Forms must use real labels, not placeholder-only inputs.

## Dashboard Page
- Purpose: quick gamification status overview.
- Recommended structure:
  - Top stats grid: `Celkem XP`, `Dostupné XP`, `Level`, `Série`.
  - Level progress panel: horizontal progress bar toward next level, with text like `35 XP do levelu 4`.
  - Task summary panel: completed tasks, perfect rating count, current streak, longest streak.
  - Recent XP ledger: latest transactions as compact rows with source/reason, points delta, and date.
- Use progress bars instead of adding a chart library for MVP.
- DOM view should make clear whose stats are shown, e.g. `Statistiky SUB`.
- Empty state: if no XP yet, show one calm panel with next meaningful action, not a large illustration.

## Rewards Page
- Purpose: spendable XP economy and DOM claim review.
- Recommended structure:
  - Header/action row with available XP summary.
  - Segmented filter/tabs:
    - SUB: `Dostupné`, `Moje žádosti`, `Historie`.
    - DOM: `Odměny`, `Ke schválení`, `Historie`.
  - Reward cards: title, description, XP cost pill, status/availability, claim button.
  - Claim rows/panel for DOM review: requester, reward title, cost, requested date, approve/reject controls, optional note.
- Disabled claim state must explain why, e.g. `Chybí 20 XP`.
- Reject should visually communicate refund behavior in copy near the action or status.
- DOM create/edit form should be compact and inline/modal-like according to existing form patterns; fields: title, description, cost, active status.
- Avoid rating controls; rewards are cost/claim/review only.

## Achievements Page
- Purpose: locked/unlocked milestone overview.
- Recommended structure:
  - Summary strip: unlocked count, total achievements, nearest progress.
  - Achievement grid: 1 column mobile, 2 tablet, 3 desktop when space allows.
  - Card states:
    - Unlocked: stronger border/accent, `Odemčeno` status, unlock date.
    - Locked: muted opacity, `Lock` icon, progress hint if available.
  - Progress copy should be specific where possible: `3/10 úkolů`, `Level 2/5`, `40/100 XP`.
- Do not rely on color alone for locked/unlocked; include icon and text.
- Achievement unlock badge should clear when `/achievements` is opened.

## Navigation Badges
- Extend existing badge behavior to `rewards` and `achievements` using the same visual style as Tasks/Wishes/Gallery badges.
- Rewards badge: count pending/new reward claim activity for the recipient.
- Achievements badge: count newly unlocked achievements for the user/DOM view.
- Rewards and Achievements badges clear on page mount/open because each page is a direct review/progress surface.
- Keep `99+` cap and no layout shift.

## Responsive Rules
- Mobile: single-column content, compact stat cards, sticky/fold-friendly actions only if existing layout supports it.
- Tablet/Desktop: use grid layouts, but do not compress text into tiny cards.
- Text inside pills/buttons must not overflow; use truncation for long reward names only where the full name remains visible in detail/card body.
- Avoid horizontal scroll except for intentionally scrollable data tables; MVP should not need data tables.

## Loading, Empty, Error States
- Loading: skeleton or lightweight glass placeholders with stable dimensions.
- Empty dashboard: show zeroed stats plus a short Czech hint.
- Empty rewards:
  - SUB: `Zatím nejsou dostupné žádné odměny.`
  - DOM: show create action.
- Empty achievements: still render seeded locked achievements; true empty only if seed failed.
- Errors: rose/red glass alert with clear retry path where applicable.

## Chart Decision
- MVP should not add Recharts/Chart.js just for gamification.
- Use CSS progress bars and compact transaction rows.
- A future stats dashboard can add an XP trend line once enough history exists.

## Verification Checklist
- `/dashboard`, `/rewards`, `/achievements` render for DOM and SUB without 404.
- All visible copy is Czech.
- Focus states are visible on buttons, tabs, forms, and clickable cards.
- Rewards claim button has disabled and insufficient-XP states.
- DOM claim review controls show pending/approved/rejected states clearly.
- Achievement cards show locked/unlocked states with icon + text, not color alone.
- Navigation badges for Rewards/Achievements match existing badge style and clear at the expected time.
- Responsive check at 375px, 768px, 1024px, and 1440px.
- No new one-off green primary CTA, emoji icons, nested cards, or large marketing hero sections.
