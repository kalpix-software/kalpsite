'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface RewardTier {
  day: number;
  rewardType: string;
  rewardAmount: number;
  itemId: string;
  description: string;
}

interface LoginStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string;
  totalClaims: number;
}

interface DailyRewardsData {
  rewards: RewardTier[];
  streak: LoginStreak;
  canClaimToday: boolean;
  nextRewardDay: number;
}

const REWARD_TYPE_COLORS: Record<string, string> = {
  coins: 'text-amber-400 bg-amber-400/10',
  gems: 'text-purple-400 bg-purple-400/10',
  item: 'text-emerald-400 bg-emerald-400/10',
};

export default function AdminRewardsPage() {
  const [data, setData] = useState<DailyRewardsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await callAdminRpc('store/get_daily_rewards');
      const rewardsData = (raw.data ?? raw) as unknown as DailyRewardsData;
      setData(rewardsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rewards = data?.rewards ?? [];
  const streak = data?.streak;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Daily Login Rewards</h1>
          <p className="text-sm text-slate-400 mt-1">
            7-day cycling reward schedule. Users earn rewards by logging in daily.
          </p>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {/* Admin's own streak (for testing) */}
      {streak && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 max-w-2xl">
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-emerald-400">{streak.currentStreak}</p>
            <p className="text-xs text-slate-400">Current Streak</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-indigo-400">{streak.longestStreak}</p>
            <p className="text-xs text-slate-400">Longest Streak</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-slate-100">{streak.totalClaims}</p>
            <p className="text-xs text-slate-400">Total Claims</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
            <p className="text-2xl font-bold text-slate-100">{streak.lastClaimDate || '—'}</p>
            <p className="text-xs text-slate-400">Last Claim</p>
          </div>
        </div>
      )}

      {/* Reward Tiers */}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : rewards.length === 0 ? (
        <p className="text-slate-500">
          No reward tiers found. Run the migration SQL to seed the default 7-day rewards.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl">
          {rewards.map((r) => {
            const colorClass = REWARD_TYPE_COLORS[r.rewardType] ?? 'text-slate-300 bg-slate-700';
            const isNext = data?.nextRewardDay === r.day;
            return (
              <div
                key={r.day}
                className={`relative p-4 rounded-xl bg-slate-800 border transition ${
                  isNext ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-700'
                }`}
              >
                {isNext && (
                  <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold uppercase tracking-wider text-white">
                    Next
                  </span>
                )}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase">Day {r.day}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-bold ${colorClass.split(' ')[0]}`}>
                    {r.rewardAmount.toLocaleString()}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colorClass}`}>
                    {r.rewardType}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">{r.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Test claim (for admin testing) */}
      {data?.canClaimToday && (
        <div className="mt-8 p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30 max-w-md">
          <p className="text-sm text-emerald-300 mb-2">You can claim today&apos;s reward (admin test):</p>
          <button
            onClick={async () => {
              try {
                await callAdminRpc('store/claim_daily_reward');
                load();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Claim failed');
              }
            }}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
          >
            Claim Day {data.nextRewardDay} Reward
          </button>
        </div>
      )}
    </div>
  );
}
