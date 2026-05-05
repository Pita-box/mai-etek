'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, MessageSquareText, ChevronDown } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ChatMessageItem } from '@/types/chat';
import { ChatMessageBubble } from './ChatMessageBubble';
import { ChatState } from './ChatState';
import { DateSeparator } from './DateSeparator';
import { cn } from '@/lib/utils';

type ChatMessageListProps = {
  messages: ChatMessageItem[];
  hasMore?: boolean;
  onLoadMore?: () => Promise<void>;
  onDeleteMessage?: (messageId: string) => Promise<void>;
  onToggleHeart?: (messageId: string) => Promise<void>;
  onReplyMessage?: (message: ChatMessageItem) => void;
  unreadCount?: number;
  onAtBottomChange?: (isAtBottom: boolean) => void;
  viewerRole?: 'dom' | 'sub' | 'unassigned' | null;
  isSearchMode?: boolean;
  isSearching?: boolean;
  searchQuery?: string;
  searchError?: string | null;
};

function isSameDay(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function formatUnreadCount(count: number) {
  const cappedCount = count > 99 ? '99+' : String(count);

  if (count === 1) return '1 nová zpráva';
  if (count > 1 && count < 5) return `${cappedCount} nové zprávy`;
  return `${cappedCount} nových zpráv`;
}

export function ChatMessageList({
  messages,
  hasMore = false,
  onLoadMore,
  onDeleteMessage,
  onToggleHeart,
  onReplyMessage,
  unreadCount = 0,
  onAtBottomChange,
  viewerRole,
  isSearchMode = false,
  isSearching = false,
  searchQuery = '',
  searchError = null,
}: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const isAtBottomRef = useRef(true);
  const onAtBottomChangeRef = useRef(onAtBottomChange);
  const lastNotifiedAtBottomRef = useRef<boolean | null>(null);
  const prevMessagesLengthRef = useRef(messages.length);

  useEffect(() => {
    onAtBottomChangeRef.current = onAtBottomChange;
  }, [onAtBottomChange]);

  const syncAtBottomState = useCallback((atBottom: boolean) => {
    isAtBottomRef.current = atBottom;
    setShowScrollDown(!atBottom);

    if (lastNotifiedAtBottomRef.current !== atBottom) {
      lastNotifiedAtBottomRef.current = atBottom;
      onAtBottomChangeRef.current?.(atBottom);
    }
  }, []);

  // Auto scroll na konec při nové zprávě (pokud jsme na dně)
  useEffect(() => {
    if (messages.length > prevMessagesLengthRef.current && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      syncAtBottomState(true);
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages.length, syncAtBottomState]);

  // Initial scroll na konec
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    const frame = requestAnimationFrame(() => {
      syncAtBottomState(true);
    });

    return () => cancelAnimationFrame(frame);
  }, [syncAtBottomState]);

  const readCurrentScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;

    return el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    syncAtBottomState(readCurrentScrollState());

    // Infinite scroll – load more při scrollu nahoru
    if (el.scrollTop < 100 && hasMore && !isLoadingMore && onLoadMore) {
      const prevScrollHeight = el.scrollHeight;
      setIsLoadingMore(true);
      onLoadMore().finally(() => {
        setIsLoadingMore(false);
        // Udržet scroll position po načtení starších zpráv
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeight;
            syncAtBottomState(readCurrentScrollState());
          }
        });
      });
    }
  }, [hasMore, isLoadingMore, onLoadMore, readCurrentScrollState, syncAtBottomState]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    requestAnimationFrame(() => {
      syncAtBottomState(readCurrentScrollState());
    });
    window.setTimeout(() => {
      syncAtBottomState(readCurrentScrollState());
    }, 320);
  };

  if (isSearchMode && isSearching && messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <ChatState
          title="Hledám zprávy"
          description="Procházím dostupnou konverzaci."
          icon={<Loader2 className="h-6 w-6 animate-spin" />}
          className="min-h-[280px]"
        />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        {isSearchMode ? (
          <EmptyState
            icon={MessageSquareText}
            title={searchError ? "Hledání selhalo" : "V chatu není žádná shoda"}
            description={searchError || `Pro výraz „${searchQuery.trim()}” není v chatu žádná shoda.`}
            variant={searchError ? "danger" : "compact"}
            className="min-h-[280px]"
          />
        ) : (
          <EmptyState
            icon={MessageSquareText}
            title="Konverzace zatím čeká na první zprávu"
            description="Pošli první zprávu a otevři soukromý komunikační kanál."
            variant="compact"
            className="min-h-[280px]"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 flex flex-col gap-3 overflow-y-auto px-4 py-4 md:px-6"
      >
        {/* Loading more indicator */}
        {isLoadingMore && !isSearchMode && (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary/70" />
            <span className="ml-2 text-xs text-slate-400">Načítám starší zprávy…</span>
          </div>
        )}

        {/* Messages with date separators */}
        {messages.map((message, index) => {
          const showDateSeparator =
            index === 0 || !isSameDay(messages[index - 1].createdAt, message.createdAt);

          return (
            <div key={message.id}>
              {showDateSeparator && <DateSeparator date={message.createdAt} />}
              <ChatMessageBubble
                message={message}
                onDelete={onDeleteMessage ? () => onDeleteMessage(message.id) : undefined}
                onToggleHeart={onToggleHeart ? () => onToggleHeart(message.id) : undefined}
                onReply={onReplyMessage ? () => onReplyMessage(message) : undefined}
                viewerRole={viewerRole}
              />
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollDown && (
        <button
          type="button"
          onClick={scrollToBottom}
          className={cn(
            "absolute bottom-4 right-4 z-10 flex h-10 cursor-pointer items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-400 focus:outline-none focus:ring-2 focus:ring-primary/60",
            unreadCount > 0
              ? "gap-2 border-primary/30 bg-primary px-3 text-primary-foreground hover:bg-primary/90"
              : "w-10 border-white/10 bg-black/80 text-zinc-300 hover:border-primary/30 hover:bg-primary/10 hover:text-primary",
          )}
          aria-label={unreadCount > 0 ? formatUnreadCount(unreadCount) : 'Přejít na konec chatu'}
          title={unreadCount > 0 ? formatUnreadCount(unreadCount) : 'Přejít na konec chatu'}
        >
          {unreadCount > 0 ? (
            <span className="text-xs font-semibold">{formatUnreadCount(unreadCount)}</span>
          ) : null}
          <ChevronDown className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
