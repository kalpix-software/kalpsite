'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { callAdminRpc } from '@/lib/admin-rpc';

interface StoreItem {
  itemId: string;
  name: string;
  description?: string;
  upgradeType?: string;
  category: string;
  subcategory?: string;
  type?: string;
  avatarId?: string;
  gameId?: string;
  price: { coins: number; gems: number };
  isActive: boolean;
  sortOrder?: number;
  metadata?: Record<string, string>;
  previewUrl?: string;
  purchaseLimit?: number;
  discountedPriceCoins?: number;
  discountedPriceGems?: number;
}

const callRpc = callAdminRpc;

const UPGRADE_TYPES = [
  { value: '', label: 'All types' },
  { value: 'avatar_upgrade', label: 'Avatar upgrade' },
  { value: 'game_upgrade', label: 'Game upgrade' },
  { value: 'chat_upgrade', label: 'Chat upgrade' },
];

const PAGE_SIZES = [20, 50, 100, 200, 500] as const;

const KNOWN_GAMES: { value: string; label: string }[] = [
  { value: 'uno', label: 'Uno' },
  { value: 'chess', label: 'Chess' },
  { value: 'ludo', label: 'Ludo' },
];

const SUBCATEGORIES_BY_GAME: Record<string, string[]> = {
  uno: ['card_decks', 'card_back', 'background', 'background_themes', 'effects'],
  chess: ['board_themes', 'piece_sets'],
  ludo: ['board_themes', 'dice_themes', 'token_themes'],
};

