import { cache } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { appForHost, type AppConfig } from '@/lib/apps';
import CopyCodeButton from './CopyCodeButton';

// The Refer and Earn landing page. Unlike /i/* and /p/*, the audience here is
// almost always someone who does NOT have the app — that is the entire point of
// a referral — so the store buttons and the copyable code are the primary
// content, not a fallback. Mirrors app/p/[id]/page.tsx.
export const dynamic = 'force-dynamic';

type Resolved = {
  code: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  welcomeCoins: number;
};

// Memoized per request: generateMetadata and the page body both need the
// referrer, and this must stay a single backend round-trip.
const resolveReferral = cache(
  async (app: AppConfig, code: string): Promise<Resolved | null> => {
    try {
      const res = await fetch(`${app.apiBase}/api/v1/referral/resolve_code`, {
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
  },
);

/** Best display label for a resolved referrer. */
function nameOf(data: Resolved): string {
  return data.displayName?.trim() || (data.username ? `@${data.username}` : 'A friend');
}

function coinsOf(data: Resolved): string {
  return (data.welcomeCoins || 0).toLocaleString('en-US');
}

// Link previews (WhatsApp, iMessage, Slack…) read these. This matters more for
// referrals than anywhere else on the site: the unfurl showing a real person's
// name is what makes the link look like an invitation rather than spam.
export async function generateMetadata({
  params,
}: {
  params: { code: string };
}): Promise<Metadata> {
  const app = appForHost(headers().get('host'));
  if (!app) return { title: 'Referral' };

  const data = await resolveReferral(app, params.code);
  if (!data) {
    return {
      title: `Join ${app.name}`,
      description: `Open this invite in ${app.name}.`,
    };
  }

  const title = `${nameOf(data)} invited you to ${app.name}`;
  const description = `Use code ${data.code} and get ${coinsOf(data)} free coins to start.`;
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

export default async function ReferralPage({ params }: { params: { code: string } }) {
  const host = headers().get('host');
  const app = appForHost(host);
  const code = params.code;

  if (!app) {
    return <Card title="Referral" subtitle="This referral link is not configured." />;
  }

  const data = await resolveReferral(app, code);

  // An unknown code still renders the page rather than an error: the visitor is
  // a prospective install either way, and the app will reject a bad code at
  // redeem time with a clear message.
  return (
    <Card
      appName={app.name}
      icon={data?.avatarUrl}
      title={data ? `${nameOf(data)} invited you to ${app.name}` : `Join ${app.name}`}
      subtitle={
        data
          ? `Install ${app.name}, enter the code below and get ${coinsOf(data)} free coins.`
          : `Install ${app.name} and enter your referral code to claim your bonus.`
      }
      code={data?.code ?? code}
      openHref={`https://${host}/r/${code}`}
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
  code?: string;
  openHref?: string;
  playUrl?: string;
  appStoreUrl?: string;
}) {
  const { appName, icon, title, subtitle, code, openHref, playUrl, appStoreUrl } = props;
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
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px' }}>{title}</h1>
        <p style={{ fontSize: 14, opacity: 0.7, margin: '0 0 22px', lineHeight: 1.4 }}>
          {subtitle}
        </p>

        {code && <CopyCodeButton code={code} />}

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

        {openHref && (
          <a
            href={openHref}
            style={{
              display: 'block',
              marginTop: 14,
              fontSize: 13,
              opacity: 0.6,
              color: '#f4f4f5',
              textDecoration: 'none',
            }}
          >
            Already have {appName ?? 'the app'}? Open it
          </a>
        )}
      </div>
    </main>
  );
}

const storeBtn: React.CSSProperties = {
  flex: 1,
  padding: '13px 12px',
  borderRadius: 12,
  background: '#6d5efc',
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  textDecoration: 'none',
};
