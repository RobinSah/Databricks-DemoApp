import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output bundles a minimal server + node_modules subset into
   * .next/standalone, which is what we ship to Databricks Apps (the app
   * runs `node server.js` there — see app.yaml).
   */
  output: "standalone",
};

export default nextConfig;
