'use client';

import { useEffect, useState } from 'react';

// The code pill on the referral landing page.
//
// Why this is a client component at all: on a fresh install the LINK cannot
// follow the user into the app — the store hands off nothing. The referral code
// is the only part of the invite that survives, so the whole page exists to get
// those characters onto the clipboard. It copies once on mount (best effort,
// silently ignored where the browser forbids it without a gesture) and again on
// tap, which always works because a tap is a user gesture.
export default function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fire-and-forget: Safari and Firefox reject clipboard writes without a
    // user gesture. When it fails the user still has the tap path below, so
    // there is nothing to report.
    navigator.clipboard?.writeText(code).then(
      () => setCopied(true),
      () => undefined,
    );
  }, [code]);

  const onCopy = () => {
    navigator.clipboard?.writeText(code).then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <button
      type="button"
      onClick={onCopy}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        marginBottom: 18,
        borderRadius: 12,
        background: '#1b1e27',
        border: '1px dashed #4b4f5e',
        color: '#f4f4f5',
        cursor: 'pointer',
        font: 'inherit',
      }}
    >
      <span style={{ fontSize: 11, opacity: 0.6, letterSpacing: 0.6 }}>CODE</span>
      <span
        style={{
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 4,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {code}
      </span>
      <span style={{ fontSize: 12, opacity: 0.75, minWidth: 44, textAlign: 'right' }}>
        {copied ? 'Copied' : 'Tap'}
      </span>
    </button>
  );
}
