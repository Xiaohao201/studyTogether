/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    // Production backend URL for Railway deployment
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://studytogether-production.up.railway.app',
    // AMap (高德地图) configuration - use valid keys for production
    NEXT_PUBLIC_AMAP_KEY: process.env.NEXT_PUBLIC_AMAP_KEY || '8ae086b6aa1a363f43ab92e23f8e6a4d',
    NEXT_PUBLIC_AMAP_SECRET: process.env.NEXT_PUBLIC_AMAP_SECRET || '06e6de0b22b9fa3b5afe7a033eee484e',
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://studytogether-production.up.railway.app';
    return [
      {
        source: '/api/socket.io/:path*',
        destination: `${backendUrl}/socket.io/:path*`,
      },
    ];
  },
  // Disable caching for API routes to prevent CORS issues
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate',
          },
        ],
      },
    ];
  },
};

// Force rebuild to pickup Railway environment variables
// Build timestamp: 2025-04-07-11-15
// CORS fix deployment - Allow all origins
// Production backend: https://studytogether-production.up.railway.app

module.exports = nextConfig;
