'use client';

import { useEffect, useState } from 'react';
import { getCurrentSeason, claimSeasonReward, purchasePremiumPass } from '@/lib/store-api';
import type { SeasonResponse } from '@/lib/store-types';
interface BattlePassViewProps {
  onAction?: () => void;
}

export default function BattlePassView({ onAction }: BattlePassViewProps) {
  const [data, setData] = useState<SeasonResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getCurrentSeason();
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (tierNumber: number, track: 'free' | 'premium') => {
    if (!data?.season) return;
    try {
      const res = await claimSeasonReward({
        seasonId: data.season.seasonId,
        tierNumber,
        track,
      });
      onAction?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    }
  };

  const buyPremium = async () => {
    if (!data?.season) return;
    try {
      const res = await purchasePremiumPass();
      onAction?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Purchase failed');
    }
  };

  if (loading && !data) return <p className="text-slate-400">Loading…</p>;
  if (error && !data) return <p className="text-red-400">{error}</p>;
  if (!data?.season) return <p className="text-slate-500">No active season.</p>;

  const progress = data.progress;
  const season = data.season;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{season.name}</h2>
          <p className="text-sm text-slate-400">
            {progress ? `Tier ${progress.currentTier} of ${season.totalTiers ?? data.tiers.length}` : 'No progress'}
          </p>
        </div>
        {progress && !progress.isPremium && (
          <button
            onClick={buyPremium}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            Unlock premium — {season.premiumPriceGems} gems
          </button>
        )}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="space-y-2">
        {data.tiers.slice(0, 20).map((tier) => {
          const canClaimFree = progress && progress.currentTier >= tier.tierNumber && !tier.freeRewardClaimed;
          const canClaimPremium = progress?.isPremium && progress.currentTier >= tier.tierNumber && !tier.premiumRewardClaimed;
          return (
            <div
              key={tier.tierNumber}
              className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700"
            >
              <span className="text-slate-200">Tier {tier.tierNumber}</span>
              <span className="text-sm text-slate-400">
                Free: {tier.freeRewardAmount ?? 0} · Premium: {tier.premiumRewardAmount ?? 0}
              </span>
              <div className="flex gap-2">
                {canClaimFree && (
                  <button
                    onClick={() => claim(tier.tierNumber, 'free')}
                    className="px-2 py-1 rounded bg-slate-600 hover:bg-slate-500 text-white text-xs"
                  >
                    Claim free
                  </button>
                )}
                {canClaimPremium && (
                  <button
                    onClick={() => claim(tier.tierNumber, 'premium')}
                    className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
                  >
                    Claim premium
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
