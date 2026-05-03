import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

let envFileCache: Record<string, string> | null = null;

function parseEnvValue(value: string) {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).replace(/\\n/g, '\n');
  }

  return trimmed;
}

function readEnvFile(filePath: string) {
  if (!existsSync(filePath)) return {};

  const values: Record<string, string> = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) continue;

    values[key] = parseEnvValue(line.slice(separatorIndex + 1));
  }

  return values;
}

function getEnvFileValues() {
  if (envFileCache) return envFileCache;

  const cwd = process.cwd();
  const candidates = Array.from(
    new Set([
      path.resolve(cwd, '../../.env'),
      path.resolve(cwd, '../../.env.local'),
      path.resolve(cwd, '.env'),
      path.resolve(cwd, '.env.local'),
    ]),
  );

  envFileCache = candidates.reduce<Record<string, string>>(
    (values, filePath) => ({
      ...values,
      ...readEnvFile(filePath),
    }),
    {},
  );

  return envFileCache;
}

export function getEnvValue(key: string) {
  return process.env[key]?.trim() || getEnvFileValues()[key]?.trim();
}

export function getWebUrl() {
  const appUrl = (
    getEnvValue('WEB_URL') ||
    getEnvValue('SITE_URL') ||
    getEnvValue('NEXT_PUBLIC_APP_URL') ||
    getEnvValue('NEXT_PUBLIC_SITE_URL')
  )?.trim();

  if (!appUrl) {
    throw new Error('Missing WEB_URL, SITE_URL, NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL');
  }

  return appUrl.replace(/\/+$/, '');
}
