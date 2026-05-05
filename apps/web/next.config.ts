import type { NextConfig } from "next";
import path from "node:path";

const monorepoRoot = path.resolve(process.cwd(), "../..");

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
