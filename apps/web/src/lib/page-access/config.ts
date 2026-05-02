import type {
  DashboardPageItem,
  PageAccessAppConfig,
} from "@/types/page-access";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizePageAccessConfig(
  config: unknown,
): PageAccessAppConfig {
  return isRecord(config) ? (config as PageAccessAppConfig) : {};
}

export function isPageEnabledForSub(
  config: unknown,
  page: DashboardPageItem,
) {
  if (page.systemOnly) return false;

  const normalized = normalizePageAccessConfig(config);
  const explicit = normalized.page_access?.[page.key]?.enabled;

  if (typeof explicit === "boolean") {
    return explicit;
  }

  const legacyModule = normalized.modules?.[page.key];
  if (typeof legacyModule === "boolean") {
    return legacyModule;
  }

  return page.defaultEnabled;
}

export function setPageAccessEnabled(
  config: unknown,
  pageKey: string,
  enabled: boolean,
): PageAccessAppConfig {
  const normalized = normalizePageAccessConfig(config);

  return {
    ...normalized,
    page_access: {
      ...(normalized.page_access || {}),
      [pageKey]: { enabled },
    },
  };
}

export function getVisibleDashboardPages(
  pages: DashboardPageItem[],
  role: string | null | undefined,
  config: unknown,
) {
  if (role === "dom") return pages;

  return pages.filter((page) => isPageEnabledForSub(config, page));
}

export function resolveDashboardPageForPath(
  pages: DashboardPageItem[],
  pathname: string | null,
) {
  if (!pathname) return null;

  const normalizedPathname =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const sortedPages = [...pages].sort((left, right) => {
    return right.href.length - left.href.length;
  });

  return (
    sortedPages.find((page) => {
      const href = page.href.length > 1 ? page.href.replace(/\/+$/, "") : page.href;
      return normalizedPathname === href || normalizedPathname.startsWith(`${href}/`);
    }) || null
  );
}
