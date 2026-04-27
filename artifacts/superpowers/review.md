# Review

## Blocker
- None after current code verification.

## Major
- Notification realtime still depends on Supabase publication/setup for the `notifications` table. The new polling fallback should keep the UX functional even if websocket delivery is delayed.

## Minor
- `getNotifications()` currently computes `unreadCount` from the fetched limited list. If the product later needs a global unread count independent of feed limit, this should move to a count query.
- Notification UI currently lives only in the desktop dashboard header (`md` and up), matching the current header implementation. Mobile entry point is still absent.
- Notification insert coverage was already present for core task workflow events; this pass focused on delivery and read-state UX, not a generalized notification taxonomy.
- Base UI menu label parts are group-scoped in this component library; custom dropdown headers should avoid `DropdownMenuLabel` unless wrapped in `DropdownMenuGroup`.

## Nit
- `markNotificationRead()` and `markAllNotificationsRead()` refetch after mutation for correctness. If scale grows, optimistic unread badge updates could be added later.
