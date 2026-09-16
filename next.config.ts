import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "fluent-ffmpeg", "ffmpeg-static", "@ffprobe-installer/ffprobe"],
  // Files the routes read from disk at runtime via computed paths, which
  // Next's file tracing can't see — force-include them so they exist inside
  // the serverless function bundle on Vercel:
  //  - watermark PNG (export)
  //  - the ffprobe binary: @ffprobe-installer/ffprobe resolves its
  //    platform package (@ffprobe-installer/linux-x64 on Vercel) with a
  //    dynamic require. The glob covers whichever platform package npm
  //    installed for the build host.
  outputFileTracingIncludes: {
    "/api/export": ["./public/watermark.png", "./node_modules/@ffprobe-installer/**"],
    "/api/analyze": ["./node_modules/@ffprobe-installer/**"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
  },
};

export default nextConfig;
