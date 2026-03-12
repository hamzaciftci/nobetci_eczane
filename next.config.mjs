import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "src");

/**
 * Webpack plugin: src/ klasöründeki dosyalar için @/ alias'ını
 * proje kökü yerine src/ klasörüne yönlendirir.
 * (Vite SPA dosyalarının yanlışlıkla Next.js tarafından derlenmesini önler.)
 */
class SrcAliasPlugin {
  apply(compiler) {
    compiler.hooks.normalModuleFactory.tap("SrcAliasPlugin", (factory) => {
      factory.hooks.beforeResolve.tap("SrcAliasPlugin", (resolveData) => {
        if (
          resolveData.request?.startsWith("@/") &&
          resolveData.context?.startsWith(SRC_DIR)
        ) {
          resolveData.request = path.join(SRC_DIR, resolveData.request.slice(2));
        }
      });
    });
  }
}

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
  webpack(config) {
    config.plugins.push(new SrcAliasPlugin());
    return config;
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
