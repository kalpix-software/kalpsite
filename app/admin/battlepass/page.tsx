'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface SeasonTier {
  tierNumber: number;
  xpRequired: number;
  freeRewardType: string;
  freeRewardAmount: number;
  freeRewardItemId: string;
  premiumRewardType: string;
  premiumRewardAmount: number;
  premiumRewardItemId: string;
  freeRewardClaimed?: boolean;
  premiumRewardClaimed?: boolean;
}

interface Season {
  seasonId: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  premiumPriceCoins: number;
  premiumPriceGems: number;
  isActive: boolean;
  totalTiers: number;
}

interface SeasonProgress {
  userId: string;
  seasonId: string;
  currentXp: number;
  currentTier: number;
  isPremium: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
}

interface SeasonData {
  season: Season;
  tiers: SeasonTier[];
  progress?: SeasonProgress;
}

const REWARD_COLORS: Record<string, string> = {
  coins: 'text-amber-400',
  gems: 'text-purple-400',
  item: 'text-emerald-400',
};

function formatDate(unix: number): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysLeft(endTime: number): number {
  return Math.max(0, Math.ceil((endTime - Date.now() / 1000) / 86400));
}

export default function AdminBattlePassPage() {
  const [data, setData] = useState<SeasonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await callAdminRpc('store/get_current_season')) as {
        data?: SeasonData;
      } & SeasonData;
      setData(res?.data ?? res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed';
      if (msg.includes('No active season')) {
        setData(null);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const season = data?.season;
  const tiers = data?.tiers ?? [];
  const progress = data?.progress;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Battle Pass</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage seasons with free and premium reward tiers.
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

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : !season ? (
        <div className="p-6 rounded-xl bg-slate-800 border border-slate-700 max-w-lg">
          <p className="text-slate-400 mb-3">No active season found.</p>
          <p className="text-sm text-slate-500">
            Insert a season via SQL or admin API:
          </p>
          <pre className="mt-2 text-xs bg-slate-900 p-3 rounded-lg text-slate-400 overflow-x-auto">
{`INSERT INTO seasons
  (season_id, name, description, start_time, end_time,
   premium_price_coins, premium_price_gems, is_active)
VALUES
  ('season_1', 'Season 1: Launch',
   'The first ever Kalpix season!',
   ${Math.floor(Date.now() / 1000)},
   ${Math.floor(Date.now() / 1000) + 30 * 86400},
   0, 500, true);`}
          </pre>
        </div>
      ) : (
        <>
          {/* Season Header */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-600/20 to-purple-600/20 border border-indigo-500/30 mb-6 max-w-2xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-100">{season.name}</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400 font-medium">
                Active
              </span>
            </div>
            <p className="text-sm text-slate-400 mb-3">{season.description}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-slate-500">Starts</p>
                <p className="text-sm text-slate-200">{formatDate(season.startTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Ends</p>
                <p className="text-sm text-slate-200">{formatDate(season.endTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Days Left</p>
                <p className="text-sm text-slate-200">{daysLeft(season.endTime)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Premium Price</p>
                <p className="text-sm">
                  {season.premiumPriceGems > 0 && (
                    <span className="text-purple-400">{season.premiumPriceGems} gems</span>
                  )}
                  {season.premiumPriceCoins > 0 && (
                    <span className="text-amber-400 ml-1">{season.premiumPriceCoins} coins</span>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Admin Progress (for testing) */}
          {progress && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-2xl">
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <p className="text-xl font-bold text-indigo-400">{progress.currentXp}</p>
                <p className="text-xs text-slate-400">Current XP</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <p className="text-xl font-bold text-slate-100">
                  {progress.currentTier}/{season.totalTiers}
                </p>
                <p className="text-xs text-slate-400">Tier</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <p className="text-xl font-bold text-slate-100">
                  {progress.isPremium ? 'Yes' : 'No'}
                </p>
                <p className="text-xs text-slate-400">Premium</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
                <p className="text-xl font-bold text-emerald-400">
                  {progress.claimedFreeTiers.length + progress.claimedPremiumTiers.length}
                </p>
                <p className="text-xs text-slate-400">Claimed</p>
              </div>
            </div>
          )}

          {/* Tiers Table */}
          {tiers.length === 0 ? (
            <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 max-w-lg">
              <p className="text-slate-400 text-sm">
                No tiers configured for this season. Insert them into the{' '}
                <code className="text-xs bg-slate-900 px-1 py-0.5 rounded">season_tiers</code> table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse max-w-4xl">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 text-slate-400">Tier</th>
                    <th className="text-right py-2 px-2 text-slate-400">XP</th>
                    <th className="text-left py-2 px-2 text-slate-400">Free Reward</th>
                    <th className="text-left py-2 px-2 text-slate-400">Premium Reward</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((t) => {
                    const reached = progress ? t.tierNumber <= progress.currentTier : false;
                    return (
                      <tr
                        key={t.tierNumber}
                        className={`border-b border-slate-800 ${reached ? '' : 'opacity-50'}`}
                      >
                        <td className="py-2 px-2">
                          <span className="font-medium text-slate-100">{t.tierNumber}</span>
                          {reached && <span className="ml-1 text-emerald-400 text-xs">&#10003;</span>}
                        </td>
                        <td className="py-2 px-2 text-right text-slate-300">
                          {t.xpRequired.toLocaleString()}
                        </td>
                        <td className="py-2 px-2">
                          {t.freeRewardType ? (
                            <span className={REWARD_COLORS[t.freeRewardType] ?? 'text-slate-300'}>
                              {t.freeRewardAmount.toLocaleString()} {t.freeRewardType}
                              {t.freeRewardItemId && ` (${t.freeRewardItemId})`}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {t.premiumRewardType ? (
                            <span className={REWARD_COLORS[t.premiumRewardType] ?? 'text-slate-300'}>
                              {t.premiumRewardAmount.toLocaleString()} {t.premiumRewardType}
                              {t.premiumRewardItemId && ` (${t.premiumRewardItemId})`}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
