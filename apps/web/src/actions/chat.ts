"use server";

import type {
  ChatMessage,
  CreateChatMessageRequest,
  CreateChatMessageResponse,
  PaginatedChatMessagesResponse,
  SearchChatMessagesResponse,
  ChatUnreadSummaryResponse,
  DeleteChatMessageResponse,
  MarkMessageReadResponse,
  ToggleChatReactionResponse,
} from '@maietek/types';
import { createClient } from '@/utils/supabase/server';
import { uploadChatFileToDrive } from '@/lib/google-drive/chat';
import { getServerApiBaseUrl } from '@/lib/server-api-url';
import type { ChatMessageItem, SendChatMessageInput } from '@/types/chat';

const CHAT_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
const CHAT_THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
const CHAT_API_TIMEOUT_MS = 15_000;

async function fetchChatApi<T>(endpoint: string, accessToken: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${accessToken}`);

  if (!headers.has('Content-Type') && options.body instanceof URLSearchParams === false) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${getServerApiBaseUrl()}${endpoint}`, {
    ...options,
    headers,
    cache: 'no-store',
    signal: options.signal ?? AbortSignal.timeout(CHAT_API_TIMEOUT_MS),
  });

  if (!response.ok) {
    let errorMessage = 'Požadavek na chat API selhal.';
    try {
      const data = await response.json();
      errorMessage = data.error || errorMessage;
    } catch {
      // Response nemusí být JSON.
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<T>;
}

function normalizeChatMessage(message: ChatMessage, viewerId: string): ChatMessageItem {
  const isOwnMessage = message.sender.id === viewerId;

  return {
    ...message,
    isOwnMessage,
    alignment: isOwnMessage ? 'end' : 'start',
  };
}

export async function getChatMessages(options?: { before?: string; limit?: number }) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      error: 'Not authenticated',
      messages: [] as ChatMessageItem[],
      participants: [],
      viewerId: null,
      viewerRole: null,
      hasMore: false,
      nextCursor: null,
    };
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.before) params.set('before', options.before);

    const qs = params.toString();
    const url = `/chat/messages${qs ? `?${qs}` : ''}`;

    const response = await fetchChatApi<PaginatedChatMessagesResponse>(url, session.access_token);

    return {
      messages: response.messages.map((message) => normalizeChatMessage(message, session.user.id)),
      participants: response.participants,
      viewerId: session.user.id,
      viewerRole: profile?.role as 'dom' | 'sub' | 'unassigned' | null,
      hasMore: response.hasMore,
      nextCursor: response.nextCursor,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se načíst zprávy.',
      messages: [] as ChatMessageItem[],
      participants: [],
      viewerId: session.user.id,
      viewerRole: null,
      hasMore: false,
      nextCursor: null,
    };
  }
}

export async function sendChatMessage(input: SendChatMessageInput) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const payload: CreateChatMessageRequest = {
    type: input.type,
    text: input.text?.trim() || null,
    media: input.media || null,
    replyToMessageId: input.replyToMessageId || null,
  };

  try {
    const response = await fetchChatApi<CreateChatMessageResponse>('/chat/messages', session.access_token, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    return {
      message: normalizeChatMessage(response.message, session.user.id),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se odeslat zprávu.',
    };
  }
}

export async function searchChatMessages(query: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated', messages: [] as ChatMessageItem[] };
  }

  const trimmedQuery = query.trim();
  if (trimmedQuery.length < 3) {
    return { messages: [] as ChatMessageItem[] };
  }

  try {
    const params = new URLSearchParams({ q: trimmedQuery });
    const response = await fetchChatApi<SearchChatMessagesResponse>(`/chat/messages/search?${params.toString()}`, session.access_token);

    return {
      messages: response.messages.map((message) => normalizeChatMessage(message, session.user.id)),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se vyhledat zprávy.',
      messages: [] as ChatMessageItem[],
    };
  }
}

export async function getChatUnreadSummary() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated', count: 0, messageIds: [] as string[], viewerId: null };
  }

  try {
    const response = await fetchChatApi<ChatUnreadSummaryResponse>('/chat/messages/unread', session.access_token);

    return {
      count: response.count,
      messageIds: response.messageIds,
      viewerId: session.user.id,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se načíst nepřečtené zprávy.',
      count: 0,
      messageIds: [] as string[],
      viewerId: session.user.id,
    };
  }
}

export async function uploadChatMedia(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  const file = formData.get('file');
  const thumbnail = formData.get('thumbnail');

  if (!(file instanceof File)) {
    return { error: 'Nenalezen žádný soubor.' };
  }

  const thumbnailFile = thumbnail instanceof File ? thumbnail : null;

  if (thumbnail !== null && !(thumbnail instanceof File)) {
    return { error: 'Neplatný náhled média.' };
  }

  if (file.size > CHAT_MEDIA_MAX_BYTES) {
    return { error: 'Soubor je příliš velký (max 50 MB).' };
  }

  if (thumbnailFile && thumbnailFile.size > CHAT_THUMBNAIL_MAX_BYTES) {
    return { error: 'Náhled videa je příliš velký.' };
  }

  const isSupported =
    file.type.startsWith('image/') ||
    file.type.startsWith('video/') ||
    file.type.startsWith('audio/');

  if (!isSupported) {
    return { error: 'Nepodporovaný typ souboru.' };
  }

  if (thumbnailFile && !thumbnailFile.type.startsWith('image/')) {
    return { error: 'Náhled videa musí být obrázek.' };
  }

  try {
    const uploadDate = new Date();
    const uploaded = await uploadChatFileToDrive({ file, date: uploadDate });
    const uploadedThumbnail = file.type.startsWith('video/') && thumbnailFile
      ? await uploadChatFileToDrive({ file: thumbnailFile, date: uploadDate })
      : null;

    return {
      url: uploaded.proxyUrl,
      thumbnailUrl: uploadedThumbnail?.proxyUrl ?? uploaded.thumbnailProxyUrl,
      driveFileId: uploaded.driveFileId,
      driveWebViewLink: uploaded.driveWebViewLink,
      mimeType: uploaded.mimeType,
      sizeBytes: uploaded.sizeBytes,
    };
  } catch (error) {
    console.error('Error uploading chat media:', error);
    return { error: error instanceof Error ? error.message : 'Nahrávání selhalo.' };
  }
}

export async function deleteChatMessage(messageId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  try {
    const response = await fetchChatApi<DeleteChatMessageResponse>(`/chat/messages/${messageId}`, session.access_token, {
      method: 'DELETE',
    });

    return { deleted: response.deleted };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se smazat zprávu.',
    };
  }
}

export async function markMessageAsRead(messageId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  try {
    const response = await fetchChatApi<MarkMessageReadResponse>(`/chat/messages/${messageId}/read`, session.access_token, {
      method: 'POST',
    });

    return { messageId: response.messageId, readAt: response.readAt };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se označit zprávu.',
    };
  }
}

export async function toggleChatMessageHeart(messageId: string) {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { error: 'Not authenticated' };
  }

  try {
    const response = await fetchChatApi<ToggleChatReactionResponse>(`/chat/messages/${messageId}/reactions/heart`, session.access_token, {
      method: 'POST',
    });

    return response;
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Nepodařilo se upravit reakci.',
    };
  }
}
