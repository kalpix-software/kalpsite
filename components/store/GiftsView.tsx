'use client';

import { useEffect, useState } from 'react';
import { getReceivedGifts, acceptGift, declineGift } from '@/lib/store-api';
import type { Gift } from '@/lib/store-types';

export default function GiftsView() {
  const [list, setList] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getReceivedGifts('pending');
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

  const accept = async (giftId: string) => {
    try {
      await acceptGift(giftId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accept failed');
    }
  };

  const decline = async (giftId: string) => {
    try {
      await declineGift(giftId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decline failed');
    }
  };

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error && list.length === 0) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Gifts inbox</h2>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="space-y-2">
        {list.map((g) => (
          <div
            key={g.giftId}
            className="flex items-center justify-between p-4 rounded-xl bg-slate-800 border border-slate-700"
          >
            <div>
              <p className="font-medium text-slate-200">{g.item?.name ?? g.itemId}</p>
              {g.message && <p className="text-sm text-slate-400">{g.message}</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => decline(g.giftId)}
                className="px-3 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-500 text-white text-sm"
              >
                Decline
              </button>
              <button
                onClick={() => accept(g.giftId)}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
              >
                Accept
              </button>
            </div>
          </div>
        ))}
      </div>
      {list.length === 0 && <p className="text-slate-500">No pending gifts.</p>}
    </div>
  );
}
