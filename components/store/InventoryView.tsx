'use client';

import { useEffect, useState } from 'react';
import { getInventory, equipItem } from '@/lib/store-api';
import type { UserInventoryItem } from '@/lib/store-types';

export default function InventoryView() {
  const [items, setItems] = useState<UserInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getInventory({ limit: 50 });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const equip = async (itemId: string) => {
    try {
      await equipItem(itemId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Equip failed');
    }
  };

  if (loading) return <p className="text-slate-400">Loading…</p>;
  if (error && items.length === 0) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Inventory</h2>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {items.map((inv) => (
          <div
            key={inv.inventoryId}
            className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center"
          >
            <p className="font-medium text-slate-200 text-center truncate w-full">
              {inv.item?.name ?? inv.itemId}
            </p>
            {!inv.isEquipped ? (
              <button
                onClick={() => equip(inv.itemId)}
                className="mt-2 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm"
              >
                Equip
              </button>
            ) : (
              <span className="mt-2 text-xs text-emerald-400">Equipped</span>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-slate-500">No items in inventory.</p>}
    </div>
  );
}
