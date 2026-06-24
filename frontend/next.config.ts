import type { NextConfig } from "next";

const basePath = process.env.PAGES_BASE_PATH || "";
const assetPrefix = basePath ? `${basePath.replace(/\/$/, "")}/` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix,
  trailingSlash: true,
};

export default nextConfig;
