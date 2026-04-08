'use client';

import { useEffect, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { getDeals, getBundles, getItems } from '@/lib/store-api';
import { itemCurrency } from '@/lib/store-types';
import type { StoreItem, StoreDeal, Bundle } from '@/lib/store-types';

interface ShopViewProps {
  onAddToCart: (item: StoreItem, quantity: number) => void;
  onPurchaseDeal: (deal: StoreDeal) => void;
  onPurchaseBundle: (bundle: Bundle) => void;
}

function PriceTag({ type, amount }: { type: 'coins' | 'gems'; amount: number }) {
  return (
    <span className={type === 'gems' ? 'text-indigo-400' : 'text-amber-400'}>
      {amount} {type}
    </span>
  );
}

export default function ShopView({ onAddToCart, onPurchaseDeal, onPurchaseBundle }: ShopViewProps) {
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
      {/* ─── Deals ─── */}
      {deals.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-3">Deals</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.slice(0, 6).map((d) => (
              <div
                key={d.dealId}
                className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col"
              >
                <p className="font-medium text-slate-200">{d.item?.name ?? d.itemId}</p>
                <p className="text-sm text-amber-400">{d.discountPercent}% off</p>
                <p className="text-sm text-slate-400">
                  {d.discountedCoins > 0 && <span className="text-amber-400">{d.discountedCoins} coins</span>}
                  {d.discountedCoins > 0 && d.discountedGems > 0 && ' / '}
                  {d.discountedGems > 0 && <span className="text-indigo-400">{d.discountedGems} gems</span>}
                </p>
                <button
                  onClick={() => onPurchaseDeal(d)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white text-sm font-medium flex items-center gap-1.5 self-start"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Buy deal
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Bundles ─── */}
      {bundles.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-100 mb-3">Bundles</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {bundles.slice(0, 6).map((b) => (
              <div
                key={b.bundleId}
                className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col"
              >
                <p className="font-medium text-slate-200">{b.name}</p>
                <p className="text-sm text-slate-400">{b.itemIds.length} items</p>
                <p className="text-sm">
                  {b.price.coins > 0 && <span className="text-amber-400">{b.price.coins} coins</span>}
                  {b.price.coins > 0 && b.price.gems > 0 && ' / '}
                  {b.price.gems > 0 && <span className="text-indigo-400">{b.price.gems} gems</span>}
                </p>
                <button
                  onClick={() => onPurchaseBundle(b)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-medium flex items-center gap-1.5 self-start"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Buy bundle
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Catalog items ─── */}
      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-3">Catalog</h2>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const cur = itemCurrency(item);
            return (
              <div
                key={item.itemId}
                className="p-4 rounded-xl bg-slate-800 border border-slate-700 flex flex-col"
              >
                <p className="font-medium text-slate-200 truncate">{item.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {item.category}{item.subcategory ? ` · ${item.subcategory}` : ''}
                </p>
                <p className="text-sm mt-1">
                  <PriceTag type={cur.type} amount={cur.amount} />
                </p>
                <button
                  onClick={() => onAddToCart(item, 1)}
                  className={`mt-2 px-3 py-1.5 rounded-lg text-white text-sm font-medium flex items-center gap-1.5 self-start ${
                    cur.type === 'gems'
                      ? 'bg-indigo-600/80 hover:bg-indigo-600'
                      : 'bg-amber-600/80 hover:bg-amber-600'
                  }`}
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Add to cart
                </button>
              </div>
            );
          })}
        </div>
        {items.length === 0 && <p className="text-slate-500">No items in catalog.</p>}
      </section>
    </div>
  );
}
