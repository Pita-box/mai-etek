"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const encryption_1 = require("../utils/encryption");
const notifications_1 = require("../services/notifications");
const router = (0, express_1.Router)();
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
// Middleware to authenticate user via token
const requireAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ error: 'No authorization header' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user)
            return res.status(401).json({ error: 'Unauthorized' });
        req.user = user;
        next();
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
router.put('/settings', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { email, password, full_name } = req.body;
        const displayName = typeof full_name === 'string' ? full_name.trim() : undefined;
        const securityChanges = [];
        if (!email && !password && displayName === undefined) {
            return res.status(400).json({ error: 'Email, password or name is required' });
        }
        const updates = {};
        if (email) {
            updates.email = email;
            securityChanges.push('email');
        }
        if (password) {
            updates.password = password;
            securityChanges.push('password');
        }
        if (displayName !== undefined) {
            updates.user_metadata = {
                ...(req.user.user_metadata || {}),
                full_name: displayName || 'subíček',
            };
        }
        // 1. Update in Supabase Auth
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, updates);
        if (error)
            throw error;
        if (displayName !== undefined) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ full_name: displayName || 'subíček' })
                .eq('id', userId);
            if (profileError)
                throw profileError;
        }
        // 2. If email updated, also sync profiles (optional, but good if you store email in profile)
        // Note: Depends on if 'email' is in profiles table. If not, skip this. Let's just update auth.users.
        // 3. If password updated, update user_vault
        if (password) {
            const encryptedPassword = (0, encryption_1.encrypt)(password);
            const { error: vaultError } = await supabaseAdmin
                .from('user_vault')
                .update({ encrypted_password: encryptedPassword, updated_at: new Date() })
                .eq('user_id', userId);
            if (vaultError) {
                // If row doesn't exist, maybe insert it?
                console.error('Error updating vault:', vaultError);
                const { error: insertError } = await supabaseAdmin
                    .from('user_vault')
                    .insert({ user_id: userId, encrypted_password: encryptedPassword });
                if (insertError)
                    throw insertError;
            }
        }
        if (securityChanges.length > 0) {
            void (0, notifications_1.sendAccountSecurityTelegramNotification)({
                userId,
                userName: displayName || req.user.user_metadata?.full_name || req.user.email,
                changes: securityChanges,
            }).catch((notificationError) => {
                console.error('[User] Telegram account security notification failed:', notificationError);
            });
        }
        res.json({ success: true, message: 'Nastavení bylo úspěšně uloženo.', user: data.user });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
