import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Standalone output bundles a minimal server + node_modules subset into
   * .next/standalone, which is what we ship to Databricks Apps (the app
   * runs `node server.js` there — see app.yaml).
   */
  output: "standalone",
  /**
   * The app renders no raster images, so skip the sharp-based optimizer.
   * This lets the deploy script strip sharp's platform-native binaries,
   * which exceed Databricks Apps' 10 MB per-file limit.
   */
  images: { unoptimized: true },
};

export default nextConfig;
