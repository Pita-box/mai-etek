export type ChatMessageType = 'text' | 'image' | 'video' | 'voice' | 'system';

export interface ChatMessageMedia {
  url: string;
  thumbnailUrl?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  durationSeconds?: number | null;
}

export interface ChatMessageRecord {
  id: string;
  senderId: string;
  type: ChatMessageType;
  content: string | null;
  mediaUrl: string | null;
  mediaThumbnailUrl: string | null;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface ChatMessageSender {
  id: string;
  fullName: string;
  role: 'dom' | 'sub' | 'unassigned';
  lastOnlineAt?: string | null;
}

export type ChatReactionEmoji = 'heart';

export interface ChatMessageReactionSummary {
  emoji: ChatReactionEmoji;
  count: number;
  reactedByViewer: boolean;
}

export interface ChatMessageReplyPreview {
  id: string;
  type: ChatMessageType;
  text: string | null;
  media: ChatMessageMedia | null;
  createdAt: string;
  sender: ChatMessageSender;
}

export interface ChatMessage {
  id: string;
  type: ChatMessageType;
  text: string | null;
  media: ChatMessageMedia | null;
  replyTo: ChatMessageReplyPreview | null;
  reactions: ChatMessageReactionSummary[];
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  sender: ChatMessageSender;
}

export interface ListChatMessagesResponse {
  messages: ChatMessage[];
}

export interface SearchChatMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatUnreadSummaryResponse {
  count: number;
  messageIds: string[];
}

export interface CreateChatMessageRequest {
  type: Extract<ChatMessageType, 'text' | 'image' | 'video' | 'voice'>;
  text?: string | null;
  media?: ChatMessageMedia | null;
  replyToMessageId?: string | null;
}

export interface CreateChatMessageResponse {
  message: ChatMessage;
}

export interface ToggleChatReactionResponse {
  messageId: string;
  reaction: ChatMessageReactionSummary;
}

// ============================================
// Socket.IO Event Types
// ============================================

/** Eventy, které klient posílá serveru */
export interface ChatSocketClientEvents {
  'presence:get': () => void;
  'message:typing': () => void;
  'message:stop-typing': () => void;
  'message:read': (data: { messageId: string }) => void;
}

/** Eventy, které server posílá klientovi */
export interface ChatSocketServerEvents {
  'presence:sync': (data: { onlineUserIds: string[]; lastOnlineByUserId?: Record<string, string | null> }) => void;
  'message:new': (data: { message: ChatMessage }) => void;
  'message:read': (data: { messageId: string; readAt: string }) => void;
  'message:deleted': (data: { messageId: string }) => void;
  'message:reaction': (data: { messageId: string; emoji: ChatReactionEmoji; count: number; userId: string; isReacted: boolean }) => void;
  'message:typing': (data: { userId: string; userName: string }) => void;
  'message:stop-typing': (data: { userId: string }) => void;
  'user:online': (data: { userId: string; userName: string; lastOnlineAt?: string | null }) => void;
  'user:offline': (data: { userId: string; lastOnlineAt: string }) => void;
}

/** Paginované odpovědi zpráv */
export interface PaginatedChatMessagesResponse {
  messages: ChatMessage[];
  participants: ChatParticipantPresence[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface ChatParticipantPresence {
  id: string;
  fullName: string;
  role: 'dom' | 'sub' | 'unassigned';
  isOnline: boolean;
  lastOnlineAt: string | null;
}

/** Request pro smazání zprávy */
export interface DeleteChatMessageResponse {
  deleted: boolean;
}

/** Request pro označení zprávy jako přečtené */
export interface MarkMessageReadResponse {
  messageId: string;
  readAt: string;
}
