import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Chess — Kalpix',
};

// Webview-friendly viewport: no zoom, fits notches, dark background to avoid
// the white-flash that gives away "this is a webview" on a cold load.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#09090b',
};

export default function ChessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-dvh bg-zinc-950 text-white">{children}</div>;
}
