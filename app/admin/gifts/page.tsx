'use client';

import { useCallback, useEffect, useState } from 'react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface StoreItem {
  itemId: string;
  name: string;
}

interface GiftRecord {
  giftId: string;
  senderId: string;
  recipientId: string;
  itemId: string;
  item?: StoreItem;
  message: string;
  status: string;
  coinsSpent: number;
  gemsSpent: number;
  createdAt: number;
  updatedAt: number;
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-400/10 text-amber-400',
  accepted: 'bg-emerald-400/10 text-emerald-400',
  declined: 'bg-red-400/10 text-red-400',
  expired: 'bg-slate-600/10 text-slate-500',
};

function formatDate(unix: number): string {
  if (!unix) return '—';
  return new Date(unix * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shortenId(id: string): string {
  if (id.length <= 12) return id;
  return id.slice(0, 8) + '...';
}

export default function AdminGiftsPage() {
  const [sentGifts, setSentGifts] = useState<GiftRecord[]>([]);
  const [receivedGifts, setReceivedGifts] = useState<GiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'received' | 'sent'>('received');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [recvRes, sentRes] = await Promise.all([
        callAdminRpc('store/get_received_gifts', JSON.stringify({})) as Promise<{
          data?: { gifts?: GiftRecord[] };
          gifts?: GiftRecord[];
        }>,
        callAdminRpc('store/get_sent_gifts', JSON.stringify({})) as Promise<{
          data?: { gifts?: GiftRecord[] };
          gifts?: GiftRecord[];
        }>,
      ]);
      setReceivedGifts((recvRes?.data ?? recvRes)?.gifts ?? []);
      setSentGifts((sentRes?.data ?? sentRes)?.gifts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const gifts = tab === 'received' ? receivedGifts : sentGifts;
  const totalGifts = receivedGifts.length + sentGifts.length;
  const pendingCount = [...receivedGifts, ...sentGifts].filter((g) => g.status === 'pending').length;
  const totalCoins = [...receivedGifts, ...sentGifts].reduce((s, g) => s + g.coinsSpent, 0);
  const totalGems = [...receivedGifts, ...sentGifts].reduce((s, g) => s + g.gemsSpent, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Gifts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor gift activity. Users can send store items to friends.
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

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6 max-w-2xl">
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-slate-100">{totalGifts}</p>
          <p className="text-xs text-slate-400">Total Gifts</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-amber-400">{pendingCount}</p>
          <p className="text-xs text-slate-400">Pending</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-amber-400">{totalCoins.toLocaleString()}</p>
          <p className="text-xs text-slate-400">Coins Spent</p>
        </div>
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 text-center">
          <p className="text-xl font-bold text-purple-400">{totalGems.toLocaleString()}</p>
          <p className="text-xs text-slate-400">Gems Spent</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4">
        {(['received', 'sent'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {t === 'received' ? `Received (${receivedGifts.length})` : `Sent (${sentGifts.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : gifts.length === 0 ? (
        <p className="text-slate-500">
          No {tab} gifts yet. Gift activity will appear here as users send items to each other.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 text-slate-400">Item</th>
                <th className="text-left py-2 text-slate-400">{tab === 'received' ? 'From' : 'To'}</th>
                <th className="text-left py-2 text-slate-400">Message</th>
                <th className="text-center py-2 text-slate-400">Status</th>
                <th className="text-right py-2 text-slate-400">Cost</th>
                <th className="text-right py-2 text-slate-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {gifts.map((g) => (
                <tr key={g.giftId} className="border-b border-slate-800">
                  <td className="py-2">
                    <span className="text-slate-100">{g.item?.name ?? g.itemId}</span>
                  </td>
                  <td className="py-2">
                    <span className="text-xs text-slate-400 font-mono">
                      {shortenId(tab === 'received' ? g.senderId : g.recipientId)}
                    </span>
                  </td>
                  <td className="py-2 max-w-[200px] truncate text-slate-400">
                    {g.message || '—'}
                  </td>
                  <td className="py-2 text-center">
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                        STATUS_STYLES[g.status] ?? STATUS_STYLES.pending
                      }`}
                    >
                      {g.status}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    {g.coinsSpent > 0 && (
                      <span className="text-amber-400">{g.coinsSpent.toLocaleString()} c</span>
                    )}
                    {g.gemsSpent > 0 && (
                      <span className="text-purple-400 ml-1">{g.gemsSpent.toLocaleString()} g</span>
                    )}
                  </td>
                  <td className="py-2 text-right text-slate-500 text-xs">{formatDate(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
