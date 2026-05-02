"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socketAuthMiddleware = socketAuthMiddleware;
const db_1 = require("@maietek/db");
/**
 * Socket.IO middleware: ověří JWT token z handshake auth.
 * Klient musí poslat { auth: { token: "<supabase_access_token>" } }.
 */
async function socketAuthMiddleware(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (!token) {
            return next(new Error('Chybí autentizační token'));
        }
        const supabaseAdmin = (0, db_1.createAdminClient)();
        const { data: { user }, error, } = await supabaseAdmin.auth.getUser(token);
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
        socket.data.userRole = profile?.role || 'unassigned';
        socket.data.userName = profile?.full_name || 'Uživatel';
        next();
    }
    catch (err) {
        next(new Error('Chyba autentizace'));
    }
}
