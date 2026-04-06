/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  env: {
    // Production backend URL for Railway deployment
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'https://studytogether-production.up.railway.app',
    NEXT_PUBLIC_AMAP_KEY: process.env.NEXT_PUBLIC_AMAP_KEY || '',
    NEXT_PUBLIC_AMAP_SECRET: process.env.NEXT_PUBLIC_AMAP_SECRET || '',
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
};

// Force rebuild to pickup Railway environment variables
// Build timestamp: 2025-04-06-16
// Production backend: https://studytogether-production.up.railway.app

module.exports = nextConfig;
