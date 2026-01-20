import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "@neondatabase/serverless", "ws"],
  turbopack: {},
  // Ensure env vars are passed to server
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
};

export default nextConfig;
