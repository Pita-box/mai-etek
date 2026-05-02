# Chat Page Rules

> Page-specific rules for `/chat`.
> These rules override `design-system/MASTER.md` only where they are more specific.

## Goal

Chat must feel like the same Maietek product as Tasks, Settings, SuperAdmin, and the shared shell. It should not introduce a separate green communication theme.

## Required Source Order

1. Read `design-system/MASTER.md`.
2. Read this file.
3. Inspect existing shared components and tokens before changing chat UI.

## Color Rules

- Use the global Obsidian Glassmorphism palette from `MASTER.md`.
- Primary action color is Electric Crimson / rose:
  - `--primary`
  - `bg-primary`
  - `text-primary-foreground`
  - `#bf1741`
  - `#be123c`
  - glow based on `rgba(255, 31, 87, ...)`
- Submit/send buttons must use the global primary red with white text.
- Do not use green/emerald as the primary chat accent.
- Green is allowed only for tiny semantic state indicators:
  - online dot
  - successful delivery/read micro-state if needed
  - never as the main button, panel glow, header accent, or message bubble brand color
- Prefer neutral glass/slate surfaces plus crimson accents.

## Chat Components

- `ChatHeader`
  - Keep background/glass treatment consistent with app cards and panels.
  - Label text should use `text-primary` or muted neutral, not emerald.
  - Connection state may use subtle amber/red/neutral states, but avoid making green the dominant visual.

- `ChatComposer`
  - Send button uses `bg-primary text-primary-foreground`.
  - Attachment and voice controls should be neutral glass buttons with crimson hover/focus.
  - Focus rings and active states use the global primary/ring colors.

- `ChatMessageBubble`
  - Own messages may use crimson-tinted glass or primary accent treatment.
  - Partner messages should use neutral glass/slate surfaces.
  - Avoid emerald bubble backgrounds.

- `ChatPanel` and `ChatMessageList`
  - Use black/glass backgrounds, white hairline borders, and red/pink aura from `MASTER.md`.
  - Do not introduce a separate radial green/emerald page background.

## Interaction Rules

- Use lucide icons for actions.
- Keep icon-only actions visually consistent with existing buttons.
- Hover/focus effects should use subtle crimson glow, not green glow.
- Preserve readable contrast on black background.

## Copy Rules

- Visible UI text must be Czech.
- Avoid English status labels such as `Live` or `Reconnecting`; use Czech equivalents.

## Pre-Delivery Checklist

- [ ] `design-system/MASTER.md` was read before editing.
- [ ] Chat no longer uses green/emerald as primary accent.
- [ ] Send button matches the global red primary button style.
- [ ] Header, composer, and message bubbles look like the same product as Tasks Page.
- [ ] All visible chat UI copy is Czech.
- [ ] TypeScript check passes after UI changes.
