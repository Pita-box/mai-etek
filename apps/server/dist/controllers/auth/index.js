"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetPassword = exports.forgotPassword = exports.login = exports.register = void 0;
const zod_1 = require("zod");
const db_1 = require("@maietek/db");
const email_1 = require("../../services/email");
const notifications_1 = require("../../services/notifications");
const encryption_1 = require("../../utils/encryption");
const env_1 = require("../../utils/env");
const authSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetPasswordSchema = zod_1.z.object({
    password: zod_1.z.string().min(6),
});
const forgotPasswordMessage = 'Pokud účet existuje, poslali jsme odkaz pro obnovu hesla.';
const register = async (req, res) => {
    try {
        const parsed = authSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.format() });
        }
        const { email, password } = parsed.data;
        const adminAuthClient = (0, db_1.createAdminClient)();
        const { data, error } = await adminAuthClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });
        if (error) {
            return res.status(400).json({ error: error.message });
        }
        res.status(201).json({ message: 'User registered successfully', user: data.user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.register = register;
const login = async (req, res) => {
    try {
        const { email, password } = authSchema.parse(req.body);
        const standardSupabase = (0, db_1.getSupabaseClient)();
        const { data, error } = await standardSupabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) {
            return res.status(401).json({ error: error.message });
        }
        res.status(200).json({ session: data.session, user: data.user });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
};
exports.login = login;
const forgotPassword = async (req, res) => {
    try {
        const parsed = forgotPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.format() });
        }
        const email = parsed.data.email.trim().toLowerCase();
        const adminAuthClient = (0, db_1.createAdminClient)();
        const redirectTo = `${(0, env_1.getWebUrl)()}/reset-password`;
        const { data, error } = await adminAuthClient.auth.admin.generateLink({
            type: 'recovery',
            email,
            options: {
                redirectTo,
            },
        });
        if (error) {
            console.warn('[Auth] Password reset link was not generated:', error.message);
            return res.status(200).json({ message: forgotPasswordMessage });
        }
        const properties = data.properties;
        const resetUrl = properties?.action_link;
        if (!resetUrl) {
            console.warn('[Auth] Password reset link was not generated.');
            return res.status(200).json({ message: forgotPasswordMessage });
        }
        await (0, email_1.sendPasswordResetEmail)({ to: email, resetUrl });
        return res.status(200).json({ message: forgotPasswordMessage });
    }
    catch (error) {
        console.error('[Auth] Password reset email failed:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({ error: 'E-mail pro obnovu hesla se nepodařilo odeslat.' });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const parsed = resetPasswordSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.format() });
        }
        const authHeader = req.headers.authorization;
        const token = authHeader?.startsWith('Bearer ')
            ? authHeader.slice('Bearer '.length).trim()
            : null;
        if (!token) {
            return res.status(401).json({ error: 'Reset odkaz je neplatný nebo vypršel.' });
        }
        const adminAuthClient = (0, db_1.createAdminClient)();
        const { data: userData, error: userError } = await adminAuthClient.auth.getUser(token);
        if (userError || !userData.user) {
            return res.status(401).json({ error: 'Reset odkaz je neplatný nebo vypršel.' });
        }
        const userId = userData.user.id;
        const { password } = parsed.data;
        const { error: updateError } = await adminAuthClient.auth.admin.updateUserById(userId, {
            password,
        });
        if (updateError) {
            throw updateError;
        }
        const encryptedPassword = (0, encryption_1.encrypt)(password);
        const { error: vaultError } = await adminAuthClient
            .from('user_vault')
            .upsert({
            user_id: userId,
            encrypted_password: encryptedPassword,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (vaultError) {
            throw vaultError;
        }
        const { data: profile } = await adminAuthClient
            .from('profiles')
            .select('full_name, role')
            .eq('id', userId)
            .maybeSingle();
        const profileRow = profile;
        void (0, notifications_1.sendAccountSecurityTelegramNotification)({
            userId,
            userName: profileRow?.full_name || userData.user.email,
            userRole: profileRow?.role,
            changes: ['password'],
        }).catch((notificationError) => {
            console.error('[Auth] Telegram account security notification failed:', notificationError);
        });
        return res.status(200).json({ success: true, message: 'Heslo bylo úspěšně změněno.' });
    }
    catch (error) {
        console.error('[Auth] Password reset failed:', error instanceof Error ? error.message : 'Unknown error');
        return res.status(500).json({ error: 'Heslo se nepodařilo změnit.' });
    }
};
exports.resetPassword = resetPassword;
