'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { retainChatSocket, releaseChatSocket, type ChatSocket } from '@/lib/socket';

type SocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

interface UseSocketReturn {
  socket: ChatSocket | null;
  status: SocketStatus;
  isConnected: boolean;
}

/**
 * React hook pro Socket.IO připojení k /chat namespace.
 * Automaticky se připojí při mount a odpojí při unmount.
 */
export function useSocket(): UseSocketReturn {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const socketRef = useRef<ChatSocket | null>(null);

  useEffect(() => {
    let mounted = true;
    let retainedSocket: ChatSocket | null = null;

    const handleConnect = () => {
      if (mounted) setStatus('connected');
    };

    const handleDisconnect = () => {
      if (mounted) setStatus('disconnected');
    };

    const handleConnectError = () => {
      if (mounted) setStatus('error');
    };

    const connect = async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token) {
          if (mounted) setStatus('error');
          return;
        }

        const socket = retainChatSocket(session.access_token);
        retainedSocket = socket;
        socketRef.current = socket;

        socket.on('connect', handleConnect);
        socket.on('disconnect', handleDisconnect);
        socket.on('connect_error', handleConnectError);

        // Pokud je už připojen (singleton reuse)
        if (socket.connected) {
          if (mounted) setStatus('connected');
        }
      } catch {
        if (mounted) setStatus('error');
      }
    };

    connect();

    return () => {
      mounted = false;
      if (retainedSocket) {
        retainedSocket.off('connect', handleConnect);
        retainedSocket.off('disconnect', handleDisconnect);
        retainedSocket.off('connect_error', handleConnectError);
        releaseChatSocket();
      }
      socketRef.current = null;
    };
  }, []);

  return {
    socket: socketRef.current,
    status,
    isConnected: status === 'connected',
  };
}
