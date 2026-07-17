import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@nexusos/types', '@nexusos/config'],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
