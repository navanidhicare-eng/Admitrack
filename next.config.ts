import type { NextConfig } from "next";
// @ts-expect-error - next-pwa doesn't have reliable types
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const allowedOrigin =
  process.env.ALLOWED_ORIGIN ||
  (process.env.NODE_ENV === "production"
    ? "https://admitrack.com"
    : "http://localhost:3000");

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: allowedOrigin },
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,PATCH,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, X-Requested-With, X-App-Version" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
