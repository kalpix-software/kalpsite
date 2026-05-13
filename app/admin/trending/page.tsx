'use client';

/**
 * Trending packs admin — curates the chat picker's trending list.
 *
 * Powers two player-facing surfaces:
 *   - The trending carousel inside `picker/screen` (lean preview, top 10).
 *   - The full trending list page reached via `picker/trending` from any
 *     trending-icon tap.
 *
 * Backend writes go through `chat_shop/admin_set_trending` — per-kind
 * atomic replace (sticker / gif / emote). Changing sticker trending
 * leaves gif and emote rows untouched.
 *
 * UI shape: kind tabs at the top, ordered list of pack rows below. Each
 * row has up/down reorder + remove. Add rows by pasting a pack itemId
 * (admins copy from the Chat Shop admin page). Save replaces the whole
 * list for the active kind.
 *
 * No "load current" admin RPC for trending in v1 — the backend only has
 * a write endpoint. So this page starts empty and admins paste in the
 * pack ids they want to feature. Future extension: a read RPC that
 * mirrors `chat_shop/admin_set_trending`'s storage so admins can edit
 * the existing list rather than always start fresh.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import {
  PACK_KIND_LABEL,
  PackKind,
  TrendingPackEntry,
  listTrendingPacks,
  setTrendingPacks,
} from '@/lib/chat-shop-api';

const KIND_OPTIONS: PackKind[] = ['sticker', 'gif', 'emote'];

interface DraftRow {
  packId: string;
  /** Joined from store_items.name; empty when the row is freshly added by the admin. */
  packName?: string;
}

const MAX_TRENDING = 100;

