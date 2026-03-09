'use client';

import { useEffect, useState } from 'react';
import { getDailyRewards, claimDailyReward } from '@/lib/store-api';
import type { DailyRewardsResponse } from '@/lib/store-types';
interface DailyRewardsViewProps {
  onClaimed?: () => void;
}

export default function DailyRewardsView({ onClaimed }: DailyRewardsViewProps) {
  const [data, setData] = useState<DailyRewardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getDailyRewards();
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

  const handleClaim = async () => {
    if (!data?.canClaimToday) return;
    setClaiming(true);
    setError('');
    try {
      const res = await claimDailyReward();
      onClaimed?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    } finally {
      setClaiming(false);
    }
  };

  if (loading && !data) return <p className="text-slate-400">Loading…</p>;
  if (error && !data) return <p className="text-red-400">{error}</p>;
  if (!data) return null;

  const streak = data.streak;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Daily login rewards</h2>
          <p className="text-sm text-slate-400">
            Streak: {streak?.currentStreak ?? 0} days · Longest: {streak?.longestStreak ?? 0}
          </p>
        </div>
        {data.canClaimToday && (
          <button
            onClick={handleClaim}
            disabled={claiming}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
          >
            {claiming ? 'Claiming…' : 'Claim today’s reward'}
          </button>
        )}
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="grid grid-cols-7 gap-2">
        {data.rewards.map((r, i) => (
          <div
            key={r.day}
            className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center"
          >
            <p className="text-sm font-medium text-slate-300">Day {r.day}</p>
            <p className="text-xs text-slate-400 mt-1">
              {r.rewardType === 'gems' ? '💎' : '🪙'} {r.rewardAmount}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
