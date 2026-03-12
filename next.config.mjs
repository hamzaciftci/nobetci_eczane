/** @type {import('next').NextConfig} */
const nextConfig = {
  // App Router is default in Next.js 15
  async redirects() {
    return [
      // Eski /il/:il URL'lerini SEO URL'lerine yönlendir (301 kalıcı)
      { source: "/il/:il", destination: "/nobetci-eczane/:il", permanent: true },
      { source: "/il/:il/:ilce", destination: "/nobetci-eczane/:il/:ilce", permanent: true },
    ];
  },
  // Güvenlik header'ları Next.js ile yönetilecek
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=(), payment=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // JSON-LD için unsafe-inline gerekli
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.tile.openstreetmap.org https://*.openstreetmap.org",
              "connect-src 'self'",
              "font-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
