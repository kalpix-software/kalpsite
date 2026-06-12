import { headers } from 'next/headers';
import { appForHost, type AppConfig } from '@/lib/apps';

// The invite landing page. When the app IS installed, the OS intercepts the
// /i/<code> URL and opens the app before this page ever renders. This page is
// the fallback for "app not installed" (or desktop): it previews the group and
// offers store buttons.
export const dynamic = 'force-dynamic';

type Resolved = {
  channelId: string;
  name: string;
  description?: string;
  iconUrl?: string;
  memberCount: number;
  expired: boolean;
  full: boolean;
  alreadyMember: boolean;
};

async function resolveInvite(app: AppConfig, code: string): Promise<Resolved | null> {
  try {
    const res = await fetch(`${app.apiBase}/api/v1/chat/resolve_invite_link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
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
}

export default async function InvitePage({ params }: { params: { code: string } }) {
  const host = headers().get('host');
  const app = appForHost(host);
  const code = params.code;

  if (!app) {
    return <Card title="Invite" subtitle="This invite link is not configured." />;
  }

  const data = await resolveInvite(app, code);

  let subtitle: string;
  if (!data) {
    subtitle = `Open this invite in ${app.name}.`;
  } else if (data.expired) {
    subtitle = 'This invite link has expired.';
  } else if (data.full) {
    subtitle = 'This invite link has reached its limit.';
  } else {
    const members = `${data.memberCount} member${data.memberCount === 1 ? '' : 's'}`;
    subtitle = data.description ? `${members} · ${data.description}` : members;
  }

  return (
    <Card
      appName={app.name}
      icon={data?.iconUrl}
      title={data?.name ?? `Join a group on ${app.name}`}
      subtitle={subtitle}
      openHref={`https://${host}/i/${code}`}
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
  openHref?: string;
  playUrl?: string;
  appStoreUrl?: string;
}) {
  const { appName, icon, title, subtitle, openHref, playUrl, appStoreUrl } = props;
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
            borderRadius: 24,
            background: '#23262f',
            backgroundImage: icon ? `url(${icon})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        />
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
