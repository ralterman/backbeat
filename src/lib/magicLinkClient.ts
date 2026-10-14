/** Client-side call to /api/auth/magic-link. Throws an Error whose message
 *  is safe to show to the user. */
export async function requestMagicLink(params: {
  email: string;
  callbackUrl: string;
  turnstileToken: string | null;
}): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    throw new Error("Network error. Please try again.");
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? "We couldn't send the sign-in email. Please try again.");
  }
}
