'use client';

import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

import type { GameApi, TierPrizes } from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

import { DialogShell } from './CreatePrivateDialog';

// "Select your table" — the chess equivalent of Tero's entry-fee picker.
//
// Tiers come from game/get_catalog metadata (the backend embeds them there
// rather than exposing a separate RPC), so the fee/prize numbers can never
// drift from the server's own arithmetic.
//
// A free table is always offered and is the only one that falls back to a bot
// opponent: on a paid table a bot stakes nothing while the human stakes the
// fee, which would mint coins on every win.

export interface TierPickerDialogProps {
  games: GameApi;
  timeControl: 'blitz' | 'rapid';
  /** The player's chess level, for the unlock gate. */
  level: number;
  onPick(tier: string): void;
  onClose(): void;
}

const TIER_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  medium: 'Medium',
  elite: 'Elite',
};

export default function TierPickerDialog(p: TierPickerDialogProps) {
  const [tiers, setTiers] = useState<TierPrizes[] | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, wallet] = await Promise.all([
          p.games.getCatalog(),
          // Non-fatal: without a balance we simply don't grey anything out.
          p.games.getWallet().catch(() => null),
        ]);
        if (cancelled) return;
        const chess = catalog.games?.find((g) => g.gameId === 'chess');
        setTiers(chess?.metadata?.entryTiers?.tiers ?? []);
        setCoins(wallet?.coins ?? null);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [p.games]);

  return (
    <DialogShell title="Select your table" onClose={p.onClose}>
      <div className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(229,72,77,0.15)', color: lobbyTheme.danger }}>
            {error}
          </div>
        )}

        {tiers === null && !error && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: lobbyTheme.textDim }} />
          </div>
        )}

        {/* Free table — always available, and the only one with a bot fallback. */}
        {tiers !== null && (
          <TableRow
            title="Casual"
            subtitle="Free · bot opponent if nobody's waiting"
            fee={0}
            prize={0}
            locked={false}
            affordable
            onPick={() => p.onPick('')}
          />
        )}

        {tiers?.map((t) => {
          const prize = t.prizesByMode?.[p.timeControl]?.afterRake ?? 0;
          const locked = p.level < t.levelUnlock;
          const affordable = coins === null || coins >= t.entryFee;
          return (
            <TableRow
              key={t.tier}
              title={TIER_LABELS[t.tier] ?? t.tier}
              subtitle={locked ? `Unlocks at level ${t.levelUnlock}` : `Winner takes ${prize}`}
              fee={t.entryFee}
              prize={prize}
              locked={locked}
              affordable={affordable}
              onPick={() => p.onPick(t.tier)}
            />
          );
        })}

        {coins !== null && (
          <div className="pt-1 text-center text-xs" style={{ color: lobbyTheme.textDim }}>
            Balance: {coins} coins
          </div>
        )}
      </div>
    </DialogShell>
  );
}

function TableRow({
  title, subtitle, fee, locked, affordable, onPick,
}: {
  title: string;
  subtitle: string;
  fee: number;
  prize: number;
  locked: boolean;
  affordable: boolean;
  onPick(): void;
}) {
  const disabled = locked || !affordable;
  return (
    <button
      onClick={onPick}
      disabled={disabled}
      className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition disabled:opacity-45"
      style={{
        background: lobbyTheme.cardSoft,
        border: `1px solid ${disabled ? 'transparent' : lobbyTheme.primaryBorder}`,
      }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: lobbyTheme.text }}>
          {locked && <Lock className="h-3.5 w-3.5" />}
          {title}
        </div>
        <div className="truncate text-xs" style={{ color: lobbyTheme.textMuted }}>
          {!affordable && !locked ? 'Not enough coins' : subtitle}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 pl-3">
        {fee > 0 ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/coin.webp" alt="coins" className="h-[18px] w-[18px] object-contain" />
            <span className="text-sm font-extrabold" style={{ color: lobbyTheme.text }}>{fee}</span>
          </>
        ) : (
          <span className="text-sm font-extrabold" style={{ color: lobbyTheme.text }}>Free</span>
        )}
      </div>
    </button>
  );
}
