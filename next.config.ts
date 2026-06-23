import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      // better-sqlite3 is a native addon — keep external on the server bundle
      // (the package is still installed but no longer imported by chat-store.ts)
      config.externals = [...(config.externals || []), "better-sqlite3"];
    }

    if (!isServer) {
      // Provide empty stubs for Node.js built-ins that sneak into browser
      // bundles via the 0G Storage SDK's non-browser code paths.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        os: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },
};

export default nextConfig;
