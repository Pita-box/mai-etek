import { getChatMessages } from '@/actions/chat';
import { ChatPageClient } from '@/components/chat/ChatPageClient';

export const dynamic = 'force-dynamic';

export default async function ChatPage() {
  const { messages, participants, error, viewerId, viewerRole, hasMore, nextCursor } = await getChatMessages({ limit: 30 });

  return (
    <ChatPageClient
      initialMessages={messages}
      initialParticipants={participants}
      initialError={error ?? null}
      viewerId={viewerId ?? null}
      viewerRole={viewerRole ?? null}
      initialHasMore={hasMore}
      initialNextCursor={nextCursor ?? null}
    />
  );
}
