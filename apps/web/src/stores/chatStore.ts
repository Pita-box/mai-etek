import { create } from 'zustand';
import type { ChatMessageItem } from '@/types/chat';
import type { ChatMessageReactionSummary } from '@maietek/types';

type ChatMessageReactionPatch = Omit<ChatMessageReactionSummary, 'reactedByViewer'> & {
  reactedByViewer?: boolean;
};

interface ChatState {
  // Data
  messages: ChatMessageItem[];
  isTyping: boolean;
  typingUserName: string | null;
  isPartnerOnline: boolean;
  hasMoreMessages: boolean;
  nextCursor: string | null;

  // Actions
  setMessages: (messages: ChatMessageItem[]) => void;
  addMessage: (message: ChatMessageItem) => void;
  prependMessages: (messages: ChatMessageItem[], hasMore: boolean, nextCursor: string | null) => void;
  removeMessage: (messageId: string) => void;
  updateMessageRead: (messageId: string, readAt: string) => void;
  updateMessageReaction: (messageId: string, reaction: ChatMessageReactionPatch) => void;
  markAllAsRead: () => void;
  setTyping: (isTyping: boolean, userName?: string | null) => void;
  setPartnerOnline: (isOnline: boolean) => void;
  reset: () => void;
}

const initialState = {
  messages: [] as ChatMessageItem[],
  isTyping: false,
  typingUserName: null as string | null,
  isPartnerOnline: false,
  hasMoreMessages: false,
  nextCursor: null as string | null,
};

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,

  setMessages: (messages) =>
    set({ messages }),

  addMessage: (message) =>
    set((state) => {
      // Deduplikace – pokud zpráva s tímto ID již existuje, neřidáme
      if (state.messages.some((m) => m.id === message.id)) {
        return state;
      }
      return { messages: [...state.messages, message] };
    }),

  prependMessages: (messages, hasMore, nextCursor) =>
    set((state) => {
      // Deduplikace
      const existingIds = new Set(state.messages.map((m) => m.id));
      const newMessages = messages.filter((m) => !existingIds.has(m.id));
      return {
        messages: [...newMessages, ...state.messages],
        hasMoreMessages: hasMore,
        nextCursor,
      };
    }),

  removeMessage: (messageId) =>
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== messageId),
    })),

  updateMessageRead: (messageId, readAt) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, isRead: true, readAt } : m
      ),
    })),

  updateMessageReaction: (messageId, reaction) =>
    set((state) => ({
      messages: state.messages.map((message) => {
        if (message.id !== messageId) {
          return message;
        }

        const currentReactions = message.reactions || [];
        const existingReaction = currentReactions.find((item) => item.emoji === reaction.emoji);
        const nextReaction: ChatMessageReactionSummary = {
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
      }),
    })),

  markAllAsRead: () =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.isOwnMessage ? m : { ...m, isRead: true }
      ),
    })),

  setTyping: (isTyping, userName = null) =>
    set({ isTyping, typingUserName: userName }),

  setPartnerOnline: (isOnline) =>
    set({ isPartnerOnline: isOnline }),

  reset: () => set(initialState),
}));
