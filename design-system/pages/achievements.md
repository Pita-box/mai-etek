# UI/UX Pro Max Notes: Úspěchy, negativní odznaky a kázeňský dluh

## Scope

- Tento UI pass se týká stránky `/achievements` a malé úpravy DOM reject panelu u tasků.
- Cíl není redesign celé gamifikace, ale rozšíření `Úspěchy` na DOM-spravovaný systém živých odznaků.
- DOM je superadmin pro své přiřazené SUB účty.
- SUB vidí aktuálně držené odznaky, negativní odznaky, odebranou historii a `discipline_points` dluh.

## Sources Read

- `.agent/skills/ui-ux-pro-max/SKILL.md`
- `design-system/MASTER.md`
- `artifacts/superpowers/brainstorm.md`
- `artifacts/superpowers/plan.md`
- `artifacts/superpowers/ui-ux-pro-max-gamification.md`
- `apps/web/src/components/achievements/AchievementsClient.tsx`
- `apps/web/src/components/achievements/AchievementCard.tsx`
- `apps/web/src/components/tasks/DOMApproval.tsx`

## Design Direction

- Follow existing Obsidian Glassmorphism: black background, glass panels, thin white borders, rose/crimson primary accent.
- Ignore generic skill output recommending green CTA and pricing/landing structure; it conflicts with the app and task.
- This must feel like an operational control page, not a celebratory game landing page.
- Visible UI copy must be Czech.
- Use Lucide icons only; no emoji icons.
- Green is allowed only for semantic approved/success state. Primary actions stay rose/crimson.
- Red/rose destructive states must include icon + text, not color alone.

## Information Architecture

- Keep one page: `/achievements` / `Úspěchy`.
- Recommended high-level sections:
  - Summary strip: `Celkem XP`, `Dostupné XP`, `Kázeňský dluh`, `Aktivní odznaky`, `Ztracené odznaky`.
  - Main tabs/segmented control:
    - `Aktivní odznaky`
    - `Katalog`
    - `Historie`
    - `Kázeň`
  - For SUB, hide DOM-only management controls but keep the same conceptual sections where useful:
    - `Aktivní`, `Ztracené`, `Kázeň`.
- DOM view should make clear whose data is being shown: `SUB: <name>` near the header/stat strip.
- Do not nest cards inside cards. Section panel may contain lightweight rows/lists.

## Badge/ Odznak Card States

- Positive active badge:
  - Lucide icon such as `Trophy`, `Star`, `CheckCircle2`.
  - Status pill: `Aktivní` or `Drženo`.
  - Accent: primary rose/crimson glow/border.
- Negative active badge:
  - Lucide icon such as `AlertTriangle`, `ShieldAlert`, `Ban`, `OctagonAlert`.
  - Status pill: `Kázeňský` / `Prohřešek`.
  - Accent: rose/red border and clear text label; do not rely only on red color.
  - Show `+N dluh` when `xp_penalty > 0`.
- Removed/lost badge:
  - Muted style with `Archive`, `Undo2`, or `XCircle`.
  - Show `Odebráno`, `datum`, `důvod`, and who removed it if available.
  - It should not look like currently held status.
- Locked/auto-progress badge:
  - Keep previous locked state, but distinguish from removed history.
  - Locked means not earned yet; removed means earned/assigned and later lost.

## DOM Management UX

- DOM-only `Katalog` tab:
  - Shows badge definitions in a compact list/grid.
  - Each definition has `Upravit`, `Smazat`, and quick `Přidělit SUB` action.
  - `Smazat` should be soft delete and require confirmation.
- DOM badge form fields:
  - `Název` required.
  - `Popis` optional but recommended.
  - `Typ`: segmented control `Pozitivní` / `Negativní`.
  - `Režim`: `Automatický` / `Ruční` if implementation supports both.
  - `Podmínka` fields for automatic positive badges.
  - `XP odměna` for positive badges, optional.
  - `XP penalizace` for negative badges, optional number default `0`.
  - `Aktivní` toggle.
- DOM assignment flow:
  - Use inline action or compact modal-like panel.
  - Required `Důvod` textarea for manual assignment/removal.
  - For negative badge with penalty, preview: `Přidá +N kázeňského dluhu`.
  - Disable submit while pending and show spinner.
