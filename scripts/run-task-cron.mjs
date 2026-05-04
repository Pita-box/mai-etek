#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const mode = process.argv[2];
const explicitDate = process.argv[3];
const allowedModes = new Set(["expire", "monitoring-cleanup", "recurring"]);

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};

  const values = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!/^[A-Z0-9_]+$/.test(key)) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value.replace(/\\n/g, "\n");
  }

  return values;
}

function loadEnv() {
  const root = process.cwd();
  return {
    ...parseEnvFile(path.join(root, ".env")),
    ...parseEnvFile(path.join(root, "apps/web/.env.local")),
    ...process.env,
  };
}

if (!allowedModes.has(mode)) {
  console.error(
    "Usage: node scripts/run-task-cron.mjs <expire|recurring|monitoring-cleanup> [YYYY-MM-DD]",
  );
  process.exit(2);
}

if (explicitDate && !/^\d{4}-\d{2}-\d{2}$/.test(explicitDate)) {
  console.error("Invalid date. Expected YYYY-MM-DD.");
  process.exit(2);
}

const env = loadEnv();
const secret = env.CRON_SECRET?.trim();

if (!secret) {
  console.error("CRON_SECRET is missing.");
  process.exit(1);
}

const baseUrl = (
  env.TASK_CRON_BASE_URL ||
  env.NEXT_PUBLIC_APP_URL ||
  env.NEXT_PUBLIC_SITE_URL ||
  env.SITE_URL
)?.replace(/\/+$/, "");

if (!baseUrl) {
  console.error(
    "TASK_CRON_BASE_URL, NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_SITE_URL nebo SITE_URL chybí.",
  );
  process.exit(1);
}

const route =
  mode === "expire"
    ? "/api/cron/tasks/expire"
    : mode === "monitoring-cleanup"
      ? "/api/cron/monitoring/cleanup"
      : `/api/cron/tasks/recurring${explicitDate ? `?date=${explicitDate}` : ""}`;
const url = `${baseUrl}${route}`;

const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${secret}`,
  },
});
const responseText = await response.text();

console.log(`${new Date().toISOString()} ${mode} ${response.status} ${responseText}`);

if (!response.ok) {
  process.exit(1);
}
