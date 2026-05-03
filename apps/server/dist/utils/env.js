"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvValue = getEnvValue;
exports.getWebUrl = getWebUrl;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
let envFileCache = null;
function parseEnvValue(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).replace(/\\n/g, '\n');
    }
    return trimmed;
}
function readEnvFile(filePath) {
    if (!(0, node_fs_1.existsSync)(filePath))
        return {};
    const values = {};
    const content = (0, node_fs_1.readFileSync)(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#'))
            continue;
        const separatorIndex = line.indexOf('=');
        if (separatorIndex === -1)
            continue;
        const key = line.slice(0, separatorIndex).trim();
        if (!/^[A-Z0-9_]+$/.test(key))
            continue;
        values[key] = parseEnvValue(line.slice(separatorIndex + 1));
    }
    return values;
}
function getEnvFileValues() {
    if (envFileCache)
        return envFileCache;
    const cwd = process.cwd();
    const candidates = Array.from(new Set([
        node_path_1.default.resolve(cwd, '../../.env'),
        node_path_1.default.resolve(cwd, '../../.env.local'),
        node_path_1.default.resolve(cwd, '.env'),
        node_path_1.default.resolve(cwd, '.env.local'),
    ]));
    envFileCache = candidates.reduce((values, filePath) => ({
        ...values,
        ...readEnvFile(filePath),
    }), {});
    return envFileCache;
}
function getEnvValue(key) {
    return process.env[key]?.trim() || getEnvFileValues()[key]?.trim();
}
function getWebUrl() {
    const appUrl = (getEnvValue('WEB_URL') ||
        getEnvValue('SITE_URL') ||
        getEnvValue('NEXT_PUBLIC_APP_URL') ||
        getEnvValue('NEXT_PUBLIC_SITE_URL'))?.trim();
    if (!appUrl) {
        throw new Error('Missing WEB_URL, SITE_URL, NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL');
    }
    return appUrl.replace(/\/+$/, '');
}
