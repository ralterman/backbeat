/**
 * Upload size limit, shared by the client (pre-upload check) and the server
 * (presign route and analyze route). No server-only imports here — this is
 * bundled into the browser.
 *
 * Why 150 MB: the analyze function holds the whole file in memory and makes
 * a full copy per ElevenLabs call (two in parallel), so a 166 MB upload
 * needed ~830 MB and a 421 MB one over 2 GB. Every production video at or
 * below 138.6 MB succeeded; every one at or above 166 MB died mid-generation
 * and left the user on a spinner. 150 MB sits in the gap with margin.
 */
export const MAX_UPLOAD_MB = 150;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
export const UPLOAD_TOO_LARGE_MESSAGE =
  "Videos over 150 MB aren’t supported yet. Try trimming or compressing first.";

export function isUploadTooLarge(bytes: number): boolean {
  return bytes > MAX_UPLOAD_BYTES;
}