const CHAT_CATEGORIES = [
  { value: 'chat_bubbles', label: 'Chat bubbles' },
  { value: 'emoji_pack', label: 'Emoji pack' },
  { value: 'theme_pack', label: 'Theme pack' },
];

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function AddItemForm({
  onAdded,
  existingGames,
  existingAvatars,
}: {
  onAdded: () => void;
  existingGames: string[];
  existingAvatars: string[];
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    upgradeType: 'game_upgrade' as string,
    category: 'uno',
    categoryCustom: '',
    subcategory: 'card_decks',
    subcategoryCustom: '',
    name: '',
    description: '',
    previewUrl: '',
    coins: 0,
    gems: 0,
    purchaseLimit: 1,
    discountedPriceCoins: 0,
    discountedPriceGems: 0,
    isActive: true,
  });

  const allGames = [...new Set([...existingGames, ...KNOWN_GAMES.map((g) => g.value)])].filter(Boolean).sort();
  const subsForGame =
    form.upgradeType === 'game_upgrade' && form.category && form.category !== '__other__'
      ? (SUBCATEGORIES_BY_GAME[form.category] || [])
      : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const category =
        form.upgradeType === 'game_upgrade' && (form.category === '__other__' || form.category === '')
          ? form.categoryCustom.trim()
          : form.upgradeType === 'game_upgrade'
            ? form.category
            : form.category;
      const subcategory = form.subcategory === '__other__' ? form.subcategoryCustom.trim() : (form.subcategoryCustom.trim() || form.subcategory);
      const itemId = generateId();
      const item: Record<string, unknown> = {
        itemId,
        name: form.name,
        description: form.description,
        previewUrl: form.previewUrl || undefined,
        upgradeType: form.upgradeType,
        category,
        subcategory,
        type: subcategory,
        price: { coins: form.coins, gems: form.gems },
        isActive: form.isActive,
        stock: -1,
        discountedPriceCoins: form.discountedPriceCoins,
        discountedPriceGems: form.discountedPriceGems,
        metadata: {
          isStackable: form.purchaseLimit > 1 ? 'true' : 'false',
          maxQuantityPerUser: String(form.purchaseLimit),
        },
      };
      if (form.upgradeType === 'avatar_upgrade') item.avatarId = category;
      if (form.upgradeType === 'game_upgrade') item.gameId = category;
      await callRpc('store/admin_add_item', JSON.stringify(item));
      setOpen(false);
      setForm({
        upgradeType: 'game_upgrade',
        category: 'uno',
        categoryCustom: '',
        subcategory: 'card_decks',
        subcategoryCustom: '',
        name: '',
        description: '',
        previewUrl: '',
        coins: 0,
        gems: 0,
        purchaseLimit: 1,
        discountedPriceCoins: 0,
        discountedPriceGems: 0,
        isActive: true,
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
      >
        <Plus className="w-4 h-4" /> Add item
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">Add store item</h3>
      <p className="text-xs text-slate-400">
        Avatar items are usually created when you sync an avatar catalog on the Avatars page. Here you add <strong>game</strong> or <strong>chat</strong> items. To add a new game, choose “Other (type below)” and enter the game ID (e.g. <code className="bg-slate-700 px-1 rounded">ludo</code>).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-slate-400 mb-1">Type</label>
          <select
            value={form.upgradeType}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                upgradeType: e.target.value,
                category: e.target.value === 'game_upgrade' ? 'uno' : e.target.value === 'chat_upgrade' ? 'chat_bubbles' : '',
                subcategory: '',
                categoryCustom: '',
                subcategoryCustom: '',
              }))
            }
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          >
            {UPGRADE_TYPES.filter((c) => c.value).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {form.upgradeType === 'avatar_upgrade' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1">Avatar (slug)</label>
            <input
              value={form.category}
              list="avatar-list"
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              placeholder="e.g. avatar1, avatar2"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
            />
            <datalist id="avatar-list">
              {existingAvatars.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
        )}

        {form.upgradeType === 'game_upgrade' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Game</label>
              <select
                value={allGames.includes(form.category) && form.category !== '' ? form.category : '__other__'}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '__other__') {
                    setForm((f) => ({ ...f, category: '__other__', categoryCustom: f.categoryCustom || '', subcategory: '', subcategoryCustom: '' }));
                  } else {
                    setForm((f) => ({ ...f, category: v, categoryCustom: '', subcategory: (SUBCATEGORIES_BY_GAME[v] || [])[0] || '', subcategoryCustom: '' }));
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              >
                {allGames.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
                <option value="__other__">Other (type below)</option>
              </select>
            </div>
            {(form.category === '__other__' || (form.category === '' && form.upgradeType === 'game_upgrade')) && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">New game ID</label>
                <input
                  value={form.categoryCustom}
                  onChange={(e) => setForm((f) => ({ ...f, categoryCustom: e.target.value }))}
                  placeholder="e.g. ludo, my_game"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subcategory</label>
              {subsForGame.length > 0 ? (
                <>
                  <select
                    value={form.subcategory && subsForGame.includes(form.subcategory) ? form.subcategory : '__other__'}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm((f) => ({ ...f, subcategory: v === '__other__' ? '__other__' : v, subcategoryCustom: v === '__other__' ? f.subcategoryCustom : '' }));
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
                  >
                    {subsForGame.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                    <option value="__other__">Other (type below)</option>
                  </select>
                  {form.subcategory === '__other__' && (
                    <input
                      value={form.subcategoryCustom}
                      onChange={(e) => setForm((f) => ({ ...f, subcategoryCustom: e.target.value }))}
                      placeholder="e.g. card_decks, background"
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm mt-1"
                    />
                  )}
                </>
              ) : (
                <input
                  value={form.subcategoryCustom || form.subcategory}
                  onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value, subcategoryCustom: e.target.value }))}
                  placeholder="e.g. card_decks, background"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
                />
              )}
            </div>
          </>
        )}

        {form.upgradeType === 'chat_upgrade' && (
          <>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Chat category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              >
                {CHAT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Subcategory</label>
              <input
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
                placeholder="e.g. basic, animated"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Display name"
            required
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Coins / Gems</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={form.coins}
              onChange={(e) => setForm((f) => ({ ...f, coins: parseInt(e.target.value) || 0 }))}
              placeholder="Coins"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
            />
            <input
              type="number"
              min={0}
              value={form.gems}
              onChange={(e) => setForm((f) => ({ ...f, gems: parseInt(e.target.value) || 0 }))}
              placeholder="Gems"
              className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Purchase limit</label>
          <input
            type="number"
            min={1}
            value={form.purchaseLimit}
            onChange={(e) => setForm((f) => ({ ...f, purchaseLimit: parseInt(e.target.value) || 1 }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
          <span className="text-xs text-slate-500">Max quantity a user can own</span>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Discounted Price Coins</label>
          <input
            type="number"
            min={0}
            value={form.discountedPriceCoins}
            onChange={(e) => setForm((f) => ({ ...f, discountedPriceCoins: Math.max(0, parseInt(e.target.value) || 0) }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
          <span className="text-xs text-slate-500">0 = no discount</span>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">Discounted Price Gems</label>
          <input
            type="number"
            min={0}
            value={form.discountedPriceGems}
            onChange={(e) => setForm((f) => ({ ...f, discountedPriceGems: Math.max(0, parseInt(e.target.value) || 0) }))}
            className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
          />
          <span className="text-xs text-slate-500">0 = no discount</span>
        </div>
      </div>
      <input
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="Description (optional)"
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <input
        value={form.previewUrl}
        onChange={(e) => setForm((f) => ({ ...f, previewUrl: e.target.value }))}
        placeholder="Preview URL (optional)"
        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50">
          {saving ? 'Adding…' : 'Add item'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg bg-slate-600 text-slate-200 text-sm">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function AdminStorePage() {
  const [items, setItems] = useState<StoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StoreItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState({ upgradeType: '', category: '', subcategory: '' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const offset = (page - 1) * pageSize;
      const payload = JSON.stringify({
        upgradeType: filter.upgradeType || undefined,
        category: filter.category || undefined,
        subcategory: filter.subcategory || undefined,
        includeInactive: true,
        limit: pageSize,
        cursor: offset > 0 ? btoa(String(offset)) : undefined,
      });
      const data = await callRpc('store/get_items', payload) as { data?: { items?: StoreItem[]; total?: number }; items?: StoreItem[]; total?: number };
      const raw = data?.data ?? data;
      const list = raw?.items ?? [];
      const totalCount = typeof raw?.total === 'number' ? raw.total : list.length;
      setItems(Array.isArray(list) ? list : []);
      setTotal(totalCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [filter.upgradeType, filter.category, filter.subcategory, page, pageSize]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  };

  const existingGames = [...new Set(items.filter((i) => i.upgradeType === 'game_upgrade' && (i.gameId || i.category)).map((i) => i.gameId || i.category))].filter(Boolean) as string[];
  const existingAvatars = [...new Set(items.filter((i) => i.upgradeType === 'avatar_upgrade' && (i.avatarId || i.category)).map((i) => i.avatarId || i.category))].filter(Boolean) as string[];

  const saveItem = async (item: StoreItem) => {
    setSaving(true);
    try {
      const limit = item.purchaseLimit ?? 1;
      const payload = {
        ...item,
        stock: -1, // always unlimited from admin
        isActive: item.isActive ?? true,
        discountedPriceCoins: item.discountedPriceCoins ?? 0,
        discountedPriceGems: item.discountedPriceGems ?? 0,
        metadata: {
          ...(item.metadata ?? {}),
          isStackable: limit > 1 ? 'true' : 'false',
          maxQuantityPerUser: String(limit),
        },
      };
      await callRpc('store/admin_update_item', JSON.stringify(payload));
      setEditing(null);
      loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm(`Delete item "${itemId}"?`)) return;
    setSaving(true);
    try {
      await callRpc('store/admin_delete_item', JSON.stringify({ itemId }));
      setEditing(null);
      loadItems();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Store items</h1>
          <p className="text-slate-400 text-sm mt-1">
            Add, edit, or remove items. Avatar items are created when you sync a catalog on the Avatars page. Here you manage game and chat items and prices.
          </p>
        </div>
        <AddItemForm onAdded={loadItems} existingGames={existingGames} existingAvatars={existingAvatars} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 items-center">
        <select
          value={filter.upgradeType}
          onChange={(e) => {
            setFilter((f) => ({ ...f, upgradeType: e.target.value, category: '', subcategory: '' }));
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm"
        >
          {UPGRADE_TYPES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Game or category (e.g. uno, avatar1)"
          value={filter.category}
          onChange={(e) => {
            setFilter((f) => ({ ...f, category: e.target.value }));
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm w-48"
        />
        <input
          type="text"
          placeholder="Subcategory (e.g. card_decks)"
          value={filter.subcategory}
          onChange={(e) => {
            setFilter((f) => ({ ...f, subcategory: e.target.value }));
            setPage(1);
          }}
          className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-100 text-sm w-40"
        />
        <button onClick={loadItems} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600">
          Refresh
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800">
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Item</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Type / Game / Subcategory</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Price</th>
                <th className="text-left py-3 px-3 text-slate-400 font-medium">Active</th>
                <th className="text-right py-3 px-3 text-slate-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) =>
                editing?.itemId === item.itemId ? (
                  <tr key={item.itemId} className="border-b border-slate-700 bg-slate-800/50">
                    <td colSpan={5} className="py-3 px-3">
                      <EditRow
                        item={editing}
                        setEditing={setEditing}
                        saving={saving}
                        onSave={saveItem}
                        onDelete={() => deleteItem(item.itemId)}
                        onCancel={() => setEditing(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr key={item.itemId} className="border-b border-slate-700 hover:bg-slate-800/50">
                    <td className="py-2 px-3">
                      <span className="font-medium text-slate-100">{item.name}</span>
                      <br />
                      <span className="text-xs text-slate-500">{item.itemId}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-700">{item.upgradeType ?? item.category}</span>
                      <span className="ml-1">{item.gameId || item.avatarId || item.category}</span>
                      <span className="ml-1 text-slate-500">/ {item.subcategory ?? item.type ?? '–'}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">
                      {item.price.coins > 0 && <span className="text-amber-400">{item.price.coins} coins</span>}
                      {item.price.coins > 0 && item.price.gems > 0 && ' / '}
                      {item.price.gems > 0 && <span className="text-purple-400">{item.price.gems} gems</span>}
                      {item.price.coins === 0 && item.price.gems === 0 && <span className="text-green-400">Free</span>}
                      {((item.discountedPriceCoins ?? 0) > 0 || (item.discountedPriceGems ?? 0) > 0) && (
                        <span className="ml-1 px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 text-xs font-medium">
                          Sale: {(item.discountedPriceCoins ?? 0) > 0 ? `${item.discountedPriceCoins} coins` : ''}{(item.discountedPriceCoins ?? 0) > 0 && (item.discountedPriceGems ?? 0) > 0 ? ' / ' : ''}{(item.discountedPriceGems ?? 0) > 0 ? `${item.discountedPriceGems} gems` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className={item.isActive ? 'text-green-400' : 'text-red-400'}>{item.isActive ? 'Yes' : 'No'}</span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button onClick={() => setEditing({ ...item })} className="text-indigo-400 hover:underline text-xs inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => deleteItem(item.itemId)} className="ml-2 text-red-400 hover:underline text-xs inline-flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3 px-3 border-t border-slate-700 bg-slate-800/50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">
                Showing {startItem}–{endItem} of {total}
              </span>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Per page
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-200 text-xs"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={page <= 1 || loading}
                className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
              >
                Previous
              </button>
              <span className="px-2 text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
              >
                Next
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={page >= totalPages || loading}
                className="px-2 py-1 rounded bg-slate-700 text-slate-300 text-xs disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-600"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}
      {!loading && items.length === 0 && <p className="py-6 text-slate-500 text-center">No items match the filter. Change filters or add an item.</p>}
    </div>
  );
}

function EditRow({
  item,
  setEditing,
  saving,
  onSave,
  onDelete,
  onCancel,
}: {
  item: StoreItem;
  setEditing: (fn: (prev: StoreItem | null) => StoreItem | null) => void;
  saving: boolean;
  onSave: (item: StoreItem) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <span className="text-xs text-slate-400 w-full">{item.name} — {item.itemId}</span>
      <input
        value={item.previewUrl ?? ''}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, previewUrl: e.target.value } : null))}
        placeholder="Preview URL"
        className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <label className="text-xs text-slate-400">Coins:</label>
      <input
        type="number"
        min={0}
        value={item.price.coins}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, price: { ...prev.price, coins: parseInt(e.target.value) || 0 } } : null))}
        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <label className="text-xs text-slate-400">Gems:</label>
      <input
        type="number"
        min={0}
        value={item.price.gems}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, price: { ...prev.price, gems: parseInt(e.target.value) || 0 } } : null))}
        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <label className="text-xs text-slate-400">Limit:</label>
      <input
        type="number"
        min={1}
        value={item.purchaseLimit ?? (item.metadata?.maxQuantityPerUser ? parseInt(item.metadata.maxQuantityPerUser) : 1)}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, purchaseLimit: parseInt(e.target.value) || 1 } : null))}
        className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <label className="text-xs text-slate-400">Sale Coins:</label>
      <input
        type="number"
        min={0}
        value={item.discountedPriceCoins ?? 0}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, discountedPriceCoins: Math.max(0, parseInt(e.target.value) || 0) } : null))}
        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <label className="text-xs text-slate-400">Sale Gems:</label>
      <input
        type="number"
        min={0}
        value={item.discountedPriceGems ?? 0}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, discountedPriceGems: Math.max(0, parseInt(e.target.value) || 0) } : null))}
        className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-sm"
      />
      <label className="text-xs text-slate-400">Active:</label>
      <input
        type="checkbox"
        checked={item.isActive}
        onChange={(e) => setEditing((prev) => (prev ? { ...prev, isActive: e.target.checked } : null))}
        className="rounded"
      />
      <button onClick={() => onSave(item)} disabled={saving} className="px-3 py-1.5 rounded bg-indigo-600 text-white text-xs disabled:opacity-50">
        Save
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 rounded bg-slate-600 text-slate-200 text-xs">
        Cancel
      </button>
      <button onClick={onDelete} disabled={saving} className="px-3 py-1.5 rounded bg-red-600 text-white text-xs disabled:opacity-50">
        Delete
      </button>
    </div>
  );
}
