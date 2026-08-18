'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, ShoppingCart, Store, Calendar, Swords, Trophy, Gift, Package } from 'lucide-react';
import WalletBar from '@/components/store/WalletBar';
import ShopView from '@/components/store/ShopView';
import DailyRewardsView from '@/components/store/DailyRewardsView';
import BattlePassView from '@/components/store/BattlePassView';
import AchievementsView from '@/components/store/AchievementsView';
import GiftsView from '@/components/store/GiftsView';
import InventoryView from '@/components/store/InventoryView';
import CartView from '@/components/store/CartView';
import { purchaseDeal, purchaseBundle } from '@/lib/store-api';
import type { StoreItem, StoreDeal, Bundle } from '@/lib/store-types';

const TABS = [
  { id: 'shop', label: 'Shop', icon: Store },
  { id: 'rewards', label: 'Daily rewards', icon: Calendar },
  { id: 'battlepass', label: 'Battle pass', icon: Swords },
  { id: 'achievements', label: 'Achievements', icon: Trophy },
  { id: 'gifts', label: 'Gifts', icon: Gift },
  { id: 'inventory', label: 'Inventory', icon: Package },
] as const;

export type PlayTabId = (typeof TABS)[number]['id'];

function uuid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PlayPage() {
  const [tab, setTab] = useState<PlayTabId>('shop');
  const [walletKey, setWalletKey] = useState(0);
  const [cart, setCart] = useState<{ item: StoreItem; quantity: number }[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const refreshWallet = useCallback(() => setWalletKey((k) => k + 1), []);

  const addToCart = useCallback((item: StoreItem, quantity: number) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.item.itemId === item.itemId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + quantity };
        return next;
      }
      return [...prev, { item, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart((prev) => prev.filter((x) => x.item.itemId !== itemId));
  }, []);
  const clearCart = useCallback(() => setCart([]), []);

  const handlePurchaseDeal = useCallback(async (deal: StoreDeal) => {
    setActionMsg('');
    try {
      await purchaseDeal({ dealId: deal.dealId, requestId: uuid() });
      refreshWallet();
      setActionMsg(`Purchased deal: ${deal.item?.name ?? deal.dealId}`);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Deal purchase failed');
    }
  }, [refreshWallet]);

  const handlePurchaseBundle = useCallback(async (bundle: Bundle) => {
    setActionMsg('');
    try {
      await purchaseBundle({ bundleId: bundle.bundleId, requestId: uuid() });
      refreshWallet();
      setActionMsg(`Purchased bundle: ${bundle.name}`);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : 'Bundle purchase failed');
    }
  }, [refreshWallet]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-xl font-bold text-slate-100">Player view</h1>
        </div>
        <div className="flex items-center gap-4">
          <WalletBar key={walletKey} />
          <button
            onClick={() => setShowCart(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
          >
            <ShoppingCart className="w-4 h-4" />
            Cart {cart.length > 0 && `(${cart.length})`}
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300">
          {actionMsg}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-b border-slate-700 pb-2">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-[400px]">
        {tab === 'shop' && (
          <ShopView
            onAddToCart={addToCart}
            onPurchaseDeal={handlePurchaseDeal}
            onPurchaseBundle={handlePurchaseBundle}
          />
        )}
        {tab === 'rewards' && <DailyRewardsView onClaimed={refreshWallet} />}
        {tab === 'battlepass' && <BattlePassView onAction={refreshWallet} />}
        {tab === 'achievements' && <AchievementsView onClaimed={refreshWallet} />}
        {tab === 'gifts' && <GiftsView />}
        {tab === 'inventory' && <InventoryView />}
      </div>

      {showCart && (
        <CartView
          cart={cart}
          onClose={() => setShowCart(false)}
          onRemove={removeFromCart}
          onCheckoutSuccess={() => { clearCart(); setShowCart(false); refreshWallet(); }}
        />
      )}
    </div>
  );
}
