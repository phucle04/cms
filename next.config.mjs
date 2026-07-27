  /** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/scripting', destination: '/scripts', permanent: false },
      { source: '/optimization', destination: '/', permanent: false },
      { source: '/analytics', destination: '/', permanent: false },
      { source: '/archive', destination: '/', permanent: false },
    ];
  },
}

export default nextConfig
