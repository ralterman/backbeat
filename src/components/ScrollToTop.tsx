"use client";

import { useEffect } from "react";

/**
 * Renders nothing. On mount, sets scrollRestoration to "manual" and scrolls
 * to the top of the page. This prevents browsers (especially mobile Safari)
 * from restoring the previous scroll position on a hard refresh.
 *
 * Place this component anywhere inside a page — it's a no-op render.
 */
export default function ScrollToTop() {
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  return null;
}
