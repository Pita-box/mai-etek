# Execution Gate

The user asked to start implementation, but Superpowers rules require the following before code edits:

1. The written plan must be explicitly approved.
2. After approval, implementation must not start automatically.
3. The user must invoke `/superpowers-execute-plan` before execution begins, unless they explicitly opt out.
4. Because the remaining work includes UI/page implementation, the user rules also require invoking `/ui-ux-pro-max` for UI design work.

## Current status

- Latest plan exists: `artifacts/superpowers/plan.md`
- Progress summary exists: `artifacts/superpowers/status.md`
- Completed steps: Step 1 and Step 2
- Remaining steps: Step 3 Pages, Step 4 Integration

## Required next user action

Recommended:

```text
APPROVED
/superpowers-execute-plan
/ui-ux-pro-max
```

Or explicitly say:

```text
Schvaluji plán a chci pokračovat bez /superpowers-execute-plan a bez /ui-ux-pro-max.
```
