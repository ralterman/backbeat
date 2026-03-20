import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["fluent-ffmpeg", "@ffmpeg-installer/ffmpeg", "sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "600mb",
    },
  },
};

export default nextConfig;
