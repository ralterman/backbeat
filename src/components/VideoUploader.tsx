"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

type UploadStatus = "idle" | "uploading" | "analyzing" | "done" | "error";

const ACCEPTED_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
const MAX_SIZE = 500 * 1024 * 1024;

export function VideoUploader() {
  const router = useRouter();
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Unsupported file type. Please upload MP4, MOV, AVI, or MKV.");
        return;
      }
      if (file.size > MAX_SIZE) {
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
          const data = await presignRes.json();
          throw new Error(data.error ?? "Failed to get upload URL");
        }

        const { presignedUrl, videoId } = await presignRes.json();

        // Step 2: Upload to S3 with progress
        await uploadToS3(file, presignedUrl, (pct) => setProgress(pct));
        setProgress(100);

        // Step 3: Trigger analysis
        setStatus("analyzing");
        const analyzeRes = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        if (!analyzeRes.ok) {
          const data = await analyzeRes.json();
          throw new Error(data.error ?? "Analysis failed");
        }

        setStatus("done");
        router.push(`/analyze/${videoId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
        setStatus("error");
      }
    },
    [router]
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
  };

  const isLoading = status === "uploading" || status === "analyzing";

  return (
    <div className="w-full">
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all
          ${isDragging ? "border-[#C8A96E] bg-[#C8A96E]/5" : "border-[#2A2A2A] hover:border-[#3a3a5a] bg-[#141414]/60"}
          ${isLoading ? "pointer-events-none opacity-80" : "cursor-pointer"}
        `}
      >
        <input
          type="file"
          accept=".mp4,.mov,.avi,.mkv,video/mp4,video/quicktime,video/x-msvideo,video/x-matroska"
          onChange={onFileChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isLoading}
          aria-label="Upload video file"
        />

        <div className="flex flex-col items-center gap-4">
          {status === "idle" || status === "error" ? (
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
                  Drag & drop or click to browse — MP4, MOV, AVI, MKV up to 500MB
                </p>
              </div>
            </>
          ) : status === "uploading" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#C8A96E]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#C8A96E] animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M13 2.003A10 10 0 1022 12h-2A8 8 0 1113 4.003V2.003z"/>
                </svg>
              </div>
              <div className="w-full max-w-xs">
                <p className="text-white font-semibold mb-2">Uploading... {progress}%</p>
                <div className="w-full bg-[#1E1E1E] rounded-full h-2">
                  <div
                    className="bg-[#C8A96E] rounded-full h-2 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </>
          ) : status === "analyzing" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-[#C8A96E]/10 flex items-center justify-center">
                <svg className="w-8 h-8 text-[#C8A96E] animate-spin" fill="none" viewBox="0 0 24 24">
                  <path
                    className="opacity-25" stroke="currentColor" strokeWidth="4" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    fill="currentColor"
                  />
                  <path
                    className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold">AI is analyzing your video...</p>
                <p className="text-[#a0a0b8] text-sm mt-1">Extracting frames and detecting mood & energy</p>
              </div>
            </>
          ) : null}
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
    xhr.open("PUT", presignedUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(file);
  });
}
