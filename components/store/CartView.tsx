'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { purchaseItems } from '@/lib/store-api';
import { itemCurrency } from '@/lib/store-types';
import type { StoreItem } from '@/lib/store-types';

interface CartLine {
  item: StoreItem;
  quantity: number;
}

interface CartViewProps {
  cart: CartLine[];
  onClose: () => void;
  onRemove: (itemId: string) => void;
  onCheckoutSuccess: () => void;
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function CartView({ cart, onClose, onRemove, onCheckoutSuccess }: CartViewProps) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  const totalCoins = cart.reduce((s, c) => {
    const cur = itemCurrency(c.item);
    return cur.type === 'coins' ? s + cur.amount * c.quantity : s;
  }, 0);
  const totalGems = cart.reduce((s, c) => {
    const cur = itemCurrency(c.item);
    return cur.type === 'gems' ? s + cur.amount * c.quantity : s;
  }, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    setError('');
    try {
      const items = cart.map((line) => ({
        itemId: line.item.itemId,
        quantity: line.quantity,
      }));
      await purchaseItems(items, uuid());
      onCheckoutSuccess();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-100">Cart</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <p className="text-slate-500">Cart is empty.</p>
          ) : (
            cart.map((line) => {
              const cur = itemCurrency(line.item);
              return (
                <div
                  key={line.item.itemId}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-700/50"
                >
                  <div>
                    <p className="font-medium text-slate-200">{line.item.name}</p>
                    <p className="text-xs text-slate-400">
                      {cur.amount * line.quantity} {cur.type} {line.quantity > 1 && `(×${line.quantity})`}
                    </p>
                  </div>
                  <button
                    onClick={() => onRemove(line.item.itemId)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Remove
                  </button>
                </div>
              );
            })
          )}
        </div>
        {cart.length > 0 && (
          <>
            <div className="p-4 border-t border-slate-700 flex gap-4 text-slate-200">
              {totalCoins > 0 && <span className="text-amber-400">Coins: {totalCoins}</span>}
              {totalGems > 0 && <span className="text-indigo-400">Gems: {totalGems}</span>}
            </div>
            {error && <p className="px-4 pb-2 text-red-400 text-sm">{error}</p>}
            <div className="p-4 pt-0">
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium"
              >
                {checkingOut ? 'Checking out…' : 'Checkout'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
