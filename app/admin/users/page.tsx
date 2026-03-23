'use client';

import { useState } from 'react';
import { Search, Coins, Gem } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface Wallet {
  coins: number;
  gems: number;
}

export default function AdminUsersPage() {
  const [userId, setUserId] = useState('');
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Add currency form
  const [currencyType, setCurrencyType] = useState<'coins' | 'gems'>('coins');
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState('admin_grant');
  const [adding, setAdding] = useState(false);

  const lookupUser = async () => {
    const id = userId.trim();
    if (!id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setWallet(null);
    try {
      const data = await callAdminRpc('store/admin_get_wallet', JSON.stringify({ userId: id }));
      const raw = (data?.data ?? data) as { wallet?: Wallet };
      if (raw?.wallet) {
        setWallet(raw.wallet);
      } else {
        setError('User not found or wallet does not exist');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const addCurrency = async () => {
    const id = userId.trim();
    if (!id || amount === 0) return;
    setAdding(true);
    setError('');
    setSuccess('');
    try {
      const data = await callAdminRpc(
        'store/add_currency',
        JSON.stringify({
          userId: id,
          currencyType,
          amount,
          reason,
        })
      );
      const raw = (data?.data ?? data) as { wallet?: Wallet };
      if (raw?.wallet) {
        setWallet(raw.wallet);
      }
      const sign = amount > 0 ? '+' : '';
      setSuccess(`${sign}${amount} ${currencyType} applied successfully`);
      setAmount(0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add currency');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-100 mb-1">User Management</h1>
      <p className="text-sm text-slate-400 mb-6">Look up a user by ID and manage their wallet balance.</p>

      {/* Lookup */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookupUser()}
          placeholder="Enter User ID (UUID)"
          className="flex-1 max-w-md px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm placeholder:text-slate-500"
        />
        <button
          onClick={lookupUser}
          disabled={loading || !userId.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          {loading ? 'Looking up...' : 'Look up'}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {success && <p className="mb-4 text-sm text-emerald-400">{success}</p>}

      {wallet && (
        <div className="space-y-6">
          {/* Wallet display */}
          <div className="p-5 rounded-xl bg-slate-800 border border-slate-700 max-w-lg">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Current Balance</h2>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <span className="text-2xl font-bold text-amber-400">{wallet.coins.toLocaleString()}</span>
                <span className="text-sm text-slate-400">coins</span>
              </div>
              <div className="flex items-center gap-2">
                <Gem className="w-5 h-5 text-purple-400" />
                <span className="text-2xl font-bold text-purple-400">{wallet.gems.toLocaleString()}</span>
                <span className="text-sm text-slate-400">gems</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-2">User: {userId.trim()}</p>
          </div>

          {/* Add currency form */}
          <div className="p-5 rounded-xl bg-slate-800 border border-slate-700 max-w-lg">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Add / Deduct Currency</h2>
            <p className="text-xs text-slate-400 mb-3">Use a positive number to add, negative to deduct.</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                <select
                  value={currencyType}
                  onChange={(e) => setCurrencyType(e.target.value as 'coins' | 'gems')}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
                >
                  <option value="coins">Coins</option>
                  <option value="gems">Gems</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Amount</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs text-slate-400 mb-1">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              >
                <option value="admin_grant">Admin grant</option>
                <option value="compensation">Compensation</option>
                <option value="bug_fix">Bug fix</option>
                <option value="reward">Reward</option>
                <option value="refund">Refund</option>
                <option value="promo">Promotion</option>
              </select>
            </div>
            <button
              onClick={addCurrency}
              disabled={adding || amount === 0}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
            >
              {adding ? 'Applying...' : amount >= 0 ? `Add ${amount} ${currencyType}` : `Deduct ${Math.abs(amount)} ${currencyType}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
