'use client';

/**
 * Featured items admin — curates the cross-vertical carousel that drives
 * the shop's All-tab "Featured this week" section.
 *
 * Backend writes go through `shop/admin_set_featured` (atomic replace of
 * the entire list) and `shop/admin_list_featured` (read with audit
 * metadata). See chat-redesign-backend-spec.md §10 for the schema and
 * invariants.
 *
 * UI shape:
 *   - Top: read-only summary of the current published list.
 *   - Editor: the working draft. Supports add row, remove row, drag-free
 *     reorder via up/down arrows (drag-and-drop is overkill for ≤10
 *     items), kind picker per row.
 *   - Save: replaces the published list atomically; prompts on unsaved
 *     changes when navigating away.
 *
 * The kind picker locks the item to one vertical because the backend
 * rejects mismatches between kind and store_items.vertical. Admins paste
 * the itemId by hand or copy from the chat-shop / avatar / game admin
 * pages — there's no inline picker yet (could be added as a follow-up).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  FEATURED_KIND_LABEL,
  FeaturedKind,
  ListFeaturedItem,
  listFeatured,
  setFeatured,
} from '@/lib/shop-api';

const MAX_FEATURED = 10;

interface DraftRow {
  itemId: string;
  kind: FeaturedKind;
  /** Cached display label from the published list (if known). Saves an
   * admin from staring at raw UUIDs in the editor. New rows have empty
   * preview until next reload. */
  name?: string;
}

export default function FeaturedAdminPage() {
  const [published, setPublished] = useState<ListFeaturedItem[] | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await listFeatured();
      setPublished(res.items);
      setVersion(res.version);
      // Reset draft to match published. Admins always start from the
      // current state — no autosave.
      setDraft(
        res.items.map((it) => ({
          itemId: it.itemId,
          kind: it.kind,
          name: it.name,
        })),
      );
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty = useMemo(() => {
    if (!published) return false;
    if (published.length !== draft.length) return true;
    for (let i = 0; i < draft.length; i++) {
      if (draft[i].itemId !== published[i].itemId) return true;
      if (draft[i].kind !== published[i].kind) return true;
    }
    return false;
  }, [published, draft]);

  const addRow = () => {
    if (draft.length >= MAX_FEATURED) {
      showToast(`Max ${MAX_FEATURED} featured items.`);
      return;
    }
    setDraft((prev) => [...prev, { itemId: '', kind: 'chat' }]);
  };

  const removeRow = (idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...draft];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft(next);
  };

  const updateRow = (idx: number, patch: Partial<DraftRow>) => {
    setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const onSave = async () => {
    // Client-side checks before the round trip.
    const seen = new Set<string>();
    for (let i = 0; i < draft.length; i++) {
      const r = draft[i];
      if (!r.itemId.trim()) {
        showToast(`Row ${i + 1}: itemId is empty.`);
        return;
      }
      if (seen.has(r.itemId)) {
        showToast(`Duplicate itemId at row ${i + 1}.`);
        return;
      }
      seen.add(r.itemId);
    }

    setSaving(true);
    try {
      await setFeatured({
        items: draft.map((r, i) => ({
          itemId: r.itemId.trim(),
          kind: r.kind,
          sortOrder: i,
        })),
      });
      showToast('Saved');
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    if (!isDirty) return;
    if (!confirm('Discard unsaved changes?')) return;
    if (published) {
      setDraft(
        published.map((it) => ({
          itemId: it.itemId,
          kind: it.kind,
          name: it.name,
        })),
      );
    } else {
      setDraft([]);
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Featured Items</h1>
          <p className="text-sm text-slate-400 mt-1">
            Cross-vertical carousel shown at the top of the shop&apos;s All tab. Up to {MAX_FEATURED} entries.
            Saves replace the entire list atomically and bump the featured-version counter — see{' '}
            <span className="text-slate-200">shop/admin_set_featured</span>.
          </p>
          {version !== null && (
            <p className="text-xs text-slate-500 mt-1">Current version: {version}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 px-3 py-1.5 border border-slate-700 rounded"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </header>

      {toast && (
        <div className="px-3 py-2 text-sm bg-indigo-700/20 border border-indigo-600 text-indigo-200 rounded">
          {toast}
        </div>
      )}

      {loadError && (
        <div className="px-3 py-2 text-sm bg-red-700/20 border border-red-700 text-red-300 rounded">
          {loadError}
        </div>
      )}

      <section className="rounded border border-slate-800">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-medium text-slate-200">Editor</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {draft.length} / {MAX_FEATURED} entries
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addRow}
              disabled={draft.length >= MAX_FEATURED}
              className="flex items-center gap-1 text-sm text-slate-200 hover:text-white px-3 py-1.5 border border-slate-700 rounded disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add row
            </button>
            <button
              onClick={onDiscard}
              disabled={!isDirty || saving}
              className="text-sm text-slate-400 hover:text-slate-200 px-3 py-1.5 border border-slate-700 rounded disabled:opacity-30"
            >
              Discard
            </button>
            <button
              onClick={onSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-slate-500 text-white px-3 py-1.5 rounded"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        <div className="divide-y divide-slate-800">
          {draft.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No featured items. Click <span className="text-slate-300">Add row</span> to start curating.
            </div>
          )}
          {draft.map((row, idx) => (
            <div key={idx} className="px-4 py-3 flex items-start gap-3">
              <div className="flex flex-col gap-1 pt-1">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-slate-500 hover:text-slate-200 disabled:opacity-20"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === draft.length - 1}
                  className="text-slate-500 hover:text-slate-200 disabled:opacity-20"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Item ID (UUID)
                  </label>
                  <input
                    value={row.itemId}
                    onChange={(e) => updateRow(idx, { itemId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:border-indigo-500 outline-none"
                    placeholder="00000000-0000-0000-0000-000000000000"
                  />
                  {row.name && (
                    <p className="text-xs text-slate-500 mt-1 truncate">{row.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                    Kind
                  </label>
                  <select
                    value={row.kind}
                    onChange={(e) =>
                      updateRow(idx, { kind: e.target.value as FeaturedKind })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-200 focus:border-indigo-500 outline-none"
                  >
                    {(['chat', 'avatar', 'game'] as FeaturedKind[]).map((k) => (
                      <option key={k} value={k}>
                        {FEATURED_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={() => removeRow(idx)}
                className="text-rose-400 hover:text-rose-300 mt-5"
                title="Remove row"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      {published && published.length > 0 && (
        <section className="rounded border border-slate-800">
          <header className="px-4 py-3 border-b border-slate-800">
            <h2 className="text-sm font-medium text-slate-200">Currently Published</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              What players see right now. Save the editor to update.
            </p>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-slate-900/40">
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Kind</th>
                <th className="px-4 py-2">Item ID</th>
                <th className="px-4 py-2">Added</th>
              </tr>
            </thead>
            <tbody>
              {published.map((it, i) => (
                <tr key={it.itemId} className="border-t border-slate-800">
                  <td className="px-4 py-2 text-slate-500">{i + 1}</td>
                  <td className="px-4 py-2 text-slate-200">{it.name}</td>
                  <td className="px-4 py-2 text-slate-400">{FEATURED_KIND_LABEL[it.kind]}</td>
                  <td className="px-4 py-2 font-mono text-xs text-slate-500">{it.itemId}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {new Date(it.addedAt * 1000).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
