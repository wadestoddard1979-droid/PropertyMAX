import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Pilot APIs use cookies + mutable JSON store; keep SSR dynamic-friendly. */
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
