## Chat MVP discovery

### Scope reference
- Phase 2 chat checklist in `docs/ARCHITECTURE.md:1820-1831` still has all chat items unchecked.
- Current `apps/web/src/app/(dashboard)/chat/page.tsx` is only a placeholder card.

### What already exists
- Database migrations already define a `messages` table and `message_type` enum with `text`, `image`, `video`, `voice`, `system`.
- Indexes exist for `messages.created_at` and `messages.sender_id`.
- Server already has Express + Supabase admin auth pattern in `apps/server/src/routes/user.ts`.
- Web already has authenticated API fetch helper in `apps/web/src/lib/api-client.ts`.
- Dashboard auth/profile loading already exists in `apps/web/src/app/(dashboard)/layout.tsx`.

### What is missing on server
- No chat/message routes are registered in `apps/server/src/index.ts`.
- No `messages` controller/service/routes files exist.
- No shared chat DTOs exist in `packages/types/src` (currently only user types are exported).
- `apps/server/src/socket/` is empty, so realtime is not implemented.

### What is missing on web
- No chat actions under `apps/web/src/actions/**`.
- No chat types under `apps/web/src/types/**`.
- No chat UI components under `apps/web/src/components/chat/**`.
- No current `/chat` data loading, composer, message bubbles, empty/loading/error states.

### MVP recommendation
1. Build non-realtime MVP first.
2. Add shared chat types for row + payload + normalized UI model.
3. Add server endpoints: `GET /api/chat/messages` and `POST /api/chat/messages`.
4. Support payload shapes for `text`, `image`, `video` with nullable media metadata and reserved `voice` type.
5. Add web actions for list/send and normalize sender/profile data for UI.
6. Build `/chat` page with text-first UX and placeholders/hooks for media actions.
7. Defer Socket.IO, typing, read receipts, deletion, pagination, telegram notification, and online status to later plan steps.

### Dependency analysis for parallel mode
- **Batch 1:** Discovery is complete.
- **Batch 2 candidates:**
  - Server/API + shared types
  - Web UI components skeleton
- **Not safely parallel yet:** Web data-access depends on finalized endpoint/type contracts from server/shared types.
- **Recommended execution:** Do server/types first, then web data-access + page/components together.

