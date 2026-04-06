/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  output: 'standalone',  // Enable standalone output for Docker deployment
  env: {
    NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000',
    NEXT_PUBLIC_AMAP_KEY: process.env.NEXT_PUBLIC_AMAP_KEY || '',
    NEXT_PUBLIC_AMAP_SECRET: process.env.NEXT_PUBLIC_AMAP_SECRET || '',
  },
  async rewrites() {
    return [
      {
        source: '/api/socket.io/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
