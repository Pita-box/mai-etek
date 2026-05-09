type LogLevel = "debug" | "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const redactedKeyPattern =
  /password|secret|token|authorization|cookie|refresh|access/i;

function getLogLevel(): LogLevel {
  const value = process.env.LOG_LEVEL?.toLowerCase();
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }

  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

function serializeValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
    };
  }

  if (value === null || typeof value !== "object") return value;

  if (seen.has(value)) return "[Circular]";
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      redactedKeyPattern.test(key) ? "[REDACTED]" : serializeValue(item, seen),
    ]),
  );
}

function writeLog(level: LogLevel, message: string, meta?: LogMeta) {
  if (levelPriority[level] < levelPriority[getLogLevel()]) return;

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "maietek-server",
    message,
    ...(meta ? { meta: serializeValue(meta) } : {}),
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(message: string, meta?: LogMeta) {
    writeLog("debug", message, meta);
  },
  info(message: string, meta?: LogMeta) {
    writeLog("info", message, meta);
  },
  warn(message: string, meta?: LogMeta) {
    writeLog("warn", message, meta);
  },
  error(message: string, meta?: LogMeta) {
    writeLog("error", message, meta);
  },
};
