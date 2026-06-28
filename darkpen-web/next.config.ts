import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  webpack: (config) => {
    return config;
  }
};

export default nextConfig;