export default function TrendingAdminPage() {
  const [activeKind, setActiveKind] = useState<PackKind>('sticker');

  // One draft per kind so switching tabs doesn't lose work-in-progress.
  // Keyed by PackKind; default empty per kind.
  const [draftByKind, setDraftByKind] = useState<Record<PackKind, DraftRow[]>>({
    sticker: [],
    gif: [],
    emote: [],
  });
  // Track which kinds have been hydrated from the server so a tab switch
  // doesn't refetch and wipe local edits. A user can force a reload via the
  // Refresh button which clears the flag.
  const loadedKinds = useRef<Record<PackKind, boolean>>({
    sticker: false,
    gif: false,
    emote: false,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const draft = draftByKind[activeKind];

  // Fetch the currently-published trending list for the active kind. Pulled
  // out as a callback so the Refresh button and the mount/tab-switch effect
  // both share the same code path.
  const loadActiveKind = useCallback(async (kind: PackKind) => {
    setLoading(true);
    try {
      const resp = await listTrendingPacks(kind);
      setDraftByKind((prev) => ({
        ...prev,
        [kind]: resp.items.map((it) => ({ packId: it.packId, packName: it.packName })),
      }));
      loadedKinds.current[kind] = true;
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'Failed to load trending');
      setTimeout(() => setToast(''), 2500);
    } finally {
      setLoading(false);
    }
  }, []);

  // Hydrate when the active kind changes (and on mount). Skips kinds we've
  // already loaded once in this session so unsaved edits aren't wiped just
  // because the admin switched tabs and switched back.
  useEffect(() => {
    if (!loadedKinds.current[activeKind]) {
      void loadActiveKind(activeKind);
    }
  }, [activeKind, loadActiveKind]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const updateActiveDraft = (next: DraftRow[]) => {
    setDraftByKind((prev) => ({ ...prev, [activeKind]: next }));
  };

  const addRow = () => {
    if (draft.length >= MAX_TRENDING) {
      showToast(`Max ${MAX_TRENDING} entries per kind.`);
      return;
    }
    updateActiveDraft([...draft, { packId: '' }]);
  };

  const removeRow = (idx: number) => {
    updateActiveDraft(draft.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[idx], next[target]] = [next[target], next[idx]];
    updateActiveDraft(next);
  };

  const updateRow = (idx: number, patch: Partial<DraftRow>) => {
    updateActiveDraft(draft.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const onSave = async () => {
    if (draft.length === 0) {
      if (!confirm('Save an empty list? This clears all trending packs of this kind.')) {
        return;
      }
    }
    const seen = new Set<string>();
    for (let i = 0; i < draft.length; i++) {
      const r = draft[i];
      if (!r.packId.trim()) {
        showToast(`Row ${i + 1}: packId is empty.`);
        return;
      }
      if (seen.has(r.packId)) {
        showToast(`Duplicate packId at row ${i + 1}.`);
        return;
      }
      seen.add(r.packId);
    }

    setSaving(true);
    try {
      const items: TrendingPackEntry[] = draft.map((r, i) => ({
        packId: r.packId.trim(),
        rank: i,
      }));
      const res = await setTrendingPacks({ packKind: activeKind, items });
      showToast(`Saved (${res.count} entries)`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const draftCount = useMemo(() => draft.length, [draft]);

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">Trending Packs</h1>
          <p className="text-sm text-slate-400 mt-1">
            Per-kind trending list shown in the chat picker carousel + the full trending page.
            Saves replace the entire list for the selected kind atomically — see{' '}
            <span className="text-slate-200">chat_shop/admin_set_trending</span>. The
            currently-published list is loaded on tab open via{' '}
            <span className="text-slate-200">chat_shop/admin_list_trending</span>.
          </p>
        </div>
        <button
          onClick={() => {
            loadedKinds.current[activeKind] = false;
            void loadActiveKind(activeKind);
          }}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50 px-3 py-1.5 border border-slate-700 rounded"
          title="Discard local edits and reload the published list"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {toast && (
        <div className="px-3 py-2 text-sm bg-indigo-700/20 border border-indigo-600 text-indigo-200 rounded">
          {toast}
        </div>
      )}

      {/* Kind tabs */}
      <div className="flex gap-1 border-b border-slate-800">
        {KIND_OPTIONS.map((k) => (
          <button
            key={k}
            onClick={() => setActiveKind(k)}
            className={`px-3 py-2 text-sm border-b-2 transition ${
              activeKind === k
                ? 'border-indigo-500 text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {PACK_KIND_LABEL[k]}
            <span className="ml-2 text-[10px] text-slate-500 align-middle">
              {draftByKind[k].length}
            </span>
          </button>
        ))}
      </div>

      <section className="rounded border border-slate-800">
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-medium text-slate-200">{PACK_KIND_LABEL[activeKind]}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {draftCount} / {MAX_TRENDING} entries · ranked top-to-bottom
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addRow}
              disabled={draft.length >= MAX_TRENDING}
              className="flex items-center gap-1 text-sm text-slate-200 hover:text-white px-3 py-1.5 border border-slate-700 rounded disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add row
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-900 disabled:text-slate-500 text-white px-3 py-1.5 rounded"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : `Save ${PACK_KIND_LABEL[activeKind]}`}
            </button>
          </div>
        </header>

        <div className="divide-y divide-slate-800">
          {draft.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              No trending {PACK_KIND_LABEL[activeKind].toLowerCase()} yet. Click{' '}
              <span className="text-slate-300">Add row</span> to start.
            </div>
          )}
          {draft.map((row, idx) => (
            <div key={idx} className="px-4 py-3 flex items-start gap-3">
              <div className="flex flex-col gap-1 pt-1 w-10">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 text-center">
                  rank
                </span>
                <span className="text-sm text-slate-300 text-center font-mono">{idx}</span>
              </div>
              <div className="flex flex-col gap-1 pt-2">
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

              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                  Pack ID (UUID)
                  {row.packName ? (
                    <span className="ml-2 text-slate-300 normal-case tracking-normal">
                      — {row.packName}
                    </span>
                  ) : null}
                </label>
                <input
                  value={row.packId}
                  onChange={(e) =>
                    // Clearing the joined name on edit prevents a stale label
                    // (e.g. the old pack's name) lingering after the admin
                    // pastes in a different UUID. The name will repopulate on
                    // the next Refresh / page load.
                    updateRow(idx, { packId: e.target.value, packName: undefined })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm font-mono text-slate-200 focus:border-indigo-500 outline-none"
                  placeholder="00000000-0000-0000-0000-000000000000"
                />
              </div>

              <button
                onClick={() => removeRow(idx)}
                className="text-rose-400 hover:text-rose-300 mt-6"
                title="Remove row"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
