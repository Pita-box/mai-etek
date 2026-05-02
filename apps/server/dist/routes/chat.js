"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("@maietek/db");
const auth_1 = require("../utils/auth");
const router = (0, express_1.Router)();
const supabaseAdmin = (0, db_1.createAdminClient)();
function normalizeDisplayName(fullName) {
    return typeof fullName === 'string' && fullName.trim() ? fullName.trim() : 'subíček';
}
async function getViewerProfile(userId) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role, dom_id')
        .eq('id', userId)
        .single();
    if (error || !data) {
        return { profile: null, error: error?.message || 'Profile not found' };
    }
    return { profile: data, error: null };
}
async function getConversationParticipantIds(viewer) {
    if (viewer.role === 'dom') {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('dom_id', viewer.id)
            .in('role', ['sub', 'unassigned']);
        if (error) {
            return { participantIds: [], error: error.message };
        }
        return {
            participantIds: [viewer.id, ...(data || []).map((row) => row.id)],
            error: null,
        };
    }
    if (viewer.dom_id) {
        return { participantIds: [viewer.id, viewer.dom_id], error: null };
    }
    return { participantIds: [viewer.id], error: null };
}
async function getProfilesMap(userIds) {
    if (userIds.length === 0) {
        return new Map();
    }
    const uniqueIds = Array.from(new Set(userIds));
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, role')
        .in('id', uniqueIds);
    if (error) {
        throw new Error(error.message);
    }
    return new Map((data || []).map((profile) => [
        profile.id,
        {
            id: profile.id,
            fullName: normalizeDisplayName(profile.full_name),
            role: profile.role === 'dom' ? 'dom' : profile.role === 'unassigned' ? 'unassigned' : 'sub',
        },
    ]));
}
async function mapMessages(rows) {
    const senderMap = await getProfilesMap(rows.map((row) => row.sender_id));
    return rows.map((row) => ({
        id: row.id,
        type: row.type,
        text: row.content,
        media: row.media_url
            ? {
                url: row.media_url,
                thumbnailUrl: row.media_thumbnail_url,
                mimeType: null,
                sizeBytes: null,
                durationSeconds: null,
            }
            : null,
        isRead: Boolean(row.is_read),
        readAt: row.read_at,
        createdAt: row.created_at,
        sender: senderMap.get(row.sender_id) || {
            id: row.sender_id,
            fullName: 'subíček',
            role: 'sub',
        },
    }));
}
router.get('/messages', async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res.status(404).json({ error: profileError || 'Profile not found' });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        const { data, error } = await supabaseAdmin
            .from('messages')
            .select('id, sender_id, type, content, media_url, media_thumbnail_url, is_read, read_at, created_at')
            .in('sender_id', participantIds)
            .order('created_at', { ascending: true });
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        const response = {
            messages: await mapMessages((data || [])),
        };
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return res.status(500).json({ error: message });
    }
});
router.post('/messages', async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const body = (req.body || {});
        const type = body.type;
        const text = body.text?.trim() || null;
        const media = body.media || null;
        if (!type || !['text', 'image', 'video', 'voice'].includes(type)) {
            return res.status(400).json({ error: 'Invalid message type' });
        }
        if (type === 'text' && !text) {
            return res.status(400).json({ error: 'Text message content is required' });
        }
        if (type !== 'text' && !media?.url) {
            return res.status(400).json({ error: 'Media message URL is required' });
        }
        const insertPayload = {
            sender_id: auth.user.id,
            type,
            content: text,
            media_url: media?.url || null,
            media_thumbnail_url: media?.thumbnailUrl || null,
        };
        const { data, error } = await supabaseAdmin
            .from('messages')
            .insert(insertPayload)
            .select('id, sender_id, type, content, media_url, media_thumbnail_url, is_read, read_at, created_at')
            .single();
        if (error || !data) {
            return res.status(500).json({ error: error?.message || 'Failed to create message' });
        }
        const [message] = await mapMessages([data]);
        const response = { message };
        return res.status(201).json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Server error';
        return res.status(500).json({ error: message });
    }
});
exports.default = router;
