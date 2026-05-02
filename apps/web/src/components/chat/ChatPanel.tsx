import { AlertTriangle, MessageCircleHeart } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { ChatMessageItem } from '@/types/chat';
import type { ChatSocket } from '@/lib/socket';
import { ChatComposer } from './ChatComposer';
import { ChatMessageList } from './ChatMessageList';
import { ChatState } from './ChatState';
import { ChatHeader } from './ChatHeader';

type ChatPanelProps = {
  messages: ChatMessageItem[];
  partnerName?: string | null;
  partnerLastOnlineAt?: string | null;
  onSendMessage: (text: string, attachment?: { type: 'image' | 'video' | 'voice'; url: string; thumbnailUrl?: string | null }, replyToMessageId?: string | null) => Promise<string | null | undefined>;
  onLoadMore?: () => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onToggleHeart?: (messageId: string) => Promise<void>;
  onReplyMessage?: (message: ChatMessageItem) => void;
  unreadScrolledMessageCount?: number;
  onMessageListBottomChange?: (isAtBottom: boolean) => void;
  replyToMessage?: ChatMessageItem | null;
  onCancelReply?: () => void;
  isSearchOpen?: boolean;
  searchQuery?: string;
  searchResults?: ChatMessageItem[];
  isSearching?: boolean;
  searchError?: string | null;
  onToggleSearch?: () => void;
  onCloseSearch?: () => void;
  onSearchQueryChange?: (value: string) => void;
  viewerRole?: 'dom' | 'sub' | 'unassigned' | null;
  error?: string | null;
  isLoading?: boolean;
  isTyping?: boolean;
  typingUserName?: string | null;
  isPartnerOnline?: boolean;
  isConnected?: boolean;
  hasMoreMessages?: boolean;
  socket?: ChatSocket | null;
};

export function ChatPanel({
  messages,
  partnerName,
  partnerLastOnlineAt,
  onSendMessage,
  onLoadMore,
  onDeleteMessage,
  onToggleHeart,
  onReplyMessage,
  unreadScrolledMessageCount = 0,
  onMessageListBottomChange,
  replyToMessage = null,
  onCancelReply,
  isSearchOpen = false,
  searchQuery = '',
  searchResults = [],
  isSearching = false,
  searchError = null,
  onToggleSearch,
  onCloseSearch,
  onSearchQueryChange,
  viewerRole,
  error,
  isLoading = false,
  isTyping = false,
  typingUserName = null,
  isPartnerOnline = false,
  isConnected = false,
  hasMoreMessages = false,
  socket = null,
}: ChatPanelProps) {
  const partnerMessage = messages.find(m => !m.isOwnMessage);
  const displayPartnerName = partnerName ?? partnerMessage?.sender.fullName;
  const isSearchMode = isSearchOpen && searchQuery.trim().length >= 3;
  const visibleMessages = isSearchMode ? searchResults : messages;

  return (
    <section className="flex h-full min-h-[calc(100vh-11rem)] flex-col gap-0">
      <Card className="flex flex-1 flex-col overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,31,87,0.14),transparent_32%),linear-gradient(180deg,rgba(0,0,0,0.82),rgba(0,0,0,0.96))] text-white backdrop-blur-xl">
        <ChatHeader
          partnerName={displayPartnerName}
          partnerLastOnlineAt={partnerLastOnlineAt}
          isPartnerOnline={isPartnerOnline}
          isConnected={isConnected}
          isTyping={isTyping}
          typingUserName={typingUserName}
          isSearchOpen={isSearchOpen}
          searchQuery={searchQuery}
          searchResultCount={searchResults.length}
          isSearching={isSearching}
          searchError={searchError}
          onToggleSearch={onToggleSearch}
          onCloseSearch={onCloseSearch}
          onSearchQueryChange={onSearchQueryChange}
        />

        {/* Content */}
        <CardContent className="flex flex-1 flex-col gap-0 p-0">
          {error ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <ChatState
                title="Nepodařilo se načíst konverzaci"
                description={error}
                icon={<AlertTriangle className="h-6 w-6" />}
                tone="error"
              />
            </div>
          ) : isLoading ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <ChatState
                title="Načítám zprávy"
                description="Připravuji bezpečné chat rozhraní a synchronizuji dostupné zprávy."
                icon={<MessageCircleHeart className="h-6 w-6" />}
              />
            </div>
          ) : (
            <>
              <ChatMessageList
                messages={visibleMessages}
                hasMore={isSearchMode ? false : hasMoreMessages}
                onLoadMore={isSearchMode ? undefined : onLoadMore}
                onDeleteMessage={onDeleteMessage}
                onToggleHeart={onToggleHeart}
                onReplyMessage={onReplyMessage}
                unreadCount={isSearchMode ? 0 : unreadScrolledMessageCount}
                onAtBottomChange={isSearchMode ? undefined : onMessageListBottomChange}
                viewerRole={viewerRole}
                isSearchMode={isSearchMode}
                isSearching={isSearching}
                searchQuery={searchQuery}
                searchError={searchError}
              />
              <ChatComposer
                onSendMessage={onSendMessage}
                replyToMessage={replyToMessage}
                onCancelReply={onCancelReply}
                socket={socket}
              />
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
