import type { Socket } from 'socket.io';
import { createAdminClient } from '@maietek/db';

export interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    userRole: 'dom' | 'sub' | 'unassigned';
    userName: string;
  };
}

/**
 * Socket.IO middleware: ověří JWT token z handshake auth.
 * Klient musí poslat { auth: { token: "<supabase_access_token>" } }.
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void,
) {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      return next(new Error('Chybí autentizační token'));
    }

    const supabaseAdmin = createAdminClient();
    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return next(new Error('Neplatný token'));
    }

    // Načteme profil pro roli a jméno
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, full_name, dom_id')
      .eq('id', user.id)
      .single();

    socket.data.userId = user.id;
    socket.data.userRole = (profile?.role as 'dom' | 'sub' | 'unassigned') || 'unassigned';
    socket.data.userName = profile?.full_name || 'Uživatel';

    next();
  } catch (err) {
    next(new Error('Chyba autentizace'));
  }
}
