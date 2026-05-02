import type { ChatMessage, ChatMessageMedia, ChatMessageType, ChatParticipantPresence } from '@maietek/types';

export type ChatMessageItem = ChatMessage & {
  isOwnMessage: boolean;
  alignment: 'start' | 'end';
};

export type SendChatMessageInput = {
  type: Extract<ChatMessageType, 'text' | 'image' | 'video' | 'voice'>;
  text?: string | null;
  media?: ChatMessageMedia | null;
  replyToMessageId?: string | null;
};

export type ChatParticipantSummary = ChatParticipantPresence;
