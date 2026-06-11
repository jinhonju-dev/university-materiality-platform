import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? "export" : "standalone",
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
};

export default nextConfig;
