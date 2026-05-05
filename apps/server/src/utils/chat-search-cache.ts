import { createHash } from "node:crypto";

const SEARCH_CACHE_PREFIX = "chat:search:v1";

export function hashSearchCachePart(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

export function getSearchCacheKey(
  viewerId: string,
  normalizedQuery: string,
  participantIds: string[],
) {
  const participantHash = hashSearchCachePart(
    [...participantIds].sort().join(","),
  );
  const queryHash = hashSearchCachePart(normalizedQuery);

  return `${SEARCH_CACHE_PREFIX}:${viewerId}:${participantHash}:${queryHash}`;
}

export function getSearchCacheInvalidationPattern(viewerId: string) {
  return `${SEARCH_CACHE_PREFIX}:${viewerId}:*`;
}
