import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/favicon.ico',
        destination: '/bluefox-logo.webp',
      },
    ];
  },
};

export default nextConfig;

