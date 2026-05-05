'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { sendChatMessage, getChatMessages, deleteChatMessage, markMessageAsRead, toggleChatMessageHeart, searchChatMessages } from '@/actions/chat';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useToast } from '@/components/shared/useToast';
import { useSocket } from '@/hooks/useSocket';
import { useChatStore } from '@/stores/chatStore';
import { useChatNotificationsStore } from '@/stores/chatNotificationsStore';
import type { ChatMessageItem, ChatParticipantSummary } from '@/types/chat';
import type { ChatMessage } from '@maietek/types';

type ChatPageClientProps = {
  initialMessages: ChatMessageItem[];
  initialParticipants?: ChatParticipantSummary[];
  initialError?: string | null;
  viewerId?: string | null;
  viewerRole?: 'dom' | 'sub' | 'unassigned' | null;
  initialHasMore?: boolean;
  initialNextCursor?: string | null;
};

/**
 * Normalizuje ChatMessage z Socket.IO eventu do ChatMessageItem.
 * viewerId je potřeba pro isOwnMessage/alignment.
 */
function normalizeSocketMessage(message: ChatMessage, viewerId: string): ChatMessageItem {
  const isOwnMessage = message.sender.id === viewerId;
  return {
    ...message,
    isOwnMessage,
    alignment: isOwnMessage ? 'end' : 'start',
  };
}

