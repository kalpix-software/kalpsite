'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface StoreItem {
  itemId: string;
  name: string;
  price: { coins: number; gems: number };
}

interface StoreDeal {
  dealId: string;
  itemId: string;
  item?: StoreItem;
  dealType: string;
  discountPercent: number;
  discountedCoins: number;
  discountedGems: number;
  startTime: number;
  endTime: number;
  maxPurchases: number;
  isActive: boolean;
}

const DEAL_TYPE_STYLES: Record<string, string> = {
  daily: 'bg-amber-400/10 text-amber-400',
  weekly: 'bg-indigo-400/10 text-indigo-400',
  flash: 'bg-red-400/10 text-red-400',
};

function timeLeft(endTime: number): string {
  const diff = endTime - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'Expired';
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

export default function AdminDealsPage() {
  const [deals, setDeals] = useState<StoreDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  // Create deal form
  const [formItemId, setFormItemId] = useState('');
  const [formType, setFormType] = useState('daily');
  const [formDiscount, setFormDiscount] = useState(25);
  const [formDuration, setFormDuration] = useState(24);
  const [formMax, setFormMax] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = (await callAdminRpc('store/get_deals')) as {
        data?: { deals?: StoreDeal[] };
        deals?: StoreDeal[];
      };
      const d = res?.data ?? res;
      setDeals(d?.deals ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!formItemId) {
      setError('Item ID is required');
      return;
    }
    setCreating(true);
    setError('');
    try {
      await callAdminRpc(
        'store/admin_create_deal',
        JSON.stringify({
          itemId: formItemId,
          dealType: formType,
          discountPercent: formDiscount,
          durationHours: formDuration,
          maxPurchases: formMax,
        })
      );
      setFormItemId('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Deals</h1>
          <p className="text-sm text-slate-400 mt-1">
            Create time-limited discounted offers for any store item.
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

      {/* Create Deal Form */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Create New Deal</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Item ID</label>
            <input
              value={formItemId}
              onChange={(e) => setFormItemId(e.target.value)}
              placeholder="e.g. uno_card_back_gold"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Deal Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="flash">Flash Sale</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Discount %</label>
            <input
              type="number"
              value={formDiscount}
              onChange={(e) => setFormDiscount(Number(e.target.value))}
              min={1}
              max={95}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Duration (hours)</label>
            <input
              type="number"
              value={formDuration}
              onChange={(e) => setFormDuration(Number(e.target.value))}
              min={1}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Max Purchases / User</label>
            <input
              type="number"
              value={formMax}
              onChange={(e) => setFormMax(Number(e.target.value))}
              min={1}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-sm text-slate-100"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </div>
      </div>

      {/* Active Deals */}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : deals.length === 0 ? (
        <p className="text-slate-500">No active deals. Create one above.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <div
              key={d.dealId}
              className="p-4 rounded-xl bg-slate-800 border border-slate-700"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    DEAL_TYPE_STYLES[d.dealType] ?? 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {d.dealType}
                </span>
                <span className="text-[10px] text-slate-500 ml-auto">{timeLeft(d.endTime)} left</span>
              </div>
              <p className="text-sm font-medium text-slate-100">{d.item?.name ?? d.itemId}</p>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-lg font-bold text-emerald-400">-{d.discountPercent}%</span>
                {d.discountedCoins > 0 && (
                  <span className="text-sm text-amber-400">{d.discountedCoins.toLocaleString()} coins</span>
                )}
                {d.discountedGems > 0 && (
                  <span className="text-sm text-purple-400">{d.discountedGems.toLocaleString()} gems</span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">Max {d.maxPurchases} per user</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
