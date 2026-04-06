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
  // Explicitly configure webpack to resolve path aliases
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname),
    };
    return config;
  },
};

module.exports = nextConfig;
