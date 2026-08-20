import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { appForHost, type AppConfig } from '@/lib/apps';

// The profile landing page. When the app IS installed, the OS intercepts the
// /p/<id> URL and opens the app before this page ever renders. This page is the
// fallback for "app not installed" (or desktop): it previews the player and
// offers store buttons. Mirrors app/i/[code]/page.tsx for group invites.
export const dynamic = 'force-dynamic';

type Resolved = {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  isPrivate: boolean;
  friendsCount: number;
  gamesPlayed: number;
  totalWins: number;
};

// Memoized per request: generateMetadata and the page body both need the profile,
// and this must stay a single backend round-trip.
const resolveProfile = cache(async (app: AppConfig, userId: string): Promise<Resolved | null> => {
  try {
    const res = await fetch(`${app.apiBase}/api/v1/profile/resolve_link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Backend envelope: { success, data }
    if (json?.success && json?.data) return json.data as Resolved;
    return null;
  } catch {
    return null;
  }
});

/** Best display label for a resolved profile. */
function nameOf(data: Resolved): string {
  return data.displayName?.trim() || (data.username ? `@${data.username}` : 'Plak player');
}

/** One-line summary under the name: bio for public profiles, counts otherwise. */
function summaryOf(data: Resolved, appName: string): string {
  if (data.isPrivate) return `This profile is private. Open it in ${appName}.`;
  const bio = data.bio?.trim();
  if (bio) return bio;
  const friends = `${data.friendsCount} friend${data.friendsCount === 1 ? '' : 's'}`;
  return data.totalWins > 0 ? `${friends} · ${data.totalWins} wins` : friends;
}

// Link previews (WhatsApp, iMessage, Slack…) read these — a shared profile should
// unfurl as the player, not as a bare URL.
export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const app = appForHost(headers().get('host'));
  if (!app) return { title: 'Profile' };

  const data = await resolveProfile(app, params.id);
  if (!data) {
    return {
      title: `Profile on ${app.name}`,
      description: `Open this profile in ${app.name}.`,
    };
  }

  const title = `${nameOf(data)} on ${app.name}`;
  const description = summaryOf(data, app.name);
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: data.avatarUrl ? [data.avatarUrl] : undefined,
    },
    twitter: {
      card: data.avatarUrl ? 'summary' : 'summary_large_image',
      title,
      description,
      images: data.avatarUrl ? [data.avatarUrl] : undefined,
    },
  };
}

export default async function ProfilePage({ params }: { params: { id: string } }) {
  const host = headers().get('host');
  const app = appForHost(host);
  const id = params.id;

  if (!app) {
    return <Card title="Profile" subtitle="This profile link is not configured." />;
  }

  const data = await resolveProfile(app, id);

  return (
    <Card
      appName={app.name}
      icon={data?.avatarUrl}
      title={data ? nameOf(data) : `View a profile on ${app.name}`}
      subtitle={data ? summaryOf(data, app.name) : `Open this profile in ${app.name}.`}
      handle={data && data.displayName?.trim() && data.username ? `@${data.username}` : undefined}
      stats={
        data && !data.isPrivate
          ? [
              { label: 'Friends', value: data.friendsCount },
              { label: 'Games', value: data.gamesPlayed },
              { label: 'Wins', value: data.totalWins },
            ]
          : undefined
      }
      openHref={`https://${host}/p/${id}`}
      playUrl={app.playUrl}
      appStoreUrl={app.appStoreUrl}
    />
  );
}

function Card(props: {
  appName?: string;
  icon?: string;
  title: string;
  subtitle: string;
  handle?: string;
  stats?: { label: string; value: number }[];
  openHref?: string;
  playUrl?: string;
  appStoreUrl?: string;
}) {
  const { appName, icon, title, subtitle, handle, stats, openHref, playUrl, appStoreUrl } = props;
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d0e12',
        fontFamily:
          'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
            borderRadius: 42,
            background: '#23262f',
            backgroundImage: icon ? `url(${icon})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px' }}>{title}</h1>
        {handle && (
          <p style={{ fontSize: 14, opacity: 0.55, margin: '0 0 6px' }}>{handle}</p>
        )}
        <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 22px', lineHeight: 1.4 }}>
          {subtitle}
        </p>

        {stats && (
          <div style={{ display: 'flex', gap: 10, margin: '0 0 22px' }}>
            {stats.map((s) => (
              <div key={s.label} style={statBox}>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{s.value}</div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

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

const statBox: React.CSSProperties = {
  flex: 1,
  padding: '10px 8px',
  borderRadius: 12,
  background: '#1b1e27',
  border: '1px solid #23262f',
};

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
