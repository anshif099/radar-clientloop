import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // Shared hosts can expose many CPUs while enforcing a small memory/process
    // quota. Keep SWC-WASM page-data generation inside that quota.
    cpus: 1,
    webpackMemoryOptimizations: true,
  },
  webpack(config) {
    // CloudLinux's Node.js Selector keeps dependencies behind a virtual-env
    // symlink. Resolve the source alias explicitly so Webpack does not depend
    // on host-specific tsconfig path discovery.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(process.cwd(), "src"),
    };
    return config;
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      {
        key: "Permissions-Policy",
        value: "camera=(), geolocation=(), microphone=(self)",
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      ...["/api/v1/admin/assets/:assetId", "/api/v1/company/assets/:assetId", "/api/v1/chat/attachments/:attachmentId"].map((source) => ({
        source,
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      })),
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
