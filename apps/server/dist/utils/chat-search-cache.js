"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashSearchCachePart = hashSearchCachePart;
exports.getSearchCacheKey = getSearchCacheKey;
exports.getSearchCacheInvalidationPattern = getSearchCacheInvalidationPattern;
const node_crypto_1 = require("node:crypto");
const SEARCH_CACHE_PREFIX = "chat:search:v1";
function hashSearchCachePart(value) {
    return (0, node_crypto_1.createHash)("sha256").update(value).digest("hex").slice(0, 24);
}
function getSearchCacheKey(viewerId, normalizedQuery, participantIds) {
    const participantHash = hashSearchCachePart([...participantIds].sort().join(","));
    const queryHash = hashSearchCachePart(normalizedQuery);
    return `${SEARCH_CACHE_PREFIX}:${viewerId}:${participantHash}:${queryHash}`;
}
function getSearchCacheInvalidationPattern(viewerId) {
    return `${SEARCH_CACHE_PREFIX}:${viewerId}:*`;
}
