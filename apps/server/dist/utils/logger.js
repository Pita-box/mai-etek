"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const levelPriority = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
const redactedKeyPattern = /password|secret|token|authorization|cookie|refresh|access/i;
function getLogLevel() {
    const value = process.env.LOG_LEVEL?.toLowerCase();
    if (value === "debug" || value === "info" || value === "warn" || value === "error") {
        return value;
    }
    return process.env.NODE_ENV === "production" ? "info" : "debug";
}
function serializeValue(value, seen = new WeakSet()) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: process.env.NODE_ENV === "production" ? undefined : value.stack,
        };
    }
    if (value === null || typeof value !== "object")
        return value;
    if (seen.has(value))
        return "[Circular]";
    seen.add(value);
    if (Array.isArray(value)) {
        return value.map((item) => serializeValue(item, seen));
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
        key,
        redactedKeyPattern.test(key) ? "[REDACTED]" : serializeValue(item, seen),
    ]));
}
function writeLog(level, message, meta) {
    if (levelPriority[level] < levelPriority[getLogLevel()])
        return;
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
exports.logger = {
    debug(message, meta) {
        writeLog("debug", message, meta);
    },
    info(message, meta) {
        writeLog("info", message, meta);
    },
    warn(message, meta) {
        writeLog("warn", message, meta);
    },
    error(message, meta) {
        writeLog("error", message, meta);
    },
};
