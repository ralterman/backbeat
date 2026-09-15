"use client";

import React, { useCallback, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type UploadStatus = "idle" | "uploading" | "analyzing" | "done" | "error";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const MAX_SIZE = 500 * 1024 * 1024;

const ANALYSIS_STATUS_MESSAGES: Record<string, string> = {
  ANALYZING:  "Analyzing with AI — reading mood, energy, and scene...",
  GENERATING: "Generating your soundtracks — usually 30–40 seconds...",
};

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.trim().length > 0) {
      return data.error;
    }
  } catch {
    // Ignore JSON parse errors and fall back to status text.
  }
  return res.statusText || fallback;
}

export function VideoUploader() {
  const router = useRouter();
  const [isInitializing, setIsInitializing] = useState(true);
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [videoId, setVideoId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  React.useEffect(() => {
    const id = requestAnimationFrame(() => setIsInitializing(false));
    return () => cancelAnimationFrame(id);
  }, []);

  // Poll for analysis status while in "analyzing" state
  useEffect(() => {
    if (status !== "analyzing" || !videoId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/analyze/${videoId}`);
        if (!res.ok) return;
        const json = await res.json() as { status: string };

        if (json.status === "completed") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setStatus("done");
          setTimeout(() => router.push(`/analyze/${videoId}`), 1000);
        } else if (json.status === "FAILED") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setError("Analysis failed. Please try again.");
          setStatus("error");
        } else {
          setAnalysisStatus(json.status);
        }
      } catch {
        // Transient network error — keep polling
      }
    };

    poll(); // fire immediately, then repeat
    pollingRef.current = setInterval(poll, 3000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status, videoId, router]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (status === "uploading" || status === "analyzing") return;

      if (file.size === 0) {
        setStatus("error");
        setError("This file appears to be empty. Please upload a valid video.");
        return;
      }
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setStatus("error");
        setError("Unsupported file type. Please upload MP4, MOV, AVI, or MKV.");
        return;
      }
      if (file.size > MAX_SIZE) {
        setStatus("error");
        setError("File too large. Maximum size is 500MB.");
        return;
      }

      setStatus("uploading");
      setProgress(0);

      try {
        // Step 1: Get presigned URL
        const presignRes = await fetch("/api/upload/presigned", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
          }),
        });

        if (!presignRes.ok) {
          throw new Error(await getApiErrorMessage(presignRes, "Failed to get upload URL"));
        }

        const { presignedUrl, videoId: vid } = await presignRes.json();

        // Step 2: Upload to S3 with progress
        await uploadToS3(file, presignedUrl, (pct) => setProgress(pct));
        setProgress(100);

        // Step 3: Fire analysis without awaiting — polling tracks progress
        setVideoId(vid);
        setAnalysisStatus(null);
        setStatus("analyzing");

        fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: vid }),
        }).then(async (res) => {
          if (!res.ok) {
            const msg = await getApiErrorMessage(res, "Analysis failed");
            if (pollingRef.current) clearInterval(pollingRef.current);
            setError(msg);
            setStatus("error");
          }
          // Success is handled by polling reaching "completed"
        }).catch((err: unknown) => {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setError(err instanceof Error ? err.message : "Analysis failed");
          setStatus("error");
        });

      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Upload failed due to an unexpected error. Please try again."
        );
        setStatus("error");
      }
    },
    [status]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const isActive = status === "uploading" || status === "analyzing";

  const currentMessage =
    status === "uploading"
      ? "Uploading your video..."
      : status === "analyzing"
      ? (ANALYSIS_STATUS_MESSAGES[analysisStatus ?? ""] ?? "Analyzing with AI...")
      : status === "done"
      ? "Done! Taking you to your results..."
      : null;

  if (isInitializing) {
    return (
      <div className="w-full">
        <div className="relative border-2 border-dashed border-[#2A2A2A] rounded-2xl p-12 bg-[#141414]/60 animate-pulse">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#1E1E1E]" />
            <div className="space-y-2 text-center">
              <div className="h-5 w-44 bg-[#1E1E1E] rounded mx-auto" />
              <div className="h-4 w-72 bg-[#1E1E1E] rounded mx-auto" />
            </div>
            <div className="w-full max-w-xs mt-3">
              <div className="h-2 w-full bg-[#1E1E1E] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Upload / status box */}
      <div
        onDragOver={(e) => { e.preventDefault(); if (!isActive && status !== "done") setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all
          ${isDragging ? "border-[#C8A96E] bg-[#C8A96E]/5" : "border-[#2A2A2A] bg-[#141414]/60"}
          ${isActive || status === "done" ? "pointer-events-none" : "hover:border-[#3a3a5a] cursor-pointer"}
        `}
      >
        <input
          type="file"
          accept=".mp4,.mov,.avi,.mkv,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
          onChange={onFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isActive || status === "done"}
          aria-label="Upload video file"
        />

        <div className="flex flex-col items-center gap-4">
          {/* Idle / error */}
          {(status === "idle" || status === "error") && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#1E1E1E] flex items-center justify-center">
                <svg className="w-8 h-8 text-[#C8A96E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-lg">
                  {isDragging ? "Drop your video here" : "Upload your video"}
                </p>
                <p className="text-[#a0a0b8] text-sm mt-1">
                  Drag &amp; drop or click to browse — MP4, MOV, AVI, MKV up to 500MB
                </p>
              </div>
            </>
          )}

          {/* Uploading */}
          {status === "uploading" && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#C8A96E]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#C8A96E] animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2.003A10 10 0 1022 12h-2A8 8 0 1113 4.003V2.003z"/>
                </svg>
              </div>
              <div className="w-full max-w-xs">
                <p className="text-white font-semibold mb-2">{currentMessage} {progress}%</p>
                <div className="w-full bg-[#1E1E1E] rounded-full h-2">
                  <div
                    className="bg-[#C8A96E] rounded-full h-2 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Analyzing (AI + ElevenLabs) */}
          {status === "analyzing" && (
            <>
              <div className="w-16 h-16 rounded-full bg-[#C8A96E]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#C8A96E] animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">{currentMessage}</p>
              </div>
            </>
          )}

          {/* Done */}
          {status === "done" && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-semibold">{currentMessage}</p>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-4 py-3">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
          </svg>
          <span className="text-sm">{error}</span>
        </div>
      )}
    </div>
  );
}

function uploadToS3(
  file: File,
  presignedUrl: string,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    const startedAt = Date.now();
    let lastLoaded = 0;

    // No client-side deadline: a 500 MB file over cellular can legitimately
    // take many minutes and the presigned URL is valid for an hour. We only
    // abort on a true stall (no bytes for 2 min), which distinguishes a dead
    // connection from a slow one.
    const STALL_MS = 2 * 60 * 1000;
    let stallTimer: ReturnType<typeof setTimeout> | null = null;
    const armStall = () => {
      if (stallTimer) clearTimeout(stallTimer);
      stallTimer = setTimeout(() => {
        xhr.abort();
        reject(new Error(
          `Upload stalled — no data was sent for 2 minutes (${Math.round(lastLoaded / file.size * 100)}% of ${sizeMB} MB done). ` +
          `Check your connection and try again; on cellular, Wi-Fi is more reliable for large videos.`
        ));
      }, STALL_MS);
    };

    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        lastLoaded = e.loaded;
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
      armStall();
    };

    xhr.onload = () => {
      if (stallTimer) clearTimeout(stallTimer);
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      // S3 returns XML with a <Code>; surface it instead of a bare status.
      const code = /<Code>([^<]+)<\/Code>/.exec(xhr.responseText || "")?.[1];
      const hint =
        xhr.status === 403 && code === "SignatureDoesNotMatch"
          ? " (the file's type didn't match what was authorised — try re-selecting the file)"
          : xhr.status === 403 && code === "AccessDenied"
          ? " (upload link expired — please try again)"
          : xhr.status === 413 || code === "EntityTooLarge"
          ? " (file too large)"
          : "";
      reject(new Error(`Upload rejected by storage: HTTP ${xhr.status}${code ? ` ${code}` : ""}${hint}`));
    };

    // onerror fires with status 0 for two very different things: the browser
    // refused the request (CORS preflight failed, blocked by a content filter)
    // or the connection dropped mid-transfer. Tell them apart by whether any
    // bytes ever left the device, and say so — "Network error" hid the cause.
    xhr.onerror = () => {
      if (stallTimer) clearTimeout(stallTimer);
      const secs = Math.round((Date.now() - startedAt) / 1000);
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      let msg: string;
      if (offline) {
        msg = "You appear to be offline. Reconnect and try again.";
      } else if (lastLoaded === 0) {
        msg =
          "The browser blocked the upload before any data was sent. This is usually a storage " +
          "permissions (CORS) problem on our side rather than your connection — please contact " +
          "hello@backbeat.video and mention this message.";
      } else {
        msg =
          `Connection dropped after ${Math.round(lastLoaded / file.size * 100)}% of ${sizeMB} MB (${secs}s). ` +
          "Please try again — on cellular, Wi-Fi is more reliable for large videos.";
      }
      console.error("[upload] xhr error", {
        status: xhr.status, loaded: lastLoaded, total: file.size, type: file.type || "(none)",
        secs, online: !offline, ua: navigator.userAgent,
      });
      reject(new Error(msg));
    };
    xhr.onabort = () => { if (stallTimer) clearTimeout(stallTimer); };

    armStall();
    xhr.send(file);
  });
}
