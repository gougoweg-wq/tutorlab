import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // PGlite ships WASM and must not be bundled into server chunks
  serverExternalPackages: ["@electric-sql/pglite"],
  // behind the Codespaces proxy x-forwarded-host is localhost, so the public origin must be allowed explicitly
  experimental: { serverActions: { bodySizeLimit: "4mb", allowedOrigins: process.env.NEXT_PUBLIC_APP_URL ? [new URL(process.env.NEXT_PUBLIC_APP_URL).host] : undefined } },
};

export default withNextIntl(nextConfig);
