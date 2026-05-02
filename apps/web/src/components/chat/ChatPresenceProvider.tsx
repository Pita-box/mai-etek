'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getChatUnreadSummary } from '@/actions/chat';
import { useSocket } from '@/hooks/useSocket';
import { useChatNotificationsStore } from '@/stores/chatNotificationsStore';
import type { ChatMessage } from '@maietek/types';

async function playUnreadBellSound() {
  try {
    const AudioContext = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
    if (!AudioContext) return false;

    const context = new AudioContext();

    if (context.state === 'suspended') {
      await context.resume();
    }

    if (context.state !== 'running') {
      await context.close().catch(() => undefined);
      return false;
    }

    const masterGain = context.createGain();
    masterGain.gain.setValueAtTime(0.0001, context.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.015);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.44);
    masterGain.connect(context.destination);

    const playTone = (frequency: number, startAt: number, duration: number) => {
      const oscillator = context.createOscillator();
      const toneGain = context.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.82, startAt + duration);
      toneGain.gain.setValueAtTime(0.0001, startAt);
      toneGain.gain.exponentialRampToValueAtTime(1, startAt + 0.012);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

      oscillator.connect(toneGain);
      toneGain.connect(masterGain);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration);
      return oscillator;
    };

    playTone(1046.5, context.currentTime, 0.18);
    const lastTone = playTone(1396.9, context.currentTime + 0.17, 0.24);

    return await new Promise<boolean>((resolve) => {
      lastTone.onended = () => {
        void context.close().catch(() => undefined);
        resolve(true);
      };

      window.setTimeout(() => {
        void context.close().catch(() => undefined);
        resolve(true);
      }, 520);
    });
  } catch {
    // Browser může zvuk blokovat bez předchozí interakce uživatele.
    return false;
  }
}

export function ChatPresenceProvider() {
  const { socket } = useSocket();
  const pathname = usePathname();
  const viewerIdRef = useRef<string | null>(null);
  const pendingSoundRef = useRef(false);
  const setUnreadMessageIds = useChatNotificationsStore((state) => state.setUnreadMessageIds);
  const addUnreadMessage = useChatNotificationsStore((state) => state.addUnreadMessage);
  const removeUnreadMessage = useChatNotificationsStore((state) => state.removeUnreadMessage);
  const clearUnreadMessages = useChatNotificationsStore((state) => state.clearUnreadMessages);

  const notifyUnreadMessage = useCallback(() => {
    if (window.location.pathname.startsWith('/chat')) {
      pendingSoundRef.current = false;
      return;
    }

    playUnreadBellSound().then((played) => {
      if (!played) {
        pendingSoundRef.current = true;
      }
    });
  }, []);

  useEffect(() => {
    const playPendingSound = () => {
      if (!pendingSoundRef.current) return;
      if (window.location.pathname.startsWith('/chat')) {
        pendingSoundRef.current = false;
        return;
      }

      pendingSoundRef.current = false;
      playUnreadBellSound().then((played) => {
        if (!played) {
          pendingSoundRef.current = true;
        }
      });
    };

    window.addEventListener('pointerdown', playPendingSound, { capture: true });
    window.addEventListener('keydown', playPendingSound, { capture: true });
    window.addEventListener('touchstart', playPendingSound, { capture: true });

    return () => {
      window.removeEventListener('pointerdown', playPendingSound, { capture: true });
      window.removeEventListener('keydown', playPendingSound, { capture: true });
      window.removeEventListener('touchstart', playPendingSound, { capture: true });
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    getChatUnreadSummary().then((result) => {
      if (!isMounted) return;

      if (result.viewerId) {
        viewerIdRef.current = result.viewerId;
      }

      setUnreadMessageIds(result.messageIds || []);

      if ((result.count || 0) > 0 && !pathname?.startsWith('/chat')) {
        notifyUnreadMessage();
      }
    });

    return () => {
      isMounted = false;
    };
  }, [notifyUnreadMessage, pathname, setUnreadMessageIds]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (data: { message: ChatMessage }) => {
      const viewerId = viewerIdRef.current;
      if (!viewerId || data.message.sender.id === viewerId || data.message.isRead) {
        return;
      }

      if (pathname?.startsWith('/chat')) {
        return;
      }

      addUnreadMessage(data.message.id);
      notifyUnreadMessage();
    };

    const handleMessageRead = (data: { messageId: string }) => {
      removeUnreadMessage(data.messageId);
    };

    const handleMessageDeleted = (data: { messageId: string }) => {
      removeUnreadMessage(data.messageId);
    };

    socket.on('message:new', handleNewMessage);
    socket.on('message:read', handleMessageRead);
    socket.on('message:deleted', handleMessageDeleted);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('message:read', handleMessageRead);
      socket.off('message:deleted', handleMessageDeleted);
    };
  }, [socket, pathname, addUnreadMessage, removeUnreadMessage, notifyUnreadMessage]);

  useEffect(() => {
    return () => {
      clearUnreadMessages();
    };
  }, [clearUnreadMessages]);

  return null;
}
