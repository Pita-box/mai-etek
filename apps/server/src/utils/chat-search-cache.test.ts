import { describe, expect, it } from "vitest";
import {
  getSearchCacheInvalidationPattern,
  getSearchCacheKey,
} from "./chat-search-cache";

describe("chat search cache keys", () => {
  it("keeps participant order deterministic without mutating the input", () => {
    const participantIds = ["sub-2", "dom-1", "sub-1"];

    const firstKey = getSearchCacheKey("dom-1", "hello", participantIds);
    const secondKey = getSearchCacheKey("dom-1", "hello", [
      "sub-1",
      "sub-2",
      "dom-1",
    ]);

    expect(firstKey).toBe(secondKey);
    expect(participantIds).toEqual(["sub-2", "dom-1", "sub-1"]);
  });

  it("separates viewers and normalized queries", () => {
    const participants = ["dom-1", "sub-1"];

    const viewerKey = getSearchCacheKey("dom-1", "hello", participants);
    const otherViewerKey = getSearchCacheKey("sub-1", "hello", participants);
    const otherQueryKey = getSearchCacheKey("dom-1", "world", participants);

    expect(viewerKey).not.toBe(otherViewerKey);
    expect(viewerKey).not.toBe(otherQueryKey);
  });

  it("uses the same prefix for invalidation patterns", () => {
    expect(getSearchCacheInvalidationPattern("dom-1")).toBe(
      "chat:search:v1:dom-1:*",
    );
  });
});
