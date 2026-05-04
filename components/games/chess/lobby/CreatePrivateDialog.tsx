'use client';

import { useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';

import type { GameApi } from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

type Tab = 'create' | 'join';
type TimeControl = 'blitz' | 'rapid';

interface CreatedMatch {
  matchId: string;
  timeControl: TimeControl;
}

export interface CreatePrivateDialogProps {
  games: GameApi;
  onClose(): void;
  onMatchReady(matchId: string): void;
}

export default function CreatePrivateDialog({
  games,
  onClose,
  onMatchReady,
}: CreatePrivateDialogProps) {
  const [tab, setTab] = useState<Tab>('create');
  const [tc, setTc] = useState<TimeControl>('blitz');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [matchIdInput, setMatchIdInput] = useState('');
  // After creating a private match we DON'T auto-navigate. We park the user
  // on an "invite" panel where they can copy / share the match id, then
  // "Start" once a friend has joined (or any time — the match stays open).
  const [created, setCreated] = useState<CreatedMatch | null>(null);

  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await games.createChessMatch({
        timeControl: tc,
        matchType: 'private',
        rated: false,
      });
      setCreated({ matchId: r.matchId, timeControl: tc });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    if (!matchIdInput.trim()) {
      setErr('Enter a match ID');
      return;
    }
    onMatchReady(matchIdInput.trim());
  };

  // ── Invite panel (post-create) ─────────────────────────────────────────
  if (created) {
    return (
      <DialogShell title="Match created" onClose={onClose}>
        <InvitePanel
          matchId={created.matchId}
          timeControl={created.timeControl}
          onEnter={() => onMatchReady(created.matchId)}
        />
      </DialogShell>
    );
  }

  return (
    <DialogShell title="Private Match" onClose={onClose}>
      <div
        className="flex gap-1 rounded-full p-1"
        style={{ background: lobbyTheme.cardSoft }}
      >
        {(['create', 'join'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 rounded-full py-2 text-sm font-medium transition-colors"
            style={{
              background: t === tab ? lobbyTheme.primary : 'transparent',
              color: t === tab ? '#fff' : lobbyTheme.textMuted,
            }}
          >
            {t === 'create' ? 'Create' : 'Join'}
          </button>
        ))}
      </div>

      {tab === 'create' ? (
        <>
          <div className="mt-4 text-sm" style={{ color: lobbyTheme.textMuted }}>
            Time control
          </div>
          <div className="mt-2 flex gap-2">
            {(['blitz', 'rapid'] as TimeControl[]).map((t) => (
              <button
                key={t}
                onClick={() => setTc(t)}
                className="flex-1 rounded-lg border-2 px-3 py-3 text-sm font-medium"
                style={{
                  borderColor: t === tc ? lobbyTheme.primary : 'transparent',
                  background: t === tc ? lobbyTheme.primarySoft : lobbyTheme.cardSoft,
                  color: '#fff',
                }}
              >
                {t === 'blitz' ? 'Blitz 5+0' : 'Rapid 10+0'}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mt-4 text-sm" style={{ color: lobbyTheme.textMuted }}>
            Match ID
          </div>
          <input
            value={matchIdInput}
            onChange={(e) => setMatchIdInput(e.target.value)}
            placeholder="Paste match ID"
            className="mt-2 w-full rounded-lg px-3 py-3 text-sm text-white outline-none"
            style={{
              background: lobbyTheme.cardSoft,
              border: `1px solid ${lobbyTheme.divider}`,
            }}
          />
        </>
      )}

      {err && (
        <div
          className="mt-3 rounded-lg p-2 text-xs"
          style={{ background: 'rgba(229,72,77,0.15)', color: lobbyTheme.danger }}
        >
          {err}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg py-3 text-sm font-semibold"
          style={{
            background: lobbyTheme.cardSoft,
            color: lobbyTheme.textMuted,
          }}
        >
          Close
        </button>
        <button
          onClick={tab === 'create' ? create : join}
          disabled={busy}
          className="flex-1 rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: lobbyTheme.primary }}
        >
          {busy ? 'Creating…' : tab === 'create' ? 'Create' : 'Join'}
        </button>
      </div>
    </DialogShell>
  );
}

// ── Invite panel ─────────────────────────────────────────────────────────

function InvitePanel({
  matchId,
  timeControl,
  onEnter,
}: {
  matchId: string;
  timeControl: TimeControl;
  onEnter(): void;
}) {
  const [copied, setCopied] = useState(false);
  const tcLabel = timeControl === 'blitz' ? 'Blitz 5+0' : 'Rapid 10+0';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(matchId);
    } catch {
      // Some webviews block the async clipboard API — fall back to
      // selectionRange + execCommand on a hidden textarea.
      const ta = document.createElement('textarea');
      ta.value = matchId;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const share = async () => {
    const text = buildInviteText(matchId, tcLabel);
    // Inside the Plazy webview, use the native share sheet via the
    // kalpix_share JS handler the Flutter side registers. Outside (regular
    // browser), fall back to navigator.share, then copy.
    const bridge =
      typeof window !== 'undefined'
        ? (window as unknown as {
            flutter_inappwebview?: {
              callHandler<T = unknown>(name: string, ...args: unknown[]): Promise<T>;
            };
          }).flutter_inappwebview
        : undefined;
    if (bridge) {
      try {
        await bridge.callHandler('kalpix_share', text);
        return;
      } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'Chess match invite', text });
        return;
      } catch {}
    }
    await copy();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm" style={{ color: lobbyTheme.textMuted }}>
        {tcLabel} · waiting for opponent
      </div>

      <div className="text-xs" style={{ color: lobbyTheme.textDim }}>
        Match ID
      </div>
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{
          background: lobbyTheme.cardSoft,
          border: `1px solid ${lobbyTheme.divider}`,
        }}
      >
        <span className="flex-1 break-all font-mono text-xs text-white">
          {matchId}
        </span>
        <button
          onClick={copy}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          aria-label="Copy match ID"
        >
          {copied ? (
            <Check className="h-4 w-4" style={{ color: lobbyTheme.success }} />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      <div className="text-[11px]" style={{ color: lobbyTheme.textDim }}>
        Send this match ID to your friend. They can paste it in the Join tab
        of their Chess lobby to enter the same match.
      </div>

      <button
        onClick={share}
        className="flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white"
        style={{ background: lobbyTheme.primary }}
      >
        <Share2 className="h-4 w-4" />
        Share invite
      </button>

      <button
        onClick={onEnter}
        className="rounded-lg py-3 text-sm font-semibold"
        style={{
          background: lobbyTheme.cardSoft,
          color: lobbyTheme.text,
          border: `1px solid ${lobbyTheme.divider}`,
        }}
      >
        Enter match
      </button>
    </div>
  );
}

function buildInviteText(matchId: string, tcLabel: string): string {
  return [
    `Join my chess game on Kalpix!`,
    ``,
    `Time control: ${tcLabel}`,
    `Match ID: ${matchId}`,
    ``,
    `Open Kalpix → Games → Chess → Create Private Game → Join tab → paste the match ID.`,
  ].join('\n');
}

export function DialogShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose(): void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 sm:items-center">
      <div
        className="w-full max-w-md rounded-t-2xl p-5 sm:rounded-2xl"
        style={{
          background: lobbyTheme.bg,
          border: `1px solid ${lobbyTheme.divider}`,
          boxShadow: '0 -8px 40px rgba(0,0,0,0.5)',
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold text-white">{title}</div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
