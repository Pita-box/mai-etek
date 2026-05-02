export type PageAccessState = {
  enabled?: boolean;
};

export type PageAccessAppConfig = {
  page_access?: Record<string, PageAccessState | undefined>;
  modules?: Record<string, boolean | undefined>;
} & Record<string, unknown>;

export type DashboardPageIconKey =
  | "activity"
  | "alert-triangle"
  | "check-square"
  | "gauge"
  | "gift"
  | "heart"
  | "image"
  | "message-square"
  | "settings"
  | "shield"
  | "trophy";

export type DashboardPageItem = {
  key: string;
  href: string;
  label: string;
  iconKey: DashboardPageIconKey;
  order: number;
  defaultEnabled: boolean;
  systemOnly?: boolean;
};
