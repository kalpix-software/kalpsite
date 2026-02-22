'use client';

import { useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

const callRpc = callAdminRpc;

interface ItemStat {
  itemId: string;
  itemName: string;
  category: string;
  totalPurchases: number;
  totalCoins: number;
  totalGems: number;
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<ItemStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totals, setTotals] = useState({ totalCoins: 0, totalGems: 0, totalItems: 0 });
  const [categoryFilter, setCategoryFilter] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await callRpc('store/admin_get_item_stats', JSON.stringify({
        category: categoryFilter || undefined,
        limit: 100,
      }));
      const d = data?.data ?? data;
      setStats(d?.items ?? []);
      setTotals({
        totalCoins: d?.totalCoins ?? 0,
        totalGems: d?.totalGems ?? 0,
        totalItems: d?.totalItems ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [categoryFilter]);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-6">Purchase Stats</h1>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-xl">
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-2xl font-bold text-amber-400">{totals.totalCoins.toLocaleString()}</p>
          <p className="text-xs text-slate-400">Total Coins Spent</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-2xl font-bold text-purple-400">{totals.totalGems.toLocaleString()}</p>
          <p className="text-xs text-slate-400">Total Gems Spent</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-2xl font-bold text-slate-100">{totals.totalItems}</p>
          <p className="text-xs text-slate-400">Items with Sales</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm">
          <option value="">All Categories</option>
          <option value="avatar_upgrade">Avatar Upgrades</option>
          <option value="game_upgrade">Game Upgrades</option>
          <option value="chat_upgrade">Chat Upgrades</option>
          <option value="cosmetic">Cosmetic</option>
        </select>
        <button onClick={load} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600">Refresh</button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : stats.length === 0 ? (
        <p className="text-slate-500">No purchase data yet. Stats will appear after users start buying items.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 text-slate-400">#</th>
              <th className="text-left py-2 text-slate-400">Item</th>
              <th className="text-left py-2 text-slate-400">Category</th>
              <th className="text-right py-2 text-slate-400">Purchases</th>
              <th className="text-right py-2 text-slate-400">Coins</th>
              <th className="text-right py-2 text-slate-400">Gems</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s, i) => (
              <tr key={s.itemId} className="border-b border-slate-800">
                <td className="py-2 text-slate-500">{i + 1}</td>
                <td className="py-2">
                  <span className="text-slate-100">{s.itemName}</span>
                  <br />
                  <span className="text-xs text-slate-500">{s.itemId}</span>
                </td>
                <td className="py-2 text-slate-300">{s.category}</td>
                <td className="py-2 text-right text-slate-100 font-medium">{s.totalPurchases}</td>
                <td className="py-2 text-right text-amber-400">{s.totalCoins.toLocaleString()}</td>
                <td className="py-2 text-right text-purple-400">{s.totalGems.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
