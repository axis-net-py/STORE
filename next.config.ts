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
};

export default withNextIntl(nextConfig);
