"use client";

export function CookiePreferencesButton() {
  const reset = () => {
    try {
      localStorage.removeItem("backbeat_cookie_consent");
      window.location.reload();
    } catch {}
  };

  return (
    <button
      onClick={reset}
      className="hover:text-[#C8A96E] transition-colors cursor-pointer bg-transparent border-none text-inherit text-sm font-inherit"
    >
      Cookie preferences
    </button>
  );
}
