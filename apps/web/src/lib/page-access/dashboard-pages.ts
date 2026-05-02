import "server-only";

import { existsSync, readdirSync } from "fs";
import path from "path";
import type { DashboardPageIconKey, DashboardPageItem } from "@/types/page-access";

type PageMetadata = {
  label: string;
  iconKey: DashboardPageIconKey;
  order: number;
  defaultEnabled?: boolean;
  systemOnly?: boolean;
};

const pageMetadata: Record<string, PageMetadata> = {
  dashboard: {
    label: "Přehled",
    iconKey: "gauge",
    order: 10,
  },
  tasks: {
    label: "Úkoly",
    iconKey: "check-square",
    order: 20,
  },
  chat: {
    label: "Chat",
    iconKey: "message-square",
    order: 30,
  },
  gallery: {
    label: "Galerie",
    iconKey: "image",
    order: 40,
  },
  wishes: {
    label: "Přání",
    iconKey: "heart",
    order: 50,
  },
  rewards: {
    label: "Odměny",
    iconKey: "gift",
    order: 60,
  },
  achievements: {
    label: "Odznaky",
    iconKey: "trophy",
    order: 70,
  },
  punishments: {
    label: "Punishments",
    iconKey: "alert-triangle",
    order: 80,
    defaultEnabled: false,
  },
  monitoring: {
    label: "Monitoring",
    iconKey: "activity",
    order: 90,
    defaultEnabled: false,
  },
  settings: {
    label: "Nastavení",
    iconKey: "settings",
    order: 900,
  },
  superadmin: {
    label: "Superadmin",
    iconKey: "shield",
    order: 1000,
    defaultEnabled: false,
    systemOnly: true,
  },
};

const fallbackRouteKeys = [
  "dashboard",
  "tasks",
  "chat",
  "gallery",
  "wishes",
  "rewards",
  "achievements",
  "punishments",
  "settings",
  "superadmin",
];

function getDashboardRoot() {
  const candidates = [
    path.join(process.cwd(), "src", "app", "(dashboard)"),
    path.join(process.cwd(), "apps", "web", "src", "app", "(dashboard)"),
  ];

  return candidates.find((candidate) => existsSync(candidate)) || candidates[0];
}

function getRouteKeysFromDirectory(directory: string) {
  const keys = new Set<string>();

  if (!existsSync(directory)) {
    fallbackRouteKeys.forEach((key) => keys.add(key));
    return keys;
  }

  const walk = (currentDirectory: string, segments: string[]) => {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;

      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isFile() && entry.name === "page.tsx" && segments.length > 0) {
        keys.add(segments[0]);
      }

      if (entry.isDirectory()) {
        walk(fullPath, [...segments, entry.name]);
      }
    }
  };

  walk(directory, []);

  if (keys.size === 0) {
    fallbackRouteKeys.forEach((key) => keys.add(key));
  }

  return keys;
}

function getFallbackLabel(key: string) {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePageItem(key: string): DashboardPageItem {
  const metadata = pageMetadata[key];

  return {
    key,
    href: `/${key}`,
    label: metadata?.label || getFallbackLabel(key),
    iconKey: metadata?.iconKey || "activity",
    order: metadata?.order ?? 500,
    defaultEnabled: metadata?.defaultEnabled ?? true,
    systemOnly: metadata?.systemOnly || false,
  };
}

export function getDashboardPages() {
  const routeKeys = getRouteKeysFromDirectory(getDashboardRoot());

  return Array.from(routeKeys)
    .filter((key) => !key.startsWith("("))
    .map(normalizePageItem)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label, "cs"));
}

export function getConfigurableDashboardPages() {
  return getDashboardPages().filter((page) => !page.systemOnly);
}
