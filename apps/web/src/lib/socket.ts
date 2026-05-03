import { io, Socket } from 'socket.io-client';
import type {
  ChatSocketClientEvents,
  ChatSocketServerEvents,
} from '@maietek/types';
import { getSocketBaseUrl } from './api-url';

export type ChatSocket = Socket<ChatSocketServerEvents, ChatSocketClientEvents>;

let chatSocket: ChatSocket | null = null;
let chatSocketToken: string | null = null;
let chatSocketRefs = 0;
let lastSocketConnectionWarningAt = 0;

function logSocketConnectionWarning(message: string) {
  const now = Date.now();
  if (now - lastSocketConnectionWarningAt < 30_000) return;

  lastSocketConnectionWarningAt = now;
  console.warn('[Socket.IO] Připojení k chatu není dostupné, zkouším znovu:', message);
}

/**
 * Vrátí singleton Socket.IO klient pro /chat namespace.
 * Při prvním volání vytvoří nové připojení s JWT tokenem.
 */
export function getChatSocket(token: string): ChatSocket {
  if (chatSocket && chatSocketToken === token) {
    return chatSocket;
  }

  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }

  chatSocketToken = token;
  chatSocket = io(`${getSocketBaseUrl()}/chat`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
    autoConnect: true,
  });

  chatSocket.on('connect', () => {
    console.log('[Socket.IO] Připojeno k /chat namespace');
  });

  chatSocket.on('disconnect', (reason) => {
    console.log(`[Socket.IO] Odpojeno: ${reason}`);
  });

  chatSocket.on('connect_error', (error) => {
    logSocketConnectionWarning(error.message);
  });

  return chatSocket;
}

export function retainChatSocket(token: string): ChatSocket {
  const socket = getChatSocket(token);
  chatSocketRefs += 1;
  return socket;
}

export function releaseChatSocket(): void {
  chatSocketRefs = Math.max(0, chatSocketRefs - 1);

  if (chatSocketRefs === 0) {
    disconnectChatSocket();
  }
}

/**
 * Odpojí a zničí singleton socket.
 */
export function disconnectChatSocket(): void {
  if (chatSocket) {
    chatSocket.disconnect();
    chatSocket = null;
  }
  chatSocketToken = null;
  chatSocketRefs = 0;
}

/**
 * Vrátí aktuální socket instanci (nebo null pokud není připojen).
 */
export function getCurrentChatSocket(): ChatSocket | null {
  return chatSocket;
}
