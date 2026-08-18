import ChessLobbyClient from '@/components/games/chess/lobby/ChessLobbyClient';

// Deliberately NOT force-dynamic.
//
// Nothing here is rendered from server data: the whole lobby is a client
// component, and its runtime inputs (backend host, ssl, session token) arrive
// from the URL at load. force-dynamic made Next send
// `private, no-cache, no-store, must-revalidate` on the document, so the
// webview re-fetched and re-rendered the shell on every single open — the main
// reason opening chess feels like a web page rather than a screen.
//
// Static means the HTML is prerendered and served from the CDN edge. The JS and
// CSS were already `immutable` for a year; this closes the last uncached hop.
export default function ChessLobbyPage() {
  return <ChessLobbyClient />;
}
