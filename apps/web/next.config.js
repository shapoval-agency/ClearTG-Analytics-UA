function isLocalMode() {
  if (process.env.LOCAL_MODE === 'true') return true;
  if (process.env.LOCAL_MODE === 'false') return false;
  return Boolean(process.env.LOCAL_LOGIN_EMAIL && !process.env.API_INTERNAL_URL);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_LOCAL_MODE: isLocalMode() ? 'true' : 'false',
  },
  ...(process.env.DOCKER_BUILD === 'true' ? { output: 'standalone' } : {}),
  async rewrites() {
    // У локальному режимі НЕ проксувати /api на localhost — інакше логін ламається
    if (isLocalMode()) {
      return [];
    }

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
