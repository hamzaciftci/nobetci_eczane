/** @type {import('next').NextConfig} */
const rawApiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const apiBase = rawApiBase.replace(/^\uFEFF/, "").trim().replace(/\/+$/, "");

const nextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: []
  },
  async rewrites() {
    if (!apiBase) {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`
      }
    ];
  }
};

export default nextConfig;
