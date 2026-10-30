import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep the development-only Next badge off the mobile movement joystick.
  // Build and runtime errors are still reported without it.
  devIndicators: false,
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
      },
    ],
  },
};

export default nextConfig;
