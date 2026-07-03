import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n.ts");

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs"],
  transpilePackages: ["@axis/currency", "@axis/sifen"],
  outputFileTracingIncludes: {
    '*': ['./node_modules/@swc/helpers/esm/**'],
  },
  experimental: {
    cpus: 1,
  },
  async redirects() {
    return [
      // Navegadores pedem /favicon.ico por padrão; servimos o ícone SVG do app
      { source: "/favicon.ico", destination: "/icon.svg", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
