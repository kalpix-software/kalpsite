/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kalpixsoftware.com',
      },
    ],
  },
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig
