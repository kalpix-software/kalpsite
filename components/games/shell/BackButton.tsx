'use client';

import { ChevronLeft } from 'lucide-react';
import { lobbyTheme } from '@/components/games/shell/theme';

/**
 * Ask the Plak webview host to close the webview.
 *
 * No-op in a plain browser, where the KalpixNative channel is absent — the page
 * is then reachable by URL and the browser supplies its own back.
 */
export function closeWebview(): void {
  if (typeof window === 'undefined') return;
  const native = (
    window as unknown as { KalpixNative?: { postMessage: (msg: string) => void } }
  ).KalpixNative;
  native?.postMessage?.(JSON.stringify({ action: 'close_webview' }));
}

/**
 * On-screen back control for every chess webview screen.
 *
 * iOS has no system back button and the webview shows no browser chrome, so
 * without this the only way off a sub-page is the Android hardware button —
 * i.e. iOS players could reach the match screen and not leave it. The native
 * `__kalpixHandleBack` bridge covers the hardware button; this covers the
 * absence of one, and both must do the same thing on a given screen.
 *
 * Pass `onBack` on a sub-page to move within the SPA. Omit it on an entry page
 * (the lobby) and it asks the host to leave the webview, mirroring what the
 * bridge reports when no handler is registered.
 */
export default function BackButton({
  onBack,
  label = 'Back',
  className = '',
}: {
  onBack?: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => (onBack ? onBack() : closeWebview())}
      aria-label={label}
      title={label}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95 ${className}`}
      style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${lobbyTheme.divider}` }}
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
