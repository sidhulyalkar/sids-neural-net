import type { NextConfig } from 'next';

const sylvariaAuthoritativeSources = [
  './public/game-runtimes/mosslight-v2/v091/model.js',
  './public/game-runtimes/mosslight-v2/v091/world.js',
  './public/game-runtimes/mosslight-v2/v091/movement.js',
  './public/game-runtimes/mosslight-v2/v091/battle-core.js',
  './public/game-runtimes/mosslight-v2/v091/synergy-v010.js',
];

const nextConfig: NextConfig = {
  pageExtensions: ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'],
  outputFileTracingIncludes: {
    '/api/sylvaria/run-ticket': sylvariaAuthoritativeSources,
    '/api/sylvaria/leaderboard': sylvariaAuthoritativeSources,
    '/api/sylvaria/leaderboard/submit': sylvariaAuthoritativeSources,
  },
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
