import { create } from 'zustand';

type ChatNotificationsState = {
  unreadMessageIds: string[];
  unreadCount: number;
  setUnreadMessageIds: (messageIds: string[]) => void;
  addUnreadMessage: (messageId: string) => void;
  removeUnreadMessage: (messageId: string) => void;
  clearUnreadMessages: () => void;
};

function uniqueMessageIds(messageIds: string[]) {
  return Array.from(new Set(messageIds.filter(Boolean)));
}

export const useChatNotificationsStore = create<ChatNotificationsState>((set) => ({
  unreadMessageIds: [],
  unreadCount: 0,

  setUnreadMessageIds: (messageIds) => {
    const unreadMessageIds = uniqueMessageIds(messageIds);
    set({ unreadMessageIds, unreadCount: unreadMessageIds.length });
  },

  addUnreadMessage: (messageId) =>
    set((state) => {
      if (!messageId || state.unreadMessageIds.includes(messageId)) {
        return state;
      }

      const unreadMessageIds = [...state.unreadMessageIds, messageId];
      return { unreadMessageIds, unreadCount: unreadMessageIds.length };
    }),

  removeUnreadMessage: (messageId) =>
    set((state) => {
      const unreadMessageIds = state.unreadMessageIds.filter((id) => id !== messageId);
      return { unreadMessageIds, unreadCount: unreadMessageIds.length };
    }),

  clearUnreadMessages: () => set({ unreadMessageIds: [], unreadCount: 0 }),
}));
