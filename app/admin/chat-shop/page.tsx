'use client';

/**
 * Chat shop admin — seven sub-category tabs, each listing items with
 * draft/active/hidden/archived status and a form for creating/editing.
 *
 * Writes go through `chat_shop/admin_upsert_item`,
 * `chat_shop/admin_publish_item`, and `chat_shop/admin_archive_item`. All
 * admin-gated on the backend.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Archive, CheckCircle2, Pencil, Gift, Star } from 'lucide-react';
import {
  AdminListItem,
  ItemStatus,
  SUBCATEGORIES,
  SUBCATEGORY_LABEL,
  Subcategory,
  SyncItemRequest,
  archiveItem,
  grantItem,
  listItemsAdmin,
  publishItem,
  upsertItem,
} from '@/lib/chat-shop-api';
import {
  BackgroundFields,
  BubbleStyleFields,
  FontFields,
  PackFields,
  ThemeFields,
  defaultAssetsFor,
} from '@/components/admin/chat-shop/SubcategoryFields';

const STATUS_FILTERS: { value: ItemStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'archived', label: 'Archived' },
];

export default function ChatShopAdminPage() {
  const [tab, setTab] = useState<Subcategory>('theme');
  const [statusFilter, setStatusFilter] = useState<ItemStatus | ''>('');
  const [items, setItems] = useState<AdminListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState<{ mode: 'new' | 'edit'; draft: SyncItemRequest } | null>(null);
  const [toast, setToast] = useState('');
  const [grantFor, setGrantFor] = useState<AdminListItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await listItemsAdmin({
        subcategory: tab,
        statuses: statusFilter ? [statusFilter] : [],
        limit: 200,
      });
      setItems(res.items);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [tab, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNew = () => {
    const assets = defaultAssetsFor(tab);
    setEditing({
      mode: 'new',
      draft: {
        subcategory: tab,
        slug: '',
        name: '',
        description: '',
        iconUrl: '',
        previewUrl: '',
        currencyType: 'coins',
        price: 0,
        rarity: 'common',
        status: 'draft',
        sortOrder: 0,
        isDefault: false,
        previewAllowed: true,
        assets,
      },
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const onSaved = async () => {
    showToast('Saved');
    setEditing(null);
    await load();
  };

  const onPublish = async (id: string) => {
    try {
      await publishItem(id);
      showToast('Published');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Publish failed');
    }
  };

  const onArchive = async (id: string) => {
    if (!confirm('Archive this item? Ownership is preserved but it will disappear from the shop.')) return;
    try {
      await archiveItem(id);
      showToast('Archived');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Archive failed');
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Chat Shop</h1>
          <p className="text-sm text-slate-400 mt-1">
            Content pipeline for chat themes, bubbles, backgrounds, fonts, emotes, stickers, GIFs.
            Items published here appear on <span className="text-slate-200">chat_shop/get_all</span> after the next ETag bump.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 border border-slate-700 rounded"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </header>

      {toast && (
        <div className="px-3 py-2 text-sm bg-indigo-700/20 border border-indigo-600 text-indigo-200 rounded">
          {toast}
        </div>
      )}

      {/* Subcategory tabs */}
      <div className="flex flex-wrap gap-1 border-b border-slate-800">
        {SUBCATEGORIES.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`px-3 py-2 text-sm border-b-2 transition ${
              tab === s
                ? 'border-indigo-500 text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {SUBCATEGORY_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Status:</span>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => setStatusFilter(f.value)}
              className={`text-xs px-2.5 py-1 rounded border transition ${
                statusFilter === f.value
                  ? 'bg-slate-800 border-slate-600 text-slate-100'
                  : 'border-slate-800 text-slate-500 hover:text-slate-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded"
        >
          <Plus className="w-4 h-4" /> New {SUBCATEGORY_LABEL[tab].slice(0, -1).toLowerCase()}
        </button>
      </div>

      <ItemTable
        items={items}
        loading={loading}
        loadError={loadError}
        onEdit={(it) => {
          // Load full assets by re-opening a shell draft — we don't have
          // the detail fields in the list endpoint, so the admin gets a
          // fresh assets scaffold and fills in what they want to change.
          const assets = defaultAssetsFor(it.subcategory as Subcategory);
          setEditing({
            mode: 'edit',
            draft: {
              itemId: it.itemId,
              subcategory: it.subcategory as Subcategory,
              slug: it.slug,
              name: it.name,
              description: '',
              iconUrl: '',
              previewUrl: '',
              currencyType: 'coins',
              price: 0,
              rarity: it.rarity,
              status: it.status,
              sortOrder: 0,
              isDefault: it.isDefault,
              previewAllowed: true,
              assets,
            },
          });
        }}
        onPublish={onPublish}
        onArchive={onArchive}
        onGrant={setGrantFor}
      />

      {editing && (
        <EditDrawer
          draft={editing.draft}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}

      {grantFor && <GrantDialog item={grantFor} onClose={() => setGrantFor(null)} onGranted={showToast} />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// List table
// ----------------------------------------------------------------------------

function ItemTable({
  items,
  loading,
  loadError,
  onEdit,
  onPublish,
  onArchive,
  onGrant,
}: {
  items: AdminListItem[];
  loading: boolean;
  loadError: string;
  onEdit: (it: AdminListItem) => void;
  onPublish: (id: string) => void;
  onArchive: (id: string) => void;
  onGrant: (it: AdminListItem) => void;
}) {
  if (loadError) return <div className="text-sm text-red-400">Error: {loadError}</div>;
  return (
    <div className="rounded border border-slate-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-900/60">
          <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Slug</th>
            <th className="px-3 py-2">Rarity</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Default</th>
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                Loading…
              </td>
            </tr>
          )}
          {!loading && items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
                No items.
              </td>
            </tr>
          )}
          {items.map((it) => (
            <tr key={it.itemId} className="border-t border-slate-800 hover:bg-slate-900/40">
              <td className="px-3 py-2 text-slate-200">{it.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-slate-400">{it.slug}</td>
              <td className="px-3 py-2 text-slate-400">{it.rarity}</td>
              <td className="px-3 py-2">
                <StatusPill status={it.status} />
              </td>
              <td className="px-3 py-2">
                {it.isDefault ? <Star className="w-4 h-4 text-amber-400" /> : <span className="text-slate-700">—</span>}
              </td>
              <td className="px-3 py-2 text-xs text-slate-500">
                {new Date(it.updatedAt * 1000).toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right">
                <div className="flex items-center gap-2 justify-end">
                  {it.status !== 'active' && (
                    <button
                      onClick={() => onPublish(it.itemId)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                      title="Publish"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Publish
                    </button>
                  )}
                  <button
                    onClick={() => onEdit(it)}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onGrant(it)}
                    className="text-xs text-slate-400 hover:text-amber-300 flex items-center gap-1"
                    title="Grant to user"
                  >
                    <Gift className="w-3.5 h-3.5" />
                  </button>
                  {it.status !== 'archived' && (
                    <button
                      onClick={() => onArchive(it.itemId)}
                      className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1"
                      title="Archive"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusPill({ status }: { status: ItemStatus }) {
  const styles: Record<ItemStatus, string> = {
    draft: 'bg-amber-900/40 text-amber-300 border-amber-800',
    active: 'bg-emerald-900/40 text-emerald-300 border-emerald-800',
    hidden: 'bg-slate-800 text-slate-400 border-slate-700',
    archived: 'bg-red-900/40 text-red-300 border-red-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded border text-xs ${styles[status]}`}>{status}</span>
  );
}

// ----------------------------------------------------------------------------
// Edit drawer
// ----------------------------------------------------------------------------

function EditDrawer({
  draft: initial,
  mode,
  onClose,
  onSaved,
}: {
  draft: SyncItemRequest;
  mode: 'new' | 'edit';
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<SyncItemRequest>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const patch = useCallback((partial: Partial<SyncItemRequest>) => {
    setDraft((d) => ({ ...d, ...partial }));
  }, []);

  const patchAssets = useCallback((partial: Partial<SyncItemRequest['assets']>) => {
    setDraft((d) => ({ ...d, assets: { ...d.assets, ...partial } }));
  }, []);

  const save = async () => {
    setErr('');
    setSaving(true);
    try {
      if (!draft.slug) throw new Error('Slug is required');
      if (!draft.name) throw new Error('Name is required');
      if (draft.currencyType === 'free' && draft.price !== 0) {
        throw new Error('Free items must have price=0');
      }
      if (draft.discountedPrice != null && draft.discountedPrice >= draft.price) {
        throw new Error('discountedPrice must be less than price');
      }
      await upsertItem(draft);
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-10 pb-10 px-4 z-30 overflow-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {mode === 'new' ? 'New' : 'Edit'} {SUBCATEGORY_LABEL[draft.subcategory].slice(0, -1).toLowerCase()}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Saves via chat_shop/admin_upsert_item. Set status &quot;active&quot; to publish immediately, or leave as
              &quot;draft&quot; and use the Publish button later.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-5">
          <ItemMetaFields draft={draft} onChange={patch} />
          <hr className="border-slate-800" />
          <AssetsPicker draft={draft} onChangeAssets={patchAssets} />
        </div>

        <div className="px-5 py-4 border-t border-slate-800 flex items-center justify-between">
          {err ? <p className="text-xs text-red-400">{err}</p> : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemMetaFields({
  draft,
  onChange,
}: {
  draft: SyncItemRequest;
  onChange: (partial: Partial<SyncItemRequest>) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Slug (lowercase, unique)</span>
        <input
          type="text"
          value={draft.slug}
          onChange={(e) => onChange({ slug: e.target.value.toLowerCase() })}
          placeholder="chat_bubble_cloud_red"
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Display name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400 md:col-span-2">
        <span>Description</span>
        <textarea
          rows={2}
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Rarity</span>
        <select
          value={draft.rarity}
          onChange={(e) => onChange({ rarity: e.target.value as SyncItemRequest['rarity'] })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        >
          <option value="common">common</option>
          <option value="rare">rare</option>
          <option value="epic">epic</option>
          <option value="legendary">legendary</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Status</span>
        <select
          value={draft.status}
          onChange={(e) => onChange({ status: e.target.value as SyncItemRequest['status'] })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        >
          <option value="draft">draft</option>
          <option value="active">active</option>
          <option value="hidden">hidden</option>
          <option value="archived">archived</option>
        </select>
      </label>

      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-slate-400 flex-1">
          <span>Currency</span>
          <select
            value={draft.currencyType}
            onChange={(e) => {
              const next = e.target.value as SyncItemRequest['currencyType'];
              onChange({
                currencyType: next,
                price: next === 'free' ? 0 : draft.price,
                discountedPrice: next === 'free' ? undefined : draft.discountedPrice,
              });
            }}
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            <option value="coins">coins</option>
            <option value="gems">gems</option>
            <option value="free">free</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400 flex-1">
          <span>Price</span>
          <input
            type="number"
            value={draft.price}
            disabled={draft.currencyType === 'free'}
            onChange={(e) => onChange({ price: Number(e.target.value) || 0 })}
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400 flex-1">
          <span>Discounted price (optional)</span>
          <input
            type="number"
            value={draft.discountedPrice ?? ''}
            placeholder="—"
            disabled={draft.currencyType === 'free'}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ discountedPrice: v === '' ? undefined : Number(v) || 0 });
            }}
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200 disabled:opacity-50"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Sort order</span>
        <input
          type="number"
          value={draft.sortOrder}
          onChange={(e) => onChange({ sortOrder: Number(e.target.value) || 0 })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </label>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(e) => onChange({ isDefault: e.target.checked })}
          />
          is_default
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={draft.previewAllowed}
            onChange={(e) => onChange({ previewAllowed: e.target.checked })}
          />
          Preview allowed
        </label>
      </div>

      <AvailabilityFields draft={draft} onChange={onChange} />
    </div>
  );
}

function AvailabilityFields({
  draft,
  onChange,
}: {
  draft: SyncItemRequest;
  onChange: (partial: Partial<SyncItemRequest>) => void;
}) {
  const toDateInput = (s?: number) => (s ? new Date(s * 1000).toISOString().slice(0, 16) : '');
  const fromDateInput = (s: string): number | undefined =>
    s ? Math.floor(new Date(s).getTime() / 1000) : undefined;
  return (
    <div className="md:col-span-2 grid grid-cols-2 gap-4">
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Available from (optional)</span>
        <input
          type="datetime-local"
          value={toDateInput(draft.availableFrom)}
          onChange={(e) => onChange({ availableFrom: fromDateInput(e.target.value) })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-slate-400">
        <span>Available until (optional)</span>
        <input
          type="datetime-local"
          value={toDateInput(draft.availableUntil)}
          onChange={(e) => onChange({ availableUntil: fromDateInput(e.target.value) })}
          className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
        />
      </label>
    </div>
  );
}

function AssetsPicker({
  draft,
  onChangeAssets,
}: {
  draft: SyncItemRequest;
  onChangeAssets: (partial: Partial<SyncItemRequest['assets']>) => void;
}) {
  switch (draft.subcategory) {
    case 'bubble_style':
      return (
        <BubbleStyleFields
          value={draft.assets.bubbleStyle!}
          onChange={(v) => onChangeAssets({ bubbleStyle: v })}
        />
      );
    case 'background':
      return (
        <BackgroundFields
          value={draft.assets.background!}
          onChange={(v) => onChangeAssets({ background: v })}
        />
      );
    case 'font':
      return <FontFields value={draft.assets.font!} onChange={(v) => onChangeAssets({ font: v })} />;
    case 'theme':
      return <ThemeFields value={draft.assets.theme!} onChange={(v) => onChangeAssets({ theme: v })} />;
    case 'sticker_pack':
    case 'gif_pack':
    case 'emote_pack':
      return (
        <PackFields
          value={draft.assets.pack!}
          onChange={(v) => onChangeAssets({ pack: v })}
          kind={draft.subcategory}
        />
      );
  }
}

// ----------------------------------------------------------------------------
// Grant dialog (customer-support / promo seeding)
// ----------------------------------------------------------------------------

function GrantDialog({
  item,
  onClose,
  onGranted,
}: {
  item: AdminListItem;
  onClose: () => void;
  onGranted: (msg: string) => void;
}) {
  const [userId, setUserId] = useState('');
  const [source, setSource] = useState<'gift' | 'reward' | 'admin_grant' | 'promo'>('admin_grant');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setErr('');
    setSaving(true);
    try {
      const res = await grantItem({ userId, itemId: item.itemId, source });
      onGranted(`Granted (${res.inventoryAdds.length} rows added)`);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Grant failed');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 px-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg p-5 space-y-3">
        <h3 className="text-base font-semibold text-slate-100">
          Grant “{item.name}” to user
        </h3>
        <p className="text-xs text-slate-500">
          If the item is a theme, bundled components are granted automatically (source=theme_bundle).
        </p>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          <span>User ID (uuid)</span>
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value.trim())}
            placeholder="00000000-0000-0000-0000-000000000000"
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded font-mono text-slate-200"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-400">
          <span>Source</span>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
            className="px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            <option value="admin_grant">admin_grant</option>
            <option value="gift">gift</option>
            <option value="reward">reward</option>
            <option value="promo">promo</option>
          </select>
        </label>
        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !userId}
            className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-1.5 rounded"
          >
            {saving ? 'Granting…' : 'Grant'}
          </button>
        </div>
      </div>
    </div>
  );
}