- DOM removal flow:
  - Require confirmation and reason.
  - Copy should say `Odebrat odznak`, not `Smazat`, because history remains.

## Discipline UX

- `Kázeňský dluh` is separate from XP.
- Show it as a stat tile near XP stats, e.g. `Kázeňský dluh: 35`.
- Manual discipline form:
  - DOM-only.
  - Fields: `Body dluhu`, `Důvod`.
  - Clear warning copy: `Přidá se k discipline_points, dostupné XP neklesnou pod nulu.`
  - Require confirmation for large values, e.g. over 100.
- Ledger/history rows:
  - Show source: `Ruční penalizace`, `Prohřeškový odznak`, `Odmítnutý úkol`, future `Prošlý úkol`.
  - Show date, points, reason.

## Task Reject Penalty UX

- Extend `DOMApproval` reject area without making normal reject scary by default.
- Recommended layout:
  - Existing feedback textarea remains required for reject.
  - Add a collapsed/optional section: `Přidat kázeňskou penalizaci`.
  - Toggle/checkbox reveals `Body dluhu` and `Důvod penalizace`.
  - If penalty reason is empty, fallback to reject feedback may be allowed, but UI should still make reason explicit.
  - Approve button remains positive semantic state; reject button remains destructive semantic state.
- Default penalty toggle is off.
- Rejection without penalty must look and behave like current revision request.

## Tabs and Filters

- Avoid too many top-level tabs on mobile. Use horizontal scroll segmented buttons matching Gallery/Rewards style.
- DOM suggested tabs:
  - `Aktivní`, `Katalog`, `Historie`, `Kázeň`.
- SUB suggested tabs:
  - `Aktivní`, `Ztracené`, `Kázeň`.
- Within `Aktivní`, filter chips may be:
  - `Vše`, `Pozitivní`, `Kázeňské`.
- Counts should be shown in compact pills and capped only if they can grow large.

## Accessibility Rules

- Destructive actions require confirmation and must have accessible names.
- Icon-only buttons need `aria-label`.
- Forms must use real labels, no placeholder-only inputs.
- Errors use `role="alert"`.
- Loading buttons are disabled during pending state.
- Color is never the only status cue: include icon + status text for positive/negative/removed.
- Keyboard focus rings must stay visible on tabs, form controls, assignment/removal buttons.

## Responsive Rules

- 375px: single-column stat cards and badge cards; action buttons wrap, no horizontal page scroll.
- 768px: two-column badge grid if card text remains readable.
- 1024px+: use 2-column operational layout for DOM where helpful:
  - left/main: SUB current badge state,
  - right/side: catalog/actions/discipline controls.
- Long badge titles and reasons must wrap or truncate only in metadata rows, not in primary detail.

## Empty States

- No active badges:
  - DOM: `SUB zatím nedrží žádný odznak.` with catalog assign action.
  - SUB: `Zatím nemáš žádný aktivní odznak.`
- No negative badges:
  - Do not frame it as permanent success; use calm copy like `Žádné aktivní kázeňské odznaky.`
- No history:
  - `Zatím žádné odebrané odznaky.`
- No catalog:
  - DOM sees `Vytvořit první odznak` action.

## Visual Guardrails

- No large hero section.
- No celebratory confetti/emoji visuals.
- No nested cards.
- No green primary CTA.
- Keep cards dense: titles, status pill, reason/progress, date, action row.
- Use primary rose for main actions, neutral glass for secondary, rose/red for destructive/discipline.

## Verification Checklist

- DOM can visually distinguish current SUB badges, catalog definitions, lost history, and discipline ledger.
- SUB can distinguish active positive badges, active negative badges, and removed/lost badges.
- Negative badges show text/icon and optional debt amount.
- Discipline debt is visibly separate from total/available XP.
- Manual assignment/removal requires reason and has loading/error states.
- Reject task penalty is opt-in and does not alter the normal reject flow by default.
- `/achievements` clears achievement badges on open.
- Responsive check: 375px, 768px, 1024px, 1440px.
