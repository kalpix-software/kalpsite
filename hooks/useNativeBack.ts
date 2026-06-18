'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    /**
     * Back-button bridge for the Plazy webview host. Flutter calls this when
     * the user presses the device or title-bar back button. Returns 'handled'
     * if the web app navigated within its own SPA, or 'pop' to let the native
     * host leave the webview (back to the games catalog).
     *
     * The return is a STRING, not a boolean, on purpose: it has to survive
     * Android/iOS differences in webview_flutter's runJavaScriptReturningResult
     * (which round-trips values differently per platform). Flutter just checks
     * whether the result contains 'handled'.
     */
    __kalpixHandleBack?: () => string;
  }
}

/**
 * Register an in-app back handler for the duration of a "sub-page" (e.g. the
 * chess match screen). While mounted, the native back button runs `handler`
 * instead of leaving the webview; return true if you navigated (so the host
 * stays put), false to let the host pop the route.
 *
 * Pages that ARE the webview entry (e.g. the chess lobby) simply don't call
 * this — with no handler registered the bridge reports 'pop' and the native
 * host leaves the game, which is the correct behaviour at the entry page.
 */
export function useNativeBack(handler: () => boolean): void {
  // Hold the latest handler in a ref so we subscribe to the bridge exactly
  // once (on mount) yet always invoke the current closure — avoids re-binding
  // window.__kalpixHandleBack on every render.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const previous = window.__kalpixHandleBack;
    window.__kalpixHandleBack = () => (handlerRef.current() ? 'handled' : 'pop');
    return () => {
      // Restore whatever was registered before us (usually nothing), so a
      // sub-page unmounting hands control back to the entry page's behaviour.
      window.__kalpixHandleBack = previous;
    };
  }, []);
}
