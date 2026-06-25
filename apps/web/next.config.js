/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.DOCKER_BUILD === 'true' ? { output: 'standalone' } : {}),
  async rewrites() {
    // Прокси на Railway API — один домен Vercel для кабинета, /l/, /r/ и /api/
    const api =
      process.env.API_INTERNAL_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      'http://localhost:3001';

    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/l/:path*', destination: `${api}/l/:path*` },
      { source: '/r/:path*', destination: `${api}/r/:path*` },
      { source: '/telegram/webhook', destination: `${api}/telegram/webhook` },
    ];
  },
};

module.exports = nextConfig;
