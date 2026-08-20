import { headers } from 'next/headers';
import { appForHost } from '@/lib/apps';

// The challenge landing page. When the app IS installed, the OS intercepts the
// /m/<gameId>/<matchId> URL and opens the app before this page ever renders.
// This page is the fallback for "app not installed" (or desktop): it names the
// game and offers store buttons. Mirrors app/i/[code] and app/p/[id].
//
// Deliberately no backend lookup. A challenge is a live match instance, not a
// stored record — asking the server about it would cost a round trip to learn
// something that can change between render and tap, and the page says the same
// thing either way: here is a game, get the app.
export const dynamic = 'force-dynamic';

/** Display names for the games that can issue a challenge link. */
const GAME_NAMES: Record<string, string> = {
  chess: 'Chess',
  tero: 'Tero',
};

export default async function ChallengePage({
  params,
}: {
  params: { gameId: string; matchId: string };
}) {
  const host = headers().get('host');
  const app = appForHost(host);
  const { gameId, matchId } = params;

  if (!app) {
    return <Card title="Challenge" subtitle="This link is not configured." />;
  }

  const game = GAME_NAMES[gameId.toLowerCase()];

  return (
    <Card
      appName={app.name}
      title={game ? `You've been challenged to ${game}` : 'You’ve been challenged'}
      subtitle={
        game
          ? `Open the link in ${app.name} to take the other side.`
          : `Open this challenge in ${app.name}.`
      }
      openHref={`https://${host}/m/${gameId}/${matchId}`}
      playUrl={app.playUrl}
      appStoreUrl={app.appStoreUrl}
    />
  );
}

function Card(props: {
  appName?: string;
  title: string;
  subtitle: string;
  openHref?: string;
  playUrl?: string;
  appStoreUrl?: string;
}) {
  const { appName, title, subtitle, openHref, playUrl, appStoreUrl } = props;
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0c10',
        color: '#f4f4f5',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          margin: '0 16px',
          padding: 28,
          borderRadius: 20,
          background: '#15171e',
          border: '1px solid #23262f',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            margin: '0 auto 16px',
            borderRadius: 24,
            background: '#23262f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 40,
            lineHeight: 1,
          }}
        >
          ♟
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>{title}</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 22px', lineHeight: 1.4 }}>
          {subtitle}
        </p>

        {openHref && (
          <a
            href={openHref}
            style={{
              display: 'block',
              padding: '13px 16px',
              borderRadius: 12,
              background: '#6d5efc',
              color: '#fff',
              fontWeight: 600,
              textDecoration: 'none',
              marginBottom: 10,
            }}
          >
            Open in {appName ?? 'app'}
          </a>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {appStoreUrl && (
            <a href={appStoreUrl} style={storeBtn}>
              App Store
            </a>
          )}
          {playUrl && (
            <a href={playUrl} style={storeBtn}>
              Google Play
            </a>
          )}
        </div>
      </div>
    </main>
  );
}

const storeBtn: React.CSSProperties = {
  flex: 1,
  padding: '11px 12px',
  borderRadius: 12,
  background: '#23262f',
  color: '#f4f4f5',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
};
