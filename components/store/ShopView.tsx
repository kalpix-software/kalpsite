'use client';

import { useEffect, useState } from 'react';
import { getDeals, getBundles, getItems } from '@/lib/store-api';
import type { StoreItem, StoreDeal, Bundle } from '@/lib/store-types';

interface ShopViewProps {
  onAddToCart: (item: StoreItem, quantity: number, currencyType: string) => void;
}

export default function ShopView({ onAddToCart }: ShopViewProps) {
  const [deals, setDeals] = useState<StoreDeal[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getDeals(), getBundles(), getItems({ limit: 30 })])
      .then(([d, b, r]) => {
        if (!cancelled) {
          setDeals(d);
          setBundles(b);
          setItems(r.items);
        }
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-slate-400">Loading shop…</p>;
  if (error) return <p className="text-red-400">{error}</p>;

  return (
    <div className="space-y-8">
      {deals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-3">Deals</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.slice(0, 6).map((d) => (
              <div
                key={d.dealId}
                className="p-4 rounded-xl bg-slate-800 border border-slate-700"
              >
                <p className="font-medium text-slate-200">{d.item?.name ?? d.itemId}</p>
                <p className="text-sm text-amber-400">{d.discountPercent}% off</p>
                <p className="text-sm text-slate-400">
                  {d.discountedCoins > 0 && `${d.discountedCoins} coins`}
                  {d.discountedCoins > 0 && d.discountedGems > 0 && ' / '}
                  {d.discountedGems > 0 && `${d.discountedGems} gems`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {bundles.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-3">Bundles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.slice(0, 6).map((b) => (
              <div
                key={b.bundleId}
                className="p-4 rounded-xl bg-slate-800 border border-slate-700"
              >
                <p className="font-medium text-slate-200">{b.name}</p>
                <p className="text-sm text-slate-400">{b.itemIds.length} items</p>
                <p className="text-sm text-emerald-400">
                  {b.price.coins > 0 && `${b.price.coins} coins`}
                  {b.price.coins > 0 && b.price.gems > 0 && ' / '}
                  {b.price.gems > 0 && `${b.price.gems} gems`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Catalog</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.itemId}
              className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col"
            >
              <p className="font-medium text-slate-200 truncate">{item.name}</p>
              <p className="text-xs text-slate-500 mt-1">
                {item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}
              </p>
              <div className="mt-2 flex gap-2 flex-wrap">
                {item.price.coins > 0 && (
                  <button
                    onClick={() => onAddToCart(item, 1, 'coins')}
                    className="px-2 py-1 rounded bg-amber-600/80 hover:bg-amber-600 text-white text-xs"
                  >
                    {item.price.coins} coins
                  </button>
                )}
                {item.price.gems > 0 && (
                  <button
                    onClick={() => onAddToCart(item, 1, 'gems')}
                    className="px-2 py-1 rounded bg-indigo-600/80 hover:bg-indigo-600 text-white text-xs"
                  >
                    {item.price.gems} gems
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        {items.length === 0 && <p className="text-slate-500">No items in catalog.</p>}
      </section>
    </div>
  );
}
