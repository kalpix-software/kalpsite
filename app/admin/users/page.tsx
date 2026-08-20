'use client';

import { useState } from 'react';
import { Search, Coins, Gem, Users as UsersIcon, Copy, Check } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface Wallet {
  coins: number;
  gems: number;
}

interface FoundUser {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
}

/** How many results per page. The backend caps `limit` at 50. */
const PAGE_SIZE = 25;

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

  // ── Username search ──
  // Reuses users/search, the same RPC the app's people-search uses. Its
  // global scope is a plain LIKE over username with no visibility filtering, so
  // an admin sees every account including private ones — which is what an admin
  // tool needs and what a player-facing search must never do. Nothing new was
  // added to the backend for this.
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoundUser[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  const runSearch = async (append = false) => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setError('');
    setSuccess('');
    try {
      const payload: Record<string, unknown> = { query: q, limit: PAGE_SIZE, scope: 'global' };
      if (append && cursor) payload.cursor = cursor;
      const data = await callAdminRpc('users/search', JSON.stringify(payload));
      const raw = (data?.data ?? data) as { users?: FoundUser[]; nextCursor?: string };
      const found = raw?.users ?? [];
      setResults((prev) => (append && prev ? [...prev, ...found] : found));
      // Absent nextCursor means the last page — not an error, just no more.
      setCursor(raw?.nextCursor ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  /** Pick a search result: load their wallet without making you copy the UUID by hand. */
  const selectUser = async (u: FoundUser) => {
    setUserId(u.userId);
    setWallet(null);
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const data = await callAdminRpc('store/admin_get_wallet', JSON.stringify({ userId: u.userId }));
      const raw = (data?.data ?? data) as { wallet?: Wallet };
      if (raw?.wallet) setWallet(raw.wallet);
      else setError(`No wallet found for ${u.username}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  };

  const copyId = async (id: string) => {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      // Clipboard needs a secure context; the id is visible either way.
    }
  };

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
      <p className="text-sm text-slate-400 mb-6">Find a player by username, then manage their wallet.</p>

      {/* ─── Search by username ─── */}
      <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-1 flex items-center gap-2">
          <UsersIcon className="w-4 h-4" />
          Find a player
        </h2>
        <p className="text-xs text-slate-400 mb-3">
          Matches the <strong className="text-slate-300">start</strong> of a username or display name,
          case-insensitively. <code className="bg-slate-900 px-1 rounded">ram</code> finds
          <span className="text-slate-300"> ram</span>, <span className="text-slate-300">rambo</span>,
          <span className="text-slate-300"> ramesh_k</span> — but not <span className="text-slate-300">sriram</span>,
          because the search is anchored to the beginning so it can use the index.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void runSearch(false)}
            placeholder="Username"
            className="flex-1 max-w-md px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm placeholder:text-slate-500"
          />
          <button
            onClick={() => void runSearch(false)}
            disabled={searching || !query.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>

        {results !== null && results.length === 0 && !searching && (
          <p className="mt-3 text-sm text-slate-400">
            No player with a username containing “{query.trim()}”.
          </p>
        )}

        {results !== null && results.length > 0 && (
          <div className="mt-3">
            <div className="overflow-x-auto rounded-lg border border-slate-600 max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-700 text-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-1.5">Username</th>
                    <th className="text-left px-3 py-1.5">Display name</th>
                    <th className="text-left px-3 py-1.5">User ID</th>
                    <th className="w-28" />
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {results.map((u) => (
                    <tr
                      key={u.userId}
                      className={`border-t border-slate-600 ${u.userId === userId.trim() ? 'bg-slate-700/50' : ''}`}
                    >
                      <td className="px-3 py-1.5 text-slate-100">{u.username}</td>
                      <td className="px-3 py-1.5">{u.displayName || <span className="text-slate-500">—</span>}</td>
                      <td className="px-3 py-1.5">
                        <button
                          onClick={() => void copyId(u.userId)}
                          title="Copy user ID"
                          className="font-mono text-xs text-slate-400 hover:text-slate-100 flex items-center gap-1"
                        >
                          {u.userId.slice(0, 8)}…
                          {copiedId === u.userId
                            ? <Check className="w-3 h-3 text-emerald-400" />
                            : <Copy className="w-3 h-3" />}
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <button
                          onClick={() => void selectUser(u)}
                          className="px-3 py-1 rounded-lg bg-slate-700 text-slate-100 text-xs font-medium hover:bg-slate-600"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {results.length} shown{cursor ? '' : ' · end of results'}
              </span>
              {cursor && (
                <button
                  onClick={() => void runSearch(true)}
                  disabled={searching}
                  className="px-3 py-1 rounded-lg bg-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-600 disabled:opacity-50"
                >
                  {searching ? 'Loading…' : `Load ${PAGE_SIZE} more`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Direct lookup by ID (kept: the only way in when you have an ID from a
             report, a log line or a support ticket rather than a username) ─── */}
      <details className="mb-6">
        <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-200">
          Or look up by user ID
        </summary>
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookupUser()}
            placeholder="UUID"
            className="flex-1 max-w-md px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm font-mono placeholder:text-slate-500"
          />
          <button
            onClick={lookupUser}
            disabled={loading || !userId.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm font-medium hover:bg-slate-600 disabled:opacity-50"
          >
            {loading ? 'Looking up…' : 'Look up'}
          </button>
        </div>
      </details>

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
            {/* Name it, not just the UUID. Granting currency to the wrong account
                is not reversible from this page, and one hex string looks much
                like another. */}
            {(() => {
              const sel = results?.find((u) => u.userId === userId.trim());
              return (
                <p className="text-xs text-slate-500 mt-2">
                  {sel && (
                    <span className="text-slate-300 font-medium">
                      {sel.username}
                      {sel.displayName ? ` · ${sel.displayName}` : ''}
                      {' — '}
                    </span>
                  )}
                  <span className="font-mono">{userId.trim()}</span>
                </p>
              );
            })()}
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
