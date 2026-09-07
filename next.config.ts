import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/logo.webp',
      },
    ];
  },
};

export default nextConfig;

