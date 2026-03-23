import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "fluent-ffmpeg", "ffmpeg-static"],
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
  },
};

export default nextConfig;
