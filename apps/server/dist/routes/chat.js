"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("@maietek/db");
const notifications_1 = require("../services/notifications");
const auth_1 = require("../utils/auth");
const redis_cache_1 = require("../utils/redis-cache");
const chat_search_cache_1 = require("../utils/chat-search-cache");
const socket_1 = require("../socket");
const router = (0, express_1.Router)();
const supabaseAdmin = (0, db_1.createAdminClient)();
const MESSAGE_SELECT = "id, sender_id, type, content, media_url, media_thumbnail_url, reply_to_message_id, is_read, read_at, created_at";
const SEARCH_BATCH_SIZE = 500;
const SEARCH_RESULT_LIMIT = 50;
const SEARCH_CACHE_TTL_SECONDS = 30;
async function invalidateSearchCacheForParticipants(participantIds) {
    await Promise.all(Array.from(new Set(participantIds)).map((participantId) => (0, redis_cache_1.deleteCacheByPattern)((0, chat_search_cache_1.getSearchCacheInvalidationPattern)(participantId))));
}
function normalizeDisplayName(fullName) {
    return typeof fullName === "string" && fullName.trim()
        ? fullName.trim()
        : "subíček";
}
function normalizeSearchText(value) {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("cs-CZ")
        .trim();
}
async function getViewerProfile(userId) {
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, dom_id")
        .eq("id", userId)
        .single();
    if (error || !data) {
        return { profile: null, error: error?.message || "Profile not found" };
    }
    return { profile: data, error: null };
}
async function getConversationParticipantIds(viewer) {
    if (viewer.role === "dom") {
        const { data, error } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("dom_id", viewer.id)
            .in("role", ["sub", "unassigned"]);
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
        .from("profiles")
        .select("id, full_name, role, last_online_at")
        .in("id", uniqueIds);
    if (error) {
        throw new Error(error.message);
    }
    return new Map((data || []).map((profile) => [
        profile.id,
        {
            id: profile.id,
            fullName: normalizeDisplayName(profile.full_name),
            role: profile.role === "dom"
                ? "dom"
                : profile.role === "unassigned"
                    ? "unassigned"
                    : "sub",
            lastOnlineAt: profile.last_online_at ?? null,
        },
    ]));
}
async function getParticipantPresence(participantIds, viewerId) {
    const partnerIds = participantIds.filter((participantId) => participantId !== viewerId);
    if (partnerIds.length === 0) {
        return [];
    }
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, role, last_online_at")
        .in("id", partnerIds);
    if (error) {
        throw new Error(error.message);
    }
    return (data || []).map((profile) => ({
        id: profile.id,
        fullName: normalizeDisplayName(profile.full_name),
        role: profile.role === "dom"
            ? "dom"
            : profile.role === "unassigned"
                ? "unassigned"
                : "sub",
        isOnline: (0, socket_1.isUserOnline)(profile.id),
        lastOnlineAt: profile.last_online_at ?? null,
    }));
}
function mapMedia(row) {
    return row.media_url
        ? {
            url: row.media_url,
            thumbnailUrl: row.media_thumbnail_url,
            mimeType: null,
            sizeBytes: null,
            durationSeconds: null,
        }
        : null;
}
function getFallbackSender(senderId) {
    return {
        id: senderId,
        fullName: "subíček",
        role: "sub",
    };
}
function buildReactionSummaries(reactions, messageIds, viewerId) {
    const summaries = new Map();
    messageIds.forEach((messageId) => {
        const messageReactions = reactions.filter((reaction) => reaction.message_id === messageId);
        const heartCount = messageReactions.length;
        summaries.set(messageId, heartCount > 0
            ? [
                {
                    emoji: "heart",
                    count: heartCount,
                    reactedByViewer: messageReactions.some((reaction) => reaction.user_id === viewerId),
                },
            ]
            : []);
    });
    return summaries;
}
async function getHeartReactionSummary(messageId, viewerId) {
    const { data, error } = await supabaseAdmin
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .eq("message_id", messageId)
        .eq("emoji", "heart");
    if (error) {
        throw new Error(error.message);
    }
    const reactions = (data || []);
    return {
        emoji: "heart",
        count: reactions.length,
        reactedByViewer: reactions.some((reaction) => reaction.user_id === viewerId),
    };
}
async function mapMessages(rows, viewerId, participantIds = []) {
    if (rows.length === 0) {
        return [];
    }
    const replyIds = Array.from(new Set(rows.map((row) => row.reply_to_message_id).filter(Boolean)));
    const messageIds = rows.map((row) => row.id);
    let replyRows = [];
    let reactionRows = [];
    if (replyIds.length > 0) {
        let replyQuery = supabaseAdmin
            .from("messages")
            .select(MESSAGE_SELECT)
            .in("id", replyIds);
        if (participantIds.length > 0) {
            replyQuery = replyQuery.in("sender_id", participantIds);
        }
        const { data, error } = await replyQuery;
        if (error) {
            throw new Error(error.message);
        }
        replyRows = (data || []);
    }
    const { data: reactions, error: reactionsError } = await supabaseAdmin
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .in("message_id", messageIds)
        .eq("emoji", "heart");
    if (reactionsError) {
        throw new Error(reactionsError.message);
    }
    reactionRows = (reactions || []);
    const senderMap = await getProfilesMap([
        ...rows.map((row) => row.sender_id),
        ...replyRows.map((row) => row.sender_id),
    ]);
    const replyMap = new Map(replyRows.map((row) => {
        const sender = senderMap.get(row.sender_id) || getFallbackSender(row.sender_id);
        return [
            row.id,
            {
                id: row.id,
                type: row.type,
                text: row.content,
                media: mapMedia(row),
                createdAt: row.created_at,
                sender,
            },
        ];
    }));
    const reactionSummaries = buildReactionSummaries(reactionRows, messageIds, viewerId);
    return rows.map((row) => ({
        id: row.id,
        type: row.type,
        text: row.content,
        media: mapMedia(row),
        replyTo: row.reply_to_message_id
            ? (replyMap.get(row.reply_to_message_id) ?? null)
            : null,
        reactions: reactionSummaries.get(row.id) ?? [],
        isRead: Boolean(row.is_read),
        readAt: row.read_at,
        createdAt: row.created_at,
        sender: senderMap.get(row.sender_id) || getFallbackSender(row.sender_id),
    }));
}
function getMessagePreview(message) {
    if (message.text?.trim()) {
        return message.text.trim();
    }
    if (message.type === "image")
        return "Poslal obrázek.";
    if (message.type === "video")
        return "Poslal video.";
    if (message.type === "voice")
        return "Poslal hlasovou zprávu.";
    return "Nová zpráva.";
}
router.get("/messages", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        // Cursor-based paginace
        const limit = Math.min(Number(req.query.limit) || 30, 100);
        const before = req.query.before;
        let query = supabaseAdmin
            .from("messages")
            .select(MESSAGE_SELECT)
            .in("sender_id", participantIds)
            .order("created_at", { ascending: false })
            .limit(limit + 1); // +1 pro detekci hasMore
        if (before) {
            // Načíst zprávy starší než cursor
            const { data: cursorMsg } = await supabaseAdmin
                .from("messages")
                .select("created_at")
                .eq("id", before)
                .single();
            if (cursorMsg) {
                query = query.lt("created_at", cursorMsg.created_at);
            }
        }
        const { data, error } = await query;
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        const rows = (data || []);
        const hasMore = rows.length > limit;
        const trimmedRows = hasMore ? rows.slice(0, limit) : rows;
        // Vrátit v chronologickém pořadí (asc)
        trimmedRows.reverse();
        const response = {
            messages: await mapMessages(trimmedRows, auth.user.id, participantIds),
            participants: await getParticipantPresence(participantIds, auth.user.id),
            hasMore,
            nextCursor: hasMore && trimmedRows.length > 0 ? trimmedRows[0].id : null,
        };
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
router.get("/messages/search", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const rawQuery = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
        const normalizedQuery = normalizeSearchText(typeof rawQuery === "string" ? rawQuery : "");
        if (normalizedQuery.length < 3) {
            const response = { messages: [] };
            return res.json(response);
        }
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        const cacheKey = (0, chat_search_cache_1.getSearchCacheKey)(auth.user.id, normalizedQuery, participantIds);
        const cachedResponse = await (0, redis_cache_1.getCachedJson)(cacheKey);
        if (cachedResponse) {
            res.setHeader("X-Cache", "HIT");
            return res.json(cachedResponse);
        }
        const matchedRows = [];
        let offset = 0;
        while (matchedRows.length < SEARCH_RESULT_LIMIT) {
            const { data, error } = await supabaseAdmin
                .from("messages")
                .select(MESSAGE_SELECT)
                .in("sender_id", participantIds)
                .not("content", "is", null)
                .order("created_at", { ascending: false })
                .range(offset, offset + SEARCH_BATCH_SIZE - 1);
            if (error) {
                return res.status(500).json({ error: error.message });
            }
            const rows = (data || []);
            if (rows.length === 0)
                break;
            for (const row of rows) {
                if (normalizeSearchText(row.content).includes(normalizedQuery)) {
                    matchedRows.push(row);
                    if (matchedRows.length >= SEARCH_RESULT_LIMIT)
                        break;
                }
            }
            if (rows.length < SEARCH_BATCH_SIZE)
                break;
            offset += SEARCH_BATCH_SIZE;
        }
        const response = {
            messages: await mapMessages(matchedRows.reverse(), auth.user.id, participantIds),
        };
        await (0, redis_cache_1.setCachedJson)(cacheKey, response, SEARCH_CACHE_TTL_SECONDS);
        res.setHeader("X-Cache", "MISS");
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
router.get("/messages/unread", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        const { data, error } = await supabaseAdmin
            .from("messages")
            .select("id")
            .in("sender_id", participantIds)
            .neq("sender_id", auth.user.id)
            .eq("is_read", false);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        const messageIds = (data || []).map((row) => row.id);
        const response = {
            count: messageIds.length,
            messageIds,
        };
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
router.post("/messages", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const body = (req.body || {});
        const type = body.type;
        const text = body.text?.trim() || null;
        const media = body.media || null;
        const replyToMessageId = body.replyToMessageId?.trim() || null;
        if (!type || !["text", "image", "video", "voice"].includes(type)) {
            return res.status(400).json({ error: "Invalid message type" });
        }
        if (type === "text" && !text) {
            return res
                .status(400)
                .json({ error: "Text message content is required" });
        }
        if (type !== "text" && !media?.url) {
            return res.status(400).json({ error: "Media message URL is required" });
        }
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        if (replyToMessageId) {
            const { data: repliedMessage, error: replyError } = await supabaseAdmin
                .from("messages")
                .select("id")
                .eq("id", replyToMessageId)
                .in("sender_id", participantIds)
                .single();
            if (replyError || !repliedMessage) {
                return res
                    .status(400)
                    .json({ error: "Zpráva pro odpověď nebyla nalezena" });
            }
        }
        const insertPayload = {
            sender_id: auth.user.id,
            type,
            content: text,
            media_url: media?.url || null,
            media_thumbnail_url: media?.thumbnailUrl || null,
            reply_to_message_id: replyToMessageId,
        };
        const { data, error } = await supabaseAdmin
            .from("messages")
            .insert(insertPayload)
            .select(MESSAGE_SELECT)
            .single();
        if (error || !data) {
            return res
                .status(500)
                .json({ error: error?.message || "Failed to create message" });
        }
        const [message] = await mapMessages([data], auth.user.id, participantIds);
        const response = { message };
        await invalidateSearchCacheForParticipants(participantIds);
        // Broadcast nové zprávy přes Socket.IO
        try {
            const io = (0, socket_1.getIO)();
            const chatNs = io.of("/chat");
            chatNs.emit("message:new", { message });
        }
        catch {
            // Socket.IO nemusí být inicializován – nevadí, REST response pokračuje
        }
        const offlineRecipientIds = participantIds.filter((participantId) => participantId !== auth.user.id && !(0, socket_1.isUserOnline)(participantId));
        if (offlineRecipientIds.length > 0) {
            const preview = getMessagePreview(message);
            void Promise.all(offlineRecipientIds.map((recipientId) => (0, notifications_1.sendTelegramNotification)(recipientId, preview, message.sender.fullName))).catch((notificationError) => {
                console.error("[Chat] Telegram notification failed:", notificationError);
            });
        }
        return res.status(201).json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
// ── POST /messages/:id/reactions/heart ──────────────────────────
router.post("/messages/:id/reactions/heart", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        const messageId = req.params.id;
        const { data: messageRow, error: messageError } = await supabaseAdmin
            .from("messages")
            .select("id")
            .eq("id", messageId)
            .in("sender_id", participantIds)
            .single();
        if (messageError || !messageRow) {
            return res.status(404).json({ error: "Zpráva nebyla nalezena" });
        }
        const { data: existingReaction, error: existingError } = await supabaseAdmin
            .from("message_reactions")
            .select("id")
            .eq("message_id", messageId)
            .eq("user_id", auth.user.id)
            .eq("emoji", "heart")
            .maybeSingle();
        if (existingError) {
            return res.status(500).json({ error: existingError.message });
        }
        let isReacted = true;
        if (existingReaction?.id) {
            const { error: deleteError } = await supabaseAdmin
                .from("message_reactions")
                .delete()
                .eq("id", existingReaction.id);
            if (deleteError) {
                return res.status(500).json({ error: deleteError.message });
            }
            isReacted = false;
        }
        else {
            const { error: insertError } = await supabaseAdmin
                .from("message_reactions")
                .insert({
                message_id: messageId,
                user_id: auth.user.id,
                emoji: "heart",
            });
            if (insertError) {
                return res.status(500).json({ error: insertError.message });
            }
        }
        const reaction = await getHeartReactionSummary(messageId, auth.user.id);
        await invalidateSearchCacheForParticipants(participantIds);
        try {
            const io = (0, socket_1.getIO)();
            io.of("/chat").emit("message:reaction", {
                messageId,
                emoji: reaction.emoji,
                count: reaction.count,
                userId: auth.user.id,
                isReacted,
            });
        }
        catch {
            // Socket.IO fallback
        }
        const response = { messageId, reaction };
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
// ── DELETE /messages/:id ──────────────────────────
router.delete("/messages/:id", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        // Ověřit DOM roli
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        if (profile.role !== "dom") {
            return res.status(403).json({ error: "Pouze DOM může mazat zprávy" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        const messageId = req.params.id;
        const { data: deletedRows, error } = await supabaseAdmin
            .from("messages")
            .delete()
            .eq("id", messageId)
            .in("sender_id", participantIds)
            .select("id");
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        if (!deletedRows?.length) {
            return res.status(404).json({ error: "Zpráva nebyla nalezena" });
        }
        // Broadcast smazání přes Socket.IO
        await invalidateSearchCacheForParticipants(participantIds);
        try {
            const io = (0, socket_1.getIO)();
            io.of("/chat").emit("message:deleted", { messageId });
        }
        catch {
            // Socket.IO fallback
        }
        const response = { deleted: true };
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
// ── POST /messages/:id/read ──────────────────────────
router.post("/messages/:id/read", async (req, res) => {
    try {
        const auth = await (0, auth_1.getAuthenticatedUserFromAuthorizationHeader)(req.headers.authorization);
        if (!auth.user) {
            return res.status(auth.status).json({ error: auth.error });
        }
        const messageId = req.params.id;
        const readAt = new Date().toISOString();
        const { profile, error: profileError } = await getViewerProfile(auth.user.id);
        if (!profile || profileError) {
            return res
                .status(404)
                .json({ error: profileError || "Profile not found" });
        }
        const { participantIds, error: participantError } = await getConversationParticipantIds(profile);
        if (participantError) {
            return res.status(500).json({ error: participantError });
        }
        const { data: updatedRows, error } = await supabaseAdmin
            .from("messages")
            .update({ is_read: true, read_at: readAt })
            .eq("id", messageId)
            .neq("sender_id", auth.user.id)
            .in("sender_id", participantIds)
            .select("id");
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        if (!updatedRows?.length) {
            return res.status(404).json({ error: "Zpráva nebyla nalezena" });
        }
        // Broadcast read receipt přes Socket.IO
        await invalidateSearchCacheForParticipants(participantIds);
        try {
            const io = (0, socket_1.getIO)();
            io.of("/chat").emit("message:read", { messageId, readAt });
        }
        catch {
            // Socket.IO fallback
        }
        const response = { messageId, readAt };
        return res.json(response);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Server error";
        return res.status(500).json({ error: message });
    }
});
exports.default = router;
