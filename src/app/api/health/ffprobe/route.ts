import { NextResponse } from "next/server";
import { execFile } from "child_process";
import * as fs from "fs";
import ffmpegPath from "ffmpeg-static";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";

// Temporary deploy diagnostic: confirms the ffprobe binary is physically
// present and executable inside the Vercel function bundle (not just in
// node_modules on the build host). Exposes only version strings. Removed
// once verified.
function version(bin: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(bin, ["-version"], { timeout: 5000 }, (err, stdout) => {
      resolve(err ? `ERROR: ${err.message.split("\n")[0]}` : stdout.split("\n")[0]);
    });
  });
}

export async function GET() {
  const ffprobePath = ffprobeInstaller.path;
  return NextResponse.json({
    ffprobe: {
      path: ffprobePath,
      exists: fs.existsSync(ffprobePath),
      version: await version(ffprobePath),
    },
    ffmpeg: {
      exists: !!ffmpegPath && fs.existsSync(ffmpegPath),
      version: ffmpegPath ? await version(ffmpegPath) : "no path",
    },
  });
}
