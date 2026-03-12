import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: '/simulation',
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
