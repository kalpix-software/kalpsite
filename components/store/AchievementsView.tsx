'use client';

import { useEffect, useState } from 'react';
import { getAchievements, claimAchievementReward } from '@/lib/store-api';
import type { UserAchievement } from '@/lib/store-types';
interface AchievementsViewProps {
  onClaimed?: () => void;
}

export default function AchievementsView({ onClaimed }: AchievementsViewProps) {
  const [list, setList] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getAchievements();
      setList(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (achievementId: string) => {
    try {
      const res = await claimAchievementReward(achievementId);
      onClaimed?.();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim failed');
    }
  };

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error && list.length === 0) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Achievements</h2>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="space-y-2">
        {list.map((ua) => {
          const a = ua.achievement;
          const target = a?.targetValue ?? 0;
          const canClaim = ua.isCompleted && !ua.isClaimed;
          return (
            <div
              key={ua.achievementId}
              className="flex items-center justify-between p-4 rounded-xl bg-slate-800 border border-slate-700"
            >
              <div>
                <p className="font-medium text-slate-200">{a?.name ?? ua.achievementId}</p>
                <p className="text-sm text-slate-400">{a?.description}</p>
                <p className="text-xs text-slate-500 mt-1">
                  Progress: {ua.currentValue} / {target}
                </p>
                <div className="mt-1 w-48 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500"
                    style={{ width: `${target > 0 ? Math.min(100, (ua.currentValue / target) * 100) : 0}%` }}
                  />
                </div>
              </div>
              {canClaim && (
                <button
                  onClick={() => claim(ua.achievementId)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
                >
                  Claim
                </button>
              )}
            </div>
          );
        })}
      </div>
      {list.length === 0 && <p className="text-slate-500">No achievements.</p>}
    </div>
  );
}
