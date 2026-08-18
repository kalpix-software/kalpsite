'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  iconUrl: string;
  category: string;
  targetValue: number;
  rewardType: string;
  rewardAmount: number;
  rewardItemId: string;
  sortOrder: number;
  isActive: boolean;
}

interface UserAchievement {
  achievementId: string;
  achievement?: Achievement;
  currentValue: number;
  isCompleted: boolean;
  completedAt: number;
  isClaimed: boolean;
  claimedAt: number;
}

const CATEGORY_STYLES: Record<string, string> = {
  general: 'bg-slate-500/10 text-slate-400',
  chat: 'bg-indigo-400/10 text-indigo-400',
  game: 'bg-emerald-400/10 text-emerald-400',
  social: 'bg-purple-400/10 text-purple-400',
};

const REWARD_COLORS: Record<string, string> = {
  coins: 'text-amber-400',
  gems: 'text-purple-400',
  item: 'text-emerald-400',
};

export default function AdminAchievementsPage() {
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await callAdminRpc(
        'store/get_achievements',
        JSON.stringify({ category: categoryFilter || undefined })
      )) as { data?: { achievements?: UserAchievement[] }; achievements?: UserAchievement[] };
      const d = res?.data ?? res;
      setAchievements(d?.achievements ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped: Record<string, UserAchievement[]> = {};
  achievements.forEach((ua) => {
    const cat = ua.achievement?.category ?? 'unknown';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(ua);
  });

  const stats = {
    total: achievements.length,
    completed: achievements.filter((a) => a.isCompleted).length,
    claimed: achievements.filter((a) => a.isClaimed).length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Achievements</h1>
          <p className="text-sm text-slate-400 mt-1">
            Track player milestones and reward progress. Achievements span all 3 domains.
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

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6 max-w-md">
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-slate-100">{stats.total}</p>
          <p className="text-xs text-slate-400">Total</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-emerald-400">{stats.completed}</p>
          <p className="text-xs text-slate-400">Completed</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-amber-400">{stats.claimed}</p>
          <p className="text-xs text-slate-400">Claimed</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-2">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm"
        >
          <option value="">All Categories</option>
          <option value="general">General</option>
          <option value="chat">Chat</option>
          <option value="game">Game</option>
          <option value="social">Social</option>
        </select>
      </div>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : achievements.length === 0 ? (
        <p className="text-slate-500">
          No achievements found. Run the migration SQL to seed the default achievements.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                {category}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((ua) => {
                  const ach = ua.achievement;
                  if (!ach) return null;
                  const progress = ach.targetValue > 0 ? Math.min(100, (ua.currentValue / ach.targetValue) * 100) : 0;
                  return (
                    <div
                      key={ua.achievementId}
                      className={`p-4 rounded-xl bg-slate-800 border transition ${
                        ua.isCompleted ? 'border-emerald-500/40' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            CATEGORY_STYLES[ach.category] ?? CATEGORY_STYLES.general
                          }`}
                        >
                          {ach.category}
                        </span>
                        {ua.isCompleted && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
                            {ua.isClaimed ? 'Claimed' : 'Completed'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-100">{ach.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{ach.description}</p>

                      {/* Progress Bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400">
                            {ua.currentValue.toLocaleString()} / {ach.targetValue.toLocaleString()}
                          </span>
                          <span className="text-slate-500">{Math.floor(progress)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              ua.isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Reward */}
                      <div className="mt-2 text-xs">
                        <span className="text-slate-500">Reward: </span>
                        <span className={REWARD_COLORS[ach.rewardType] ?? 'text-slate-300'}>
                          {ach.rewardAmount.toLocaleString()} {ach.rewardType}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
