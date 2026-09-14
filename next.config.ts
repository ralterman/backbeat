import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "fluent-ffmpeg", "ffmpeg-static"],
  // The export route reads the watermark PNG from disk at runtime via a
  // computed path, which Next's file tracing can't see — force-include it
  // so the file exists inside the serverless function bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/export": ["./public/watermark.png"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
  },
};

export default nextConfig;
