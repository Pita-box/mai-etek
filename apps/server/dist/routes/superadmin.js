"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const encryption_1 = require("../utils/encryption");
const router = (0, express_1.Router)();
// Initialize Supabase admin client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
// Middleware to check if requester is a DOM
const isDom = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader)
            return res.status(401).json({ error: 'No authorization header' });
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user)
            return res.status(401).json({ error: 'Unauthorized' });
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        if (profileError || profile?.role !== 'dom') {
            return res.status(403).json({ error: 'Forbidden: DOM role required' });
        }
        req.user = user;
        next();
    }
    catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
};
// Step 2.2: Dual-Storage Register Endpoint
router.post('/register', async (req, res) => {
    try {
        const { email, password, username, full_name } = req.body;
        const displayName = typeof full_name === 'string' && full_name.trim() ? full_name.trim() : 'subíček';
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        // 1. Create user in Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username, full_name: displayName }
        });
        if (authError)
            throw authError;
        const userId = authData.user.id;
        // 2. Encrypt password and store in user_vault
        const encryptedPassword = (0, encryption_1.encrypt)(password);
        const { error: vaultError } = await supabaseAdmin
            .from('user_vault')
            .insert({
            user_id: userId,
            encrypted_password: encryptedPassword
        });
        if (vaultError)
            throw vaultError;
        res.status(201).json({ user: authData.user });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Step 2.3: Reveal Password Endpoint
router.get('/vault/reveal/:userId', isDom, async (req, res) => {
    try {
        const { userId } = req.params;
        const domId = req.user.id;
        // Optional: verify this DOM actually claims this user (if you want to restrict it)
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('dom_id')
            .eq('id', userId)
            .single();
        if (profileError)
            throw profileError;
        if (profile.dom_id && profile.dom_id !== domId) {
            return res.status(403).json({ error: 'Forbidden: Not the DOM for this user' });
        }
        const { data: vaultData, error: vaultError } = await supabaseAdmin
            .from('user_vault')
            .select('encrypted_password')
            .eq('user_id', userId)
            .single();
        if (vaultError || !vaultData) {
            return res.status(404).json({ error: 'Password not found' });
        }
        const password = (0, encryption_1.decrypt)(vaultData.encrypted_password);
        res.json({ password });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Get all users for SuperAdmin dashboard
router.get('/users', isDom, async (req, res) => {
    try {
        const domId = req.user.id;
        // Fetch unassigned and claimed users
        const { data: users, error } = await supabaseAdmin
            .from('profiles')
            .select('id, full_name, email, role, dom_id, app_config')
            .in('role', ['unassigned', 'sub']);
        if (error)
            throw error;
        // Get auth users for emails if not in profiles
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError)
            throw authError;
        const authMap = new Map(authData.users.map(u => [u.id, u.email]));
        const usersWithEmails = users.map(u => ({
            ...u,
            email: authMap.get(u.id) || u.email
        }));
        res.json(usersWithEmails);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Step 2.4: Claim Endpoint
router.post('/claim/:subId', isDom, async (req, res) => {
    try {
        const { subId } = req.params;
        const domId = req.user.id;
        // Check if user is unassigned
        const { data: profile, error: checkError } = await supabaseAdmin
            .from('profiles')
            .select('role, dom_id')
            .eq('id', subId)
            .single();
        if (checkError)
            throw checkError;
        if (profile.role !== 'unassigned') {
            return res.status(400).json({ error: 'User is already claimed or is a DOM' });
        }
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({
            dom_id: domId,
            role: 'sub'
        })
            .eq('id', subId);
        if (updateError)
            throw updateError;
        res.json({ success: true, message: 'User claimed successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// Step 2.5: Config Update Endpoint
router.patch('/config/:subId', isDom, async (req, res) => {
    try {
        const { subId } = req.params;
        const domId = req.user.id;
        const { app_config } = req.body;
        // Ensure requester is the DOM for this user
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('dom_id')
            .eq('id', subId)
            .single();
        if (profileError)
            throw profileError;
        if (profile.dom_id !== domId) {
            return res.status(403).json({ error: 'Forbidden: Not the DOM for this user' });
        }
        const { error: updateError } = await supabaseAdmin
            .from('profiles')
            .update({ app_config })
            .eq('id', subId);
        if (updateError)
            throw updateError;
        res.json({ success: true, message: 'Configuration updated successfully' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
