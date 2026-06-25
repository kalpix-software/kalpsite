'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Save, Upload } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

interface RewardTier {
  day: number;
  rewardType: string;
  rewardAmount: number;
  itemId: string;
  imageUrl: string;
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

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';
const fileCls =
  'w-full text-xs text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:bg-slate-700 file:text-slate-200';

const REWARD_TYPE_COLORS: Record<string, string> = {
  coins: 'text-amber-400',
  gems: 'text-purple-400',
  item: 'text-emerald-400',
};

/** Upload a daily-reward image to R2 via a backend presigned URL. Returns the public URL. */
async function uploadDailyRewardImage(file: File, day: number): Promise<string> {
  const contentType = file.type || 'image/webp';
  const raw = await callAdminRpc(
    'store/admin_get_upload_url',
    JSON.stringify({
      itemType: 'daily_reward',
      category: 'daily',
      subcategory: 'rewards',
      contentType,
      fileName: `day${day}`,
    })
  );
  const { uploadUrl, publicUrl } = unwrapAdminRpcData<{ uploadUrl: string; publicUrl: string }>(raw);
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) throw new Error('Upload to R2 failed');
  // The per-day R2 key is deterministic (overwrites), so cache-bust the stored
  // URL to force the new art to show on web and in the app.
  return `${publicUrl}?v=${Date.now()}`;
}

export default function AdminRewardsPage() {
  const [rows, setRows] = useState<RewardTier[]>([]);
  const [meta, setMeta] = useState<{ canClaimToday: boolean; nextRewardDay: number } | null>(null);
  const [streak, setStreak] = useState<LoginStreak | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [uploadingDay, setUploadingDay] = useState<number | null>(null);
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await callAdminRpc('store/get_daily_rewards');
      const data = (raw.data ?? raw) as unknown as DailyRewardsData;
      setRows(
        (data.rewards ?? []).map((r) => ({
          day: r.day,
          rewardType: r.rewardType,
          rewardAmount: r.rewardAmount,
          itemId: r.itemId ?? '',
          imageUrl: r.imageUrl ?? '',
          description: r.description ?? '',
        }))
      );
      setStreak(data.streak ?? null);
      setMeta({ canClaimToday: data.canClaimToday, nextRewardDay: data.nextRewardDay });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rewards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (day: number, field: keyof RewardTier, value: string | number) => {
    setRows((prev) => prev.map((r) => (r.day === day ? { ...r, [field]: value } : r)));
  };

  const handleUpload = async (day: number, file: File | undefined) => {
    if (!file) return;
    setUploadingDay(day);
    setError('');
    setMessage('');
    try {
      const url = await uploadDailyRewardImage(file, day);
      updateField(day, 'imageUrl', url);
      setMessage(`Day ${day} image uploaded — click Save to persist.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploadingDay(null);
    }
  };

  const saveDay = async (r: RewardTier) => {
    setSavingDay(r.day);
    setError('');
    setMessage('');
    try {
      await callAdminRpc(
        'store/admin_update_daily_reward',
        JSON.stringify({
          day: r.day,
          rewardType: r.rewardType,
          rewardAmount: Number(r.rewardAmount) || 0,
          itemId: r.rewardType === 'item' ? r.itemId : '',
          imageUrl: r.imageUrl || '',
          description: r.description || '',
        })
      );
      setMessage(`Day ${r.day} saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSavingDay(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Daily Login Rewards</h1>
          <p className="text-sm text-slate-400 mt-1">
            7-day cycling schedule. Resets at midnight UTC. Empty image falls back to the bundled
            coin/gem icon in the app.
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
      {message && <p className="mb-4 text-sm text-emerald-400">{message}</p>}

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

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-slate-500">
          No reward tiers found. Run the migration SQL to seed the default 7-day rewards.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl">
          {rows.map((r) => {
            const isNext = meta?.nextRewardDay === r.day;
            const typeColor = REWARD_TYPE_COLORS[r.rewardType] ?? 'text-slate-300';
            return (
              <div
                key={r.day}
                className={`relative p-4 rounded-xl bg-slate-800 border ${
                  isNext ? 'border-indigo-500 ring-1 ring-indigo-500/30' : 'border-slate-700'
                }`}
              >
                {isNext && (
                  <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-indigo-600 text-[10px] font-bold uppercase tracking-wider text-white">
                    Next
                  </span>
                )}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase">Day {r.day}</span>
                  <span className={`text-xs font-semibold ${typeColor}`}>
                    {r.rewardAmount.toLocaleString()} {r.rewardType}
                  </span>
                </div>

                {/* Image preview + upload */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0">
                    {r.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.imageUrl} alt={`Day ${r.day}`} className="w-full h-full object-contain" />
                    ) : (
                      <span className="text-[9px] text-slate-500 text-center px-1">bundled icon</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={(el) => {
                        fileInputs.current[r.day] = el;
                      }}
                      type="file"
                      accept="image/webp,image/png,image/jpeg,image/gif"
                      className={fileCls}
                      disabled={uploadingDay === r.day}
                      onChange={(e) => handleUpload(r.day, e.target.files?.[0])}
                    />
                    {uploadingDay === r.day && (
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                        <Upload size={11} /> uploading…
                      </p>
                    )}
                  </div>
                </div>

                <label className="block text-[11px] text-slate-500 mb-1">Image URL</label>
                <input
                  className={`${inputCls} mb-3`}
                  value={r.imageUrl}
                  placeholder="(empty = bundled icon)"
                  onChange={(e) => updateField(r.day, 'imageUrl', e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Type</label>
                    <select
                      className={inputCls}
                      value={r.rewardType}
                      onChange={(e) => updateField(r.day, 'rewardType', e.target.value)}
                    >
                      <option value="coins">coins</option>
                      <option value="gems">gems</option>
                      <option value="item">item</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Amount</label>
                    <input
                      type="number"
                      min={0}
                      className={inputCls}
                      value={r.rewardAmount}
                      onChange={(e) => updateField(r.day, 'rewardAmount', Number(e.target.value))}
                    />
                  </div>
                </div>

                {r.rewardType === 'item' && (
                  <div className="mb-3">
                    <label className="block text-[11px] text-slate-500 mb-1">Item ID (UUID)</label>
                    <input
                      className={inputCls}
                      value={r.itemId}
                      placeholder="store_items.item_id"
                      onChange={(e) => updateField(r.day, 'itemId', e.target.value)}
                    />
                  </div>
                )}

                <label className="block text-[11px] text-slate-500 mb-1">Description</label>
                <input
                  className={`${inputCls} mb-3`}
                  value={r.description}
                  onChange={(e) => updateField(r.day, 'description', e.target.value)}
                />

                <button
                  onClick={() => saveDay(r)}
                  disabled={savingDay === r.day}
                  className="w-full px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Save size={14} />
                  {savingDay === r.day ? 'Saving…' : `Save Day ${r.day}`}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {meta?.canClaimToday && (
        <div className="mt-8 p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/30 max-w-md">
          <p className="text-sm text-emerald-300 mb-2">Claim today&apos;s reward (admin test):</p>
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
            Claim Day {meta.nextRewardDay} Reward
          </button>
        </div>
      )}
    </div>
  );
}
