type LocalStorageArea = typeof chrome.storage.local;

export function installChromeStorageMock() {
  const data: Record<string, unknown> = {};

  const get: LocalStorageArea["get"] = async (keys?: unknown) => {
    if (typeof keys === "string") {
      return { [keys]: data[keys] };
    }

    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, data[key]]));
    }

    if (keys && typeof keys === "object") {
      return Object.fromEntries(
        Object.entries(keys as Record<string, unknown>).map(
          ([key, fallback]) => [key, data[key] ?? fallback],
        ),
      );
    }

    return { ...data };
  };

  const set: LocalStorageArea["set"] = async (items) => {
    Object.assign(data, items);
  };

  const remove: LocalStorageArea["remove"] = async (keys) => {
    for (const key of Array.isArray(keys) ? keys : [keys]) {
      delete data[key];
    }
  };

  (globalThis as unknown as { chrome: typeof chrome }).chrome = {
    storage: {
      local: {
        get,
        remove,
        set,
      },
    },
  } as typeof chrome;

  return data;
}
