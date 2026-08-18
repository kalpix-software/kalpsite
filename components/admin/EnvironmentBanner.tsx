import { describeEnvironment } from '@/lib/environment';

/**
 * Shows which environment this admin session is acting on.
 *
 * Two kalpsite windows look identical, and the actions here are destructive in
 * the ordinary sense — publishing a broadcast, changing store prices, replacing
 * a background every player sees. Without a persistent marker, "which one is
 * this?" is answered by memory, and eventually answered wrongly.
 *
 * Production is intentionally the quiet state: a permanent red banner trains
 * people to ignore banners. Staging and misconfiguration are what stand out.
 */
export default function EnvironmentBanner() {
  const { env, label, detail } = describeEnvironment();

  if (env === 'production') {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
          letterSpacing: '0.06em', background: '#7F1D1D', color: '#FEE2E2',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#FCA5A5' }} />
        PRODUCTION — changes are live for real players
      </div>
    );
  }

  const styles: Record<string, { bg: string; fg: string; dot: string; text: string }> = {
    staging: { bg: '#1E3A5F', fg: '#DBEAFE', dot: '#93C5FD', text: `STAGING — safe to experiment · ${detail ?? ''}` },
    local: { bg: '#3F3F46', fg: '#E4E4E7', dot: '#A1A1AA', text: `${label}` },
    misconfigured: { bg: '#78350F', fg: '#FEF3C7', dot: '#FCD34D', text: 'MISCONFIGURED — uploads would go to the wrong bucket' },
  };
  const s = styles[env] ?? styles.misconfigured;

  return (
    <div
      title={env === 'misconfigured' ? detail : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.3rem 0.75rem', fontSize: '0.75rem', fontWeight: 600,
        letterSpacing: '0.06em', background: s.bg, color: s.fg,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
      {s.text}
    </div>
  );
}