export function ChatPageClient({
  initialMessages,
  initialParticipants = [],
  initialError = null,
  viewerId = null,
  viewerRole = null,
  initialHasMore = false,
  initialNextCursor = null,
}: ChatPageClientProps) {
  const toast = useToast();
  const { socket, isConnected } = useSocket();
  const viewerIdRef = useRef(viewerId);
  const onlineUserIdsRef = useRef(new Set<string>());
  const readSyncRef = useRef(new Set<string>());
  const searchRequestIdRef = useRef(0);
  const isMessageListAtBottomRef = useRef(true);
  const [participants, setParticipants] = useState(initialParticipants);
  const [replyToMessage, setReplyToMessage] = useState<ChatMessageItem | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessageItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isMessageListAtBottom, setIsMessageListAtBottom] = useState(true);

  // Zustand store
  const messages = useChatStore((s) => s.messages);
  const isTyping = useChatStore((s) => s.isTyping);
  const typingUserName = useChatStore((s) => s.typingUserName);
  const isPartnerOnline = useChatStore((s) => s.isPartnerOnline);
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages);

  const setMessages = useChatStore((s) => s.setMessages);
  const addMessage = useChatStore((s) => s.addMessage);
  const prependMessages = useChatStore((s) => s.prependMessages);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const updateMessageRead = useChatStore((s) => s.updateMessageRead);
  const updateMessageReaction = useChatStore((s) => s.updateMessageReaction);
  const setTyping = useChatStore((s) => s.setTyping);
  const setPartnerOnline = useChatStore((s) => s.setPartnerOnline);
  const reset = useChatStore((s) => s.reset);
  const addUnreadMessage = useChatNotificationsStore((s) => s.addUnreadMessage);

  const syncPartnerPresence = useCallback((lastOnlineByUserId: Record<string, string | null> = {}) => {
    const vid = viewerIdRef.current;
    if (!vid) return;

    setPartnerOnline(Array.from(onlineUserIdsRef.current).some((userId) => userId !== vid));
    setParticipants((currentParticipants) =>
      currentParticipants.map((participant) => ({
        ...participant,
        isOnline: onlineUserIdsRef.current.has(participant.id),
        lastOnlineAt: lastOnlineByUserId[participant.id] ?? participant.lastOnlineAt,
      }))
    );
  }, [setPartnerOnline]);

  const partner = useMemo(() => {
    const participant = participants.find((item) => item.id !== viewerId);

    if (participant) {
      return participant;
    }

    const partnerMessage = messages.find((message) => !message.isOwnMessage);

    if (!partnerMessage) {
      return null;
    }

    return {
      id: partnerMessage.sender.id,
      fullName: partnerMessage.sender.fullName,
      role: partnerMessage.sender.role,
      isOnline: isPartnerOnline,
      lastOnlineAt: partnerMessage.sender.lastOnlineAt ?? null,
    };
  }, [participants, messages, isPartnerOnline, viewerId]);

  const markVisibleMessagesAsRead = useCallback(() => {
    if (
      !viewerIdRef.current ||
      document.visibilityState === 'hidden' ||
      isSearchOpen ||
      !isMessageListAtBottomRef.current
    ) {
      return;
    }

    const unreadPartnerMessages = useChatStore.getState().messages.filter((message) => (
      !message.isOwnMessage && !message.isRead && !readSyncRef.current.has(message.id)
    ));

    unreadPartnerMessages.forEach((message) => {
      readSyncRef.current.add(message.id);

      markMessageAsRead(message.id)
        .then((result) => {
          if (result?.readAt) {
            updateMessageRead(message.id, result.readAt);
            return;
          }

          readSyncRef.current.delete(message.id);
        })
        .catch(() => {
          readSyncRef.current.delete(message.id);
        });
    });
  }, [isSearchOpen, updateMessageRead]);

  const handleMessageListBottomChange = useCallback((isAtBottom: boolean) => {
    isMessageListAtBottomRef.current = isAtBottom;
    setIsMessageListAtBottom(isAtBottom);

    if (isAtBottom) {
      requestAnimationFrame(() => {
        markVisibleMessagesAsRead();
      });
    }
  }, [markVisibleMessagesAsRead]);

  const closeSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setIsSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setIsSearching(false);
  }, []);

  const toggleSearch = useCallback(() => {
    if (isSearchOpen) {
      closeSearch();
      return;
    }

    setIsSearchOpen(true);
  }, [closeSearch, isSearchOpen]);

  const updateSearchResultRead = useCallback((messageId: string, readAt: string) => {
    setSearchResults((currentResults) =>
      currentResults.map((message) =>
        message.id === messageId ? { ...message, isRead: true, readAt } : message
      )
    );
  }, []);

  const updateSearchResultReaction = useCallback((
    messageId: string,
    reaction: { emoji: 'heart'; count: number; reactedByViewer?: boolean },
  ) => {
    setSearchResults((currentResults) =>
      currentResults.map((message) => {
        if (message.id !== messageId) return message;

        const currentReactions = message.reactions || [];
        const existingReaction = currentReactions.find((item) => item.emoji === reaction.emoji);
        const nextReaction = {
          emoji: reaction.emoji,
          count: reaction.count,
          reactedByViewer: reaction.reactedByViewer ?? existingReaction?.reactedByViewer ?? false,
        };
        const otherReactions = currentReactions.filter((item) => item.emoji !== reaction.emoji);

        return {
          ...message,
          reactions: nextReaction.count > 0 || nextReaction.reactedByViewer
            ? [...otherReactions, nextReaction]
            : otherReactions,
        };
      })
    );
  }, []);

  const unreadScrolledMessageCount = useMemo(() => {
    if (isSearchOpen || isMessageListAtBottom) return 0;

    return messages.filter((message) => !message.isOwnMessage && !message.isRead).length;
  }, [messages, isMessageListAtBottom, isSearchOpen]);

  // Inicializace store z server-side dat
  useEffect(() => {
    setMessages(initialMessages);
    useChatStore.setState({
      hasMoreMessages: initialHasMore,
      nextCursor: initialNextCursor,
    });

    return () => {
      reset();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSearchOpen) {
      searchRequestIdRef.current += 1;
      const resetSearchingTimeout = window.setTimeout(() => {
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(resetSearchingTimeout);
    }

    const query = searchQuery.trim();
    const requestId = searchRequestIdRef.current + 1;
    searchRequestIdRef.current = requestId;

    if (query.length < 3) {
      const resetSearchTimeout = window.setTimeout(() => {
        setSearchResults([]);
        setSearchError(null);
        setIsSearching(false);
      }, 0);
      return () => window.clearTimeout(resetSearchTimeout);
    }

    const searchingStateTimeout = window.setTimeout(() => {
      setIsSearching(true);
      setSearchError(null);
    }, 0);

    const timeout = window.setTimeout(() => {
      searchChatMessages(query)
        .then((result) => {
          if (searchRequestIdRef.current !== requestId) return;

          if (result.error) {
            setSearchResults([]);
            setSearchError(result.error);
            return;
          }

          setSearchResults(result.messages);
        })
        .catch((error) => {
          if (searchRequestIdRef.current !== requestId) return;
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : 'Nepodařilo se vyhledat zprávy.');
        })
        .finally(() => {
          if (searchRequestIdRef.current === requestId) {
            setIsSearching(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(searchingStateTimeout);
      window.clearTimeout(timeout);
    };
  }, [isSearchOpen, searchQuery]);

  // Socket.IO event subscriptions
  useEffect(() => {
    if (!socket || !viewerIdRef.current) return;
    const vid = viewerIdRef.current;

    const handlePresenceSync = (data: { onlineUserIds: string[]; lastOnlineByUserId?: Record<string, string | null> }) => {
      onlineUserIdsRef.current = new Set(data.onlineUserIds.filter((userId) => userId !== vid));
      syncPartnerPresence(data.lastOnlineByUserId);
    };

    const handleNewMessage = (data: { message: ChatMessage }) => {
      const normalized = normalizeSocketMessage(data.message, vid);
      addMessage(normalized);

      if (!normalized.isOwnMessage && !normalized.isRead && (isSearchOpen || !isMessageListAtBottomRef.current)) {
        addUnreadMessage(normalized.id);
      }

      // Typing se automaticky zastaví po nové zprávě
      setTyping(false);
    };

    const handleTyping = (data: { userId: string; userName: string }) => {
      if (data.userId !== vid) {
        setTyping(true, data.userName);
      }
    };

    const handleStopTyping = (data: { userId: string }) => {
      if (data.userId !== vid) {
        setTyping(false);
      }
    };

    const handleMessageRead = (data: { messageId: string; readAt: string }) => {
      updateMessageRead(data.messageId, data.readAt);
      updateSearchResultRead(data.messageId, data.readAt);
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      removeMessage(data.messageId);
      setSearchResults((currentResults) => currentResults.filter((message) => message.id !== data.messageId));
      setReplyToMessage((current) => current?.id === data.messageId ? null : current);
    };

    const handleMessageReaction = (data: { messageId: string; emoji: 'heart'; count: number; userId: string; isReacted: boolean }) => {
      updateMessageReaction(data.messageId, {
        emoji: data.emoji,
        count: data.count,
        reactedByViewer: data.userId === vid ? data.isReacted : undefined,
      });
      updateSearchResultReaction(data.messageId, {
        emoji: data.emoji,
        count: data.count,
        reactedByViewer: data.userId === vid ? data.isReacted : undefined,
      });
    };

    const handleUserOnline = (data: { userId: string; lastOnlineAt?: string | null }) => {
      if (data.userId !== vid) {
        onlineUserIdsRef.current.add(data.userId);
        syncPartnerPresence(data.lastOnlineAt ? { [data.userId]: data.lastOnlineAt } : undefined);
      }
    };

    const handleUserOffline = (data: { userId: string; lastOnlineAt: string }) => {
      if (data.userId !== vid) {
        onlineUserIdsRef.current.delete(data.userId);
        syncPartnerPresence({ [data.userId]: data.lastOnlineAt });
      }
    };

    socket.on('presence:sync', handlePresenceSync);
    socket.on('message:new', handleNewMessage);
    socket.on('message:typing', handleTyping);
    socket.on('message:stop-typing', handleStopTyping);
    socket.on('message:read', handleMessageRead);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('message:reaction', handleMessageReaction);
    socket.on('user:online', handleUserOnline);
    socket.on('user:offline', handleUserOffline);
    socket.emit('presence:get');

    return () => {
      socket.off('presence:sync', handlePresenceSync);
      socket.off('message:new', handleNewMessage);
      socket.off('message:typing', handleTyping);
      socket.off('message:stop-typing', handleStopTyping);
      socket.off('message:read', handleMessageRead);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('message:reaction', handleMessageReaction);
      socket.off('user:online', handleUserOnline);
      socket.off('user:offline', handleUserOffline);
    };
  }, [socket, addMessage, addUnreadMessage, isSearchOpen, removeMessage, updateMessageRead, updateMessageReaction, updateSearchResultRead, updateSearchResultReaction, setTyping, syncPartnerPresence]);

  useEffect(() => {
    markVisibleMessagesAsRead();
  }, [messages, markVisibleMessagesAsRead]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markVisibleMessagesAsRead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [markVisibleMessagesAsRead]);

  // Odeslání zprávy (REST + socket broadcast na serveru)
  const handleSendMessage = useCallback(async (
    text: string,
    attachment?: { type: 'image' | 'video' | 'voice'; url: string; thumbnailUrl?: string | null },
    replyToMessageId?: string | null,
  ) => {
    const type = attachment ? attachment.type : 'text';
    const result = await sendChatMessage({ 
      type, 
      text: text || null,
      media: attachment ? { url: attachment.url, thumbnailUrl: attachment.thumbnailUrl ?? null } : undefined,
      replyToMessageId: replyToMessageId || null,
    });

    if (result?.error) {
      return result.error;
    }

    // Zpráva přijde zpět přes Socket.IO event (message:new),
    // ale pro případ výpadku socketu ji přidáme i lokálně
    if (result?.message) {
      addMessage(result.message);
    }

    setReplyToMessage(null);

    return null;
  }, [addMessage]);

  // Smazání zprávy (DOM only)
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    // Optimisticky schováme zprávu (pokud chyba, necháme tak, nebo lépe: mažeme po úspěchu)
    const result = await deleteChatMessage(messageId);
    if (result?.error) {
      toast.error('Zprávu se nepodařilo smazat.', result.error);
      return;
    }

    if (!result?.error) {
      removeMessage(messageId);
      setSearchResults((currentResults) => currentResults.filter((message) => message.id !== messageId));
      toast.success('Zpráva byla smazána.');
    }
  }, [removeMessage, toast]);

  const handleToggleHeart = useCallback(async (messageId: string) => {
    const result = await toggleChatMessageHeart(messageId);
    if ('error' in result && result.error) {
      toast.error('Reakci se nepodařilo uložit.', result.error);
      return;
    }

    if (result && 'reaction' in result) {
      updateMessageReaction(messageId, result.reaction);
      updateSearchResultReaction(messageId, result.reaction);
    }
  }, [toast, updateMessageReaction, updateSearchResultReaction]);

  // Načtení starších zpráv (paginace)
  const handleLoadMore = useCallback(async () => {
    const { nextCursor } = useChatStore.getState();
    if (!nextCursor) return;

    const result = await getChatMessages({ before: nextCursor, limit: 30 });
    if (result.error) {
      toast.error('Starší zprávy se nepodařilo načíst.', result.error);
      return;
    }

    if (result.messages.length > 0) {
      prependMessages(result.messages, result.hasMore, result.nextCursor ?? null);
    }
  }, [prependMessages, toast]);

  return (
    <ChatPanel
      messages={messages}
      partnerName={partner?.fullName ?? null}
      partnerLastOnlineAt={partner?.lastOnlineAt ?? null}
      onSendMessage={handleSendMessage}
      onLoadMore={handleLoadMore}
      onDeleteMessage={handleDeleteMessage}
      onToggleHeart={handleToggleHeart}
      onReplyMessage={setReplyToMessage}
      unreadScrolledMessageCount={unreadScrolledMessageCount}
      onMessageListBottomChange={handleMessageListBottomChange}
      replyToMessage={replyToMessage}
      onCancelReply={() => setReplyToMessage(null)}
      isSearchOpen={isSearchOpen}
      searchQuery={searchQuery}
      searchResults={searchResults}
      isSearching={isSearching}
      searchError={searchError}
      onToggleSearch={toggleSearch}
      onCloseSearch={closeSearch}
      onSearchQueryChange={setSearchQuery}
      viewerRole={viewerRole}
      error={initialError}
      isTyping={isTyping}
      typingUserName={typingUserName}
      isPartnerOnline={isPartnerOnline}
      isConnected={isConnected}
      hasMoreMessages={hasMoreMessages}
      socket={socket}
    />
  );
}
