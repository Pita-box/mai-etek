import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.resolve(process.cwd(), "../..");

if (
  process.env.NODE_ENV === "development" &&
  !process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
) {
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY =
    "bWFpZXRlay1sb2NhbC1kZXYtYWN0aW9uLWtleS0wMDE=";
}

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "300mb",
    },
  },
  turbopack: {
    root: monorepoRoot,
  },
};

export default nextConfig;
