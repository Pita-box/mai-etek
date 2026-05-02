# UI/UX Pro Max Notes: Navigation Badges

## Scope
- This UI pass applies to the planned aside/mobile navigation badges for `Tasks`, `Přání`, `Galerie`, while keeping the existing `Chat` unread badge behavior.
- No new page layout or feature surface is required. The change should feel like an extension of the current sidebar, not a redesign.

## Existing Design Direction
- Use the existing project design system from `design-system/MASTER.md`: Obsidian Glassmorphism, black background, thin white borders, primary rose/crimson accent, subtle glow.
- Ignore the generated green CTA recommendation from the generic UI search because it conflicts with the app's established accent system.
- Keep Lucide icons and the existing `Navigation.tsx` structure.

## Badge Visual Rules
- Use one shared badge renderer for Chat, Tasks, Galerie, and Přání.
- Badge should remain compact: `min-w-5`, fixed line-height, `99+` cap for large counts.
- Use current primary badge styling as baseline: primary background, primary foreground, subtle primary border, soft rose glow.
- Badge must be right-aligned after the nav label and never resize the icon/label area unexpectedly.
- Badge should not appear for zero counts.
- Active nav item and badge may coexist; active background must not reduce badge contrast.

## Interaction Rules
- Nav links stay as `next/link` internal links.
- Click targets remain the full nav row, not the badge alone.
- All clickable rows must have `cursor-pointer`, hover state, and focus-visible ring.
- Badge updates should not animate layout-shifting size changes. If any transition is added, keep it to color/opacity, not scale.

## Responsive Rules
- Desktop sidebar and mobile sheet must use the same badge renderer.
- On narrow mobile, text must truncate before pushing the badge out of the row.
- Badge must stay visible and not cause horizontal scrolling.
- Verify at least mobile sheet width around 375px and desktop sidebar width 256px.

## Accessibility Rules
- The nav item accessible name should remain the page name; do not make screen readers read a noisy badge repeatedly unless explicitly needed.
- If adding an aria label, use concise text like `Tasks, 3 nové`.
- Keep focus order unchanged.
- Do not add decorative emoji or non-Lucide icons.

## Mark-Read UX Rules
- Tasks: do not clear badge on `/tasks` list view. Clear only after opening a specific task detail/popup and waiting for the existing view delay.
- Přání: do not clear badge merely on `/wishes`. Clear only when the matching `WishCard` is actually visible in viewport for a short stable delay.
- Galerie: clear all gallery badges on `/gallery` mount, because the gallery feed is the viewing surface.

## Verification Checklist
- Chat badge still appears and clears exactly as before.
- Tasks/Přání/Galerie badges visually match Chat badge.
- Counts cap at `99+` without overflow.
- Mobile sheet shows badges cleanly without horizontal scroll.
- Opening `/tasks` or `/wishes` alone does not clear badges.
- Opening `/gallery` clears gallery badges.
