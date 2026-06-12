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
  // Map the canonical App-Links / Universal-Links paths to host-aware route
  // handlers (see app/api/well-known/*). Apple/Google fetch these exact URLs.
  async rewrites() {
    return [
      {
        source: '/.well-known/assetlinks.json',
        destination: '/api/well-known/assetlinks',
      },
      {
        source: '/.well-known/apple-app-site-association',
        destination: '/api/well-known/apple-app-site-association',
      },
    ]
  },
}

module.exports = nextConfig
