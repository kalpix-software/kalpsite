'use client';

import { useEffect, useState } from 'react';
import { Coins, Gem } from 'lucide-react';
import { getWallet } from '@/lib/store-api';
import type { Wallet } from '@/lib/store-types';

function formatBalance(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function WalletBar() {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const w = await getWallet();
      setWallet(w);
    } catch {
      setWallet({ coins: 0, gems: 0 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !wallet) {
    return (
      <div className="flex items-center gap-4 text-slate-400">
        <span className="animate-pulse">Loading…</span>
      </div>
    );
  }

  const coins = wallet?.coins ?? 0;
  const gems = wallet?.gems ?? 0;

  return (
    <div className="flex items-center gap-4 text-slate-200">
      <div className="flex items-center gap-1.5">
        <Coins className="w-5 h-5 text-amber-400" />
        <span className="font-semibold tabular-nums">{formatBalance(coins)}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <Gem className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold tabular-nums">{formatBalance(gems)}</span>
      </div>
    </div>
  );
}

