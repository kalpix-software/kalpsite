'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Filter, FolderTree, Pencil, Plus, Power, Puzzle, RefreshCw, Save, Trash2 } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';
import {
  AdminDailyEntry,
  COLLECTIONS,
  JigsawPack,
  JigsawPuzzle,
  adminDeletePack,
  adminDeletePuzzle,
  adminListDaily,
  adminListPacks,
  adminListPuzzles,
  adminSetDaily,
  adminSetPackActive,
  adminSetPuzzleActive,
  adminUpsertPack,
  adminUpsertPuzzle,
  collectionLabel,
} from '@/lib/jigsaw-api';
import JigsawPuzzleUploader, { JigsawPackCoverUploader } from '@/components/admin/JigsawPuzzleUploader';

// Jigsaw catalog admin — packs, the puzzles inside them, and the daily free slot.
//
// The pack is the only priced unit: there is no price column on jigsaw_puzzles
// and no store_items row per puzzle, so "sell one puzzle" has nothing to point
// at. That is why the price form lives in the pack editor and the puzzle grid
// has no price control at all.
//
// Pricing is TWO writes whose order is load-bearing — the store item first,
// then the pack carrying its itemId. jigsaw_packs.item_id is a foreign key onto
// store_items, so pricing a brand-new pack the other way round has nothing to
// reference. Everything else on this page is one RPC.

// Copied verbatim from the other admin pages (lounges, news, broadcast): there
// is no shared UI kit, and at module scope both components below reach it.
const inputCls = 'w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm';

// Sentinel <option> value for "+ New collection…". Deliberately not a legal
// slugify() output — that function emits only [a-z0-9_], so no typed collection
// name can ever collide with this and be mistaken for the sentinel.
const NEW_COLLECTION = '__new__';

// Sentinels for the collection filter. Neither is a legal slugify() output — it
// emits only [a-z0-9_] — so a real collection key can never be mistaken for one.
const FILTER_ANY = '__any__';
const FILTER_NONE = '__none__';

/**
 * The non-collection ways an admin needs to slice the pack list.
 *
 * These deliberately mirror the player's shop chips — the four synthetic ones
 * (sale / unique / popular) plus the two states only an admin can see (draft and
 * free). Matching the player's vocabulary is the point: "which packs does the
 * UNIQUE chip show?" has to be answerable here without translating it into a
 * rarity value first.
 */
type FacetKey = 'all' | 'active' | 'inactive' | 'free' | 'paid' | 'sale' | 'unique' | 'popular';

const FACETS: { key: FacetKey; label: string; hint: string }[] = [
  { key: 'all', label: 'All', hint: 'Every pack, published or not' },
  { key: 'active', label: 'Published', hint: 'Visible to players' },
  { key: 'inactive', label: 'Unpublished', hint: 'Hidden from the shop and shelf; owners keep access' },
  { key: 'free', label: 'Free', hint: 'No store item — free for everyone' },
  { key: 'paid', label: 'Paid', hint: 'Linked to a store item' },
  { key: 'sale', label: 'On sale', hint: "Discounted — the player's SALE chip" },
  { key: 'unique', label: 'Unique', hint: "Legendary rarity — the player's UNIQUE chip" },
  { key: 'popular', label: 'Popular', hint: "metadata.popular is set — the player's POPULAR chip" },
];

/** Whether one pack passes one facet. Mirrors the server's chip SQL. */
function matchesFacet(pack: JigsawPack, facet: FacetKey): boolean {
  switch (facet) {
    case 'active': return pack.isActive;
    case 'inactive': return !pack.isActive;
    case 'free': return pack.isFree;
    case 'paid': return !pack.isFree;
    // Read off the badge the server already computed rather than re-deriving it
    // from price maths here. Two implementations of "is this discounted" drift,
    // and the admin's answer disagreeing with the shop's is the worst outcome.
    case 'sale': return (pack.badges ?? []).includes('sale');
    case 'unique': return pack.rarity === 'legendary';
    case 'popular': return pack.isPopular === true;
    default: return true;
  }
}

// ─── Types ───

type Currency = 'coins' | 'gems' | 'free';

// The pack editor's working copy. currency + amount are flattened out of the
// linked store item because that is how an admin thinks about a pack; saving
// puts them back where they actually live.
type PackDraft = {
  packId: string; // '' until the pack has been created
  slug: string;
  name: string;
  description: string;
  coverUrl: string;
  collection: string;
  itemId: string; // '' = free pack, i.e. no store item grants it
  sortOrder: number;
  isActive: boolean;
  currency: Currency;
  amount: number;
};

// The store_items row that sells a pack (only the fields the price form reads).
type PackStoreItem = {
  itemId: string;
  price?: { coins?: number; gems?: number };
  isActive?: boolean;
};

// ─── Helpers ───

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/**
 * Local calendar date, YYYY-MM-DD. Only ever the date picker's default — the
 * backend owns when the daily puzzle actually rolls over.
 */
function todayISO(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function draftFromPack(pack: JigsawPack, item?: PackStoreItem): PackDraft {
  // The price is read off the store item, not off pack.price: pack.price is the
  // shop's rendered view of that same row and is omitted entirely once a pack is
  // owned, so seeding the form from it would eventually show a paid pack as free.
  const coins = item?.price?.coins ?? 0;
  const gems = item?.price?.gems ?? 0;
  return {
    packId: pack.packItemId,
    slug: pack.slug,
    name: pack.name,
    description: pack.description ?? '',
    coverUrl: pack.coverUrl ?? '',
    collection: pack.collection ?? '',
    itemId: pack.itemId ?? '',
    sortOrder: pack.sortOrder,
    isActive: pack.isActive,
    currency: !pack.itemId ? 'free' : gems > 0 ? 'gems' : 'coins',
    amount: gems > 0 ? gems : coins,
  };
}

function emptyDraft(packs: JigsawPack[]): PackDraft {
  const maxSort = packs.reduce((m, p) => Math.max(m, p.sortOrder), 0);
  return {
    packId: '',
    slug: '',
    name: '',
    description: '',
    coverUrl: '',
    collection: '',
    itemId: '',
    sortOrder: maxSort + 1,
    isActive: true,
    currency: 'coins',
    amount: 500,
  };
}

// ─── Page ───

export default function AdminJigsawPage() {
  const [packs, setPacks] = useState<JigsawPack[]>([]);
  const [packItems, setPackItems] = useState<PackStoreItem[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<PackDraft | null>(null);
  const [puzzles, setPuzzles] = useState<JigsawPuzzle[]>([]);
  const [loading, setLoading] = useState(false);
  const [puzzlesLoading, setPuzzlesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyPuzzleId, setBusyPuzzleId] = useState('');
  const [error, setError] = useState('');
  // null = pick from the dropdown; a string = the admin is typing a new key.
  // '' is a meaningful state here (the box is open but empty), which is why this
  // is not just a boolean paired with a value.
  const [newCollection, setNewCollection] = useState<string | null>(null);
  // The puzzle whose tile is in edit mode, and its working copy. Only ever one
  // at a time: the grid is the read view and edits are committed before moving
  // on, so there is no bulk-save to reconcile.
  const [editingPuzzleId, setEditingPuzzleId] = useState('');
  const [puzzleDraft, setPuzzleDraft] = useState<{ name: string; sortOrder: number }>({ name: '', sortOrder: 0 });
  // Pack list filters. Client-side on purpose: admin_list_packs carries no LIMIT
  // and returns the whole catalogue in one read, so every pack is already here.
  // (The player-facing shop is the opposite — it pages at 24, which is why its
  // chip filter has to be a server parameter.)
  const [filterCollection, setFilterCollection] = useState(FILTER_ANY);
  const [filterFacet, setFilterFacet] = useState<FacetKey>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Two reads, because a pack's price is not on the pack: jigsaw_packs holds
      // only the item_id, and store_items is where the number lives.
      const [packRes, itemRaw] = await Promise.all([
        adminListPacks(),
        callAdminRpc(
          'store/get_items',
          JSON.stringify({
            upgradeType: 'game_upgrade',
            category: 'jigsaw',
            subcategory: 'puzzle_pack',
            includeInactive: true,
            limit: 200,
          }),
        ),
      ]);
      setPacks(packRes.packs ?? []);
      setPackItems(unwrapAdminRpcData<{ items?: PackStoreItem[] }>(itemRaw)?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const loadPuzzles = useCallback(async () => {
    if (!selectedId) {
      setPuzzles([]);
      return;
    }
    setPuzzlesLoading(true);
    try {
      const res = await adminListPuzzles(selectedId);
      setPuzzles(res.puzzles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load puzzles');
    } finally {
      setPuzzlesLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { void loadPuzzles(); }, [loadPuzzles]);

  // Land on a pack once the list arrives and seed the editor from it. Guarded on
  // there being no draft at all, so a reload triggered by a puzzle toggle can
  // never yank the editor onto another pack or overwrite half-typed fields.
  useEffect(() => {
    if (draft || packs.length === 0) return;
    const pack = packs.find((p) => p.packItemId === selectedId) ?? packs[0];
    setSelectedId(pack.packItemId);
    setDraft(draftFromPack(pack, packItems.find((it) => it.itemId === pack.itemId)));
  }, [draft, packItems, packs, selectedId]);

  const updateDraft = (patch: Partial<PackDraft>) =>
    setDraft((cur) => (cur ? { ...cur, ...patch } : cur));

  // Both entry points clear the half-typed collection box and any open puzzle
  // edit: leaving them mounted would carry a draft from the pack being left onto
  // the pack being opened.
  const selectPack = (pack: JigsawPack) => {
    setSelectedId(pack.packItemId);
    setDraft(draftFromPack(pack, packItems.find((it) => it.itemId === pack.itemId)));
    setNewCollection(null);
    setEditingPuzzleId('');
  };

  const newPack = () => {
    setSelectedId('');
    setDraft(emptyDraft(packs));
    setNewCollection(null);
    setEditingPuzzleId('');
  };

  /**
   * File the open pack under a newly minted collection key.
   *
   * Nothing is written here: a collection has no table of its own, so it exists
   * precisely when some pack carries its key. This only fills the draft — the
   * key is created by saving the pack, and abandoning the editor invents nothing.
   */
  const commitNewCollection = () => {
    const key = slugify(newCollection ?? '');
    if (!key) { setNewCollection(null); return; }
    updateDraft({ collection: key });
    setNewCollection(null);
  };

  /**
   * Re-file every pack on `from` onto `to`.
   *
   * A rename is a bulk edit rather than a single write for the same reason:
   * the key lives in a column on each pack, so the collection *is* its members.
   * Sequential on purpose — the lists are short, and one failure part-way leaves
   * a legible half-moved state rather than an unordered scatter of failures.
   */
  const renameCollection = async (from: string, to: string) => {
    const key = slugify(to);
    if (!key || key === from) return;
    const affected = packs.filter((p) => (p.collection ?? '') === from);
    setSaving(true);
    setError('');
    try {
      for (const pack of affected) {
        // slug is required by the RPC and is what identifies the row on the
        // update path, so it is echoed back unchanged. Every other field is left
        // undefined: this is a PATCH and must not touch a price or a cover.
        await adminUpsertPack({ packId: pack.packItemId, slug: pack.slug, collection: key });
      }
      if (draft && draft.collection === from) updateDraft({ collection: key });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename collection');
    } finally {
      setSaving(false);
    }
  };

  const startEditPuzzle = (puzzle: JigsawPuzzle) => {
    setEditingPuzzleId(puzzle.puzzleId);
    setPuzzleDraft({ name: puzzle.name || puzzle.slug || '', sortOrder: puzzle.sortOrder });
  };

  /**
   * Rename / re-order one puzzle.
   *
   * The slug is echoed back rather than re-derived from the new name. It is the
   * key the uploader matches on when the same filename is dropped again, so
   * renaming "Img 1" to "Cable Car Bay" must not repoint that match — otherwise
   * re-uploading the original file would fork a second row instead of replacing
   * the art on this one.
   */
  const savePuzzleEdit = async (puzzle: JigsawPuzzle) => {
    if (!draft?.packId) return;
    const name = puzzleDraft.name.trim();
    if (!name) { setError('Puzzle name is required.'); return; }
    setBusyPuzzleId(puzzle.puzzleId);
    setError('');
    try {
      await adminUpsertPuzzle({
        puzzleId: puzzle.puzzleId,
        slug: puzzle.slug || slugify(name),
        packId: draft.packId,
        name,
        sortOrder: puzzleDraft.sortOrder,
      });
      setEditingPuzzleId('');
      await loadPuzzles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save puzzle');
    } finally {
      setBusyPuzzleId('');
    }
  };

  const savePack = async () => {
    if (!draft) return;
    const slug = slugify(draft.slug || draft.name);
    if (!slug) { setError('Pack slug is required.'); return; }
    if (!draft.name.trim()) { setError('Pack name is required.'); return; }
    // A priced pack at 0 is free but still gated behind a purchase. This is also
    // the guard that stops a pack whose store item failed to load from being
    // saved back at zero.
    if (draft.currency !== 'free' && draft.amount <= 0) {
      setError('A priced pack needs an amount above zero — pick Free to give it away.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let itemId = draft.itemId;
      if (draft.currency === 'free') {
        // '' clears the link and makes the pack free. The store row itself is
        // left alone: 38 foreign keys point at store_items and the item may sit
        // in a bundle or a deal, so unlinking is the reversible half of "stop
        // selling this".
        itemId = '';
      } else {
        const coins = draft.currency === 'coins' ? draft.amount : 0;
        const gems = draft.currency === 'gems' ? draft.amount : 0;
        if (itemId) {
          // admin_update_item is pointer-per-field, so only what is sent is
          // written. It deliberately does not accept slug — renaming a pack never
          // renames jigsaw_pack_<slug>, and the item keeps the identity key every
          // purchase row already references.
          await callAdminRpc('store/admin_update_item', JSON.stringify({
            itemId,
            name: draft.name.trim(),
            description: draft.description,
            previewUrl: draft.coverUrl,
            price: { coins, gems },
            isActive: draft.isActive,
          }));
        } else {
          const raw = await callAdminRpc('store/admin_add_item', JSON.stringify({
            itemId: crypto.randomUUID(),
            slug: `jigsaw_pack_${slug}`,
            name: draft.name.trim(),
            description: draft.description,
            previewUrl: draft.coverUrl,
            upgradeType: 'game_upgrade',
            category: 'jigsaw',
            gameId: 'jigsaw',
            subcategory: 'puzzle_pack',
            type: 'puzzle_pack',
            price: { coins, gems },
            isActive: draft.isActive,
            stock: -1,
            metadata: { purchaseLimit: '1' },
          }));
          // admin_add_item upserts on slug and answers with the row's REAL
          // item_id, so a pack that was made free and is priced again re-attaches
          // to the same store_items row instead of dying on UNIQUE(slug). Which
          // is exactly why the returned id — never the one generated above — is
          // what gets written onto the pack.
          const added = unwrapAdminRpcData<{ itemId?: string }>(raw);
          if (!added?.itemId) throw new Error('Store item was created but returned no itemId');
          itemId = added.itemId;
        }
      }

      const res = await adminUpsertPack({
        ...(draft.packId ? { packId: draft.packId } : {}),
        slug,
        name: draft.name.trim(),
        description: draft.description,
        coverUrl: draft.coverUrl,
        collection: draft.collection,
        itemId,
        sortOrder: draft.sortOrder,
        isActive: draft.isActive,
      });
      // Keep what the admin typed and adopt the ids the server assigned: a create
      // only learns its packId here, and the slug comes back normalised.
      setSelectedId(res.pack.packItemId);
      setDraft({ ...draft, packId: res.pack.packItemId, slug: res.pack.slug, itemId });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the pack');
    } finally {
      setSaving(false);
    }
  };

  const togglePackActive = async () => {
    if (!draft?.packId) return;
    const next = !draft.isActive;
    setSaving(true);
    setError('');
    try {
      await adminSetPackActive(draft.packId, next);
      // Keep the store row in step. The jigsaw shop reads jigsaw_packs and would
      // hide it either way, but store/get_items does not — an inactive pack whose
      // item is still published stays buyable from the generic shop surfaces.
      if (draft.itemId) {
        await callAdminRpc(
          next ? 'store/admin_restore_item' : 'store/admin_unpublish_item',
          JSON.stringify({ itemId: draft.itemId }),
        );
      }
      updateDraft({ isActive: next });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle the pack');
    } finally {
      setSaving(false);
    }
  };

  const deletePack = async () => {
    if (!draft?.packId) return;
    if (!window.confirm(
      `Delete ${draft.name || draft.slug} permanently? Its puzzles and every in-progress board on them go with it. Deactivate instead if anyone may be mid-puzzle.`,
    )) return;
    setSaving(true);
    setError('');
    try {
      await adminDeletePack(draft.packId);
      setSelectedId('');
      setDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the pack');
    } finally {
      setSaving(false);
    }
  };

  const togglePuzzleFree = async (puzzle: JigsawPuzzle) => {
    setBusyPuzzleId(puzzle.puzzleId);
    setError('');
    try {
      // slug and packId ride along on every puzzle upsert, one-field edits
      // included: they are the row's identity, and the admin list carries both.
      await adminUpsertPuzzle({
        puzzleId: puzzle.puzzleId,
        slug: puzzle.slug ?? '',
        packId: selectedId,
        isFree: !puzzle.isFree,
      });
      await loadPuzzles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change the sampler flag');
    } finally {
      setBusyPuzzleId('');
    }
  };

  const togglePuzzleActive = async (puzzle: JigsawPuzzle) => {
    setBusyPuzzleId(puzzle.puzzleId);
    setError('');
    try {
      await adminSetPuzzleActive(puzzle.puzzleId, !puzzle.isActive);
      await loadPuzzles();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change the puzzle state');
    } finally {
      setBusyPuzzleId('');
    }
  };

  const deletePuzzle = async (puzzle: JigsawPuzzle) => {
    if (!window.confirm(
      `Delete ${puzzle.name || puzzle.slug} permanently? Every board a player has started on it is deleted too. Unpublish instead to take it off the grid.`,
    )) return;
    setBusyPuzzleId(puzzle.puzzleId);
    setError('');
    try {
      await adminDeletePuzzle(puzzle.puzzleId);
      await loadPuzzles();
      // The pack tab shows a puzzle count, and it is now one too high.
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete the puzzle');
    } finally {
      setBusyPuzzleId('');
    }
  };

  // A pack may hold a collection key this build has never heard of — the column
  // is free text, and the editor can now mint new keys. Render every key in use
  // rather than snapping the pack onto the first curated one, which would
  // silently re-file it on the next save.
  //
  // Sourced from every pack, not just the open draft: a key invented while
  // editing pack A has to be offered to pack B, or the second pack in a new
  // collection can only be filed by typing the key a second time and any typo
  // forks the collection in two.
  const collectionKeys: string[] = [...COLLECTIONS];
  for (const key of packs.map((p) => p.collection ?? '')) {
    if (key && !collectionKeys.includes(key)) collectionKeys.push(key);
  }
  if (draft?.collection && !collectionKeys.includes(draft.collection)) collectionKeys.push(draft.collection);

  const q = query.trim().toLowerCase();
  const visiblePacks = packs.filter((pack) => {
    if (filterCollection === FILTER_NONE && (pack.collection ?? '')) return false;
    if (filterCollection !== FILTER_ANY && filterCollection !== FILTER_NONE
        && (pack.collection ?? '') !== filterCollection) return false;
    if (!matchesFacet(pack, filterFacet)) return false;
    if (q && !`${pack.name} ${pack.slug}`.toLowerCase().includes(q)) return false;
    return true;
  });
  // Counted over `packs`, never `visiblePacks`: a facet count that shrank as you
  // narrowed the collection would make the numbers unreadable — you could never
  // tell whether "Popular 0" meant no popular packs or none in this collection.
  const facetCount = (key: FacetKey) => packs.filter((p) => matchesFacet(p, key)).length;
  const collectionCount = (key: string) =>
    key === FILTER_NONE
      ? packs.filter((p) => !(p.collection ?? '')).length
      : packs.filter((p) => (p.collection ?? '') === key).length;
  const filtered = visiblePacks.length !== packs.length;
  // The open pack can sit outside the current filter — selecting it and then
  // narrowing shouldn't slam the editor shut on unsaved edits.
  const selectedHidden = !!draft?.packId && !visiblePacks.some((p) => p.packItemId === draft.packId);

  const linkedItem = draft?.itemId ? packItems.find((it) => it.itemId === draft.itemId) : undefined;
  const packSlug = draft ? slugify(draft.slug || draft.name) : '';

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Puzzle className="w-5 h-5" /> Jigsaw Puzzles
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Packs are what players buy; the puzzles inside them are never priced separately. An inactive pack disappears from the shop and the shelf, but everyone who already owns it keeps playing it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { void load(); void loadPuzzles(); }}
          disabled={loading}
          className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Filters. Mirrors the player's chip row so "what does the shop show
          under MYSTERY?" is answerable here without translating anything. */}
      {packs.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Collection
            </span>
            <select
              value={filterCollection}
              onChange={(e) => setFilterCollection(e.target.value)}
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-xs"
            >
              <option value={FILTER_ANY}>Any ({packs.length})</option>
              {collectionKeys
                .filter((key) => collectionCount(key) > 0)
                .map((key) => (
                  <option key={key} value={key}>{collectionLabel(key)} ({collectionCount(key)})</option>
                ))}
              <option value={FILTER_NONE}>No collection ({collectionCount(FILTER_NONE)})</option>
            </select>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or slug…"
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-xs flex-1 min-w-[10rem]"
            />

            {filtered && (
              <button
                type="button"
                onClick={() => { setFilterCollection(FILTER_ANY); setFilterFacet('all'); setQuery(''); }}
                className="px-2 py-1 rounded-lg bg-slate-700 text-slate-200 text-xs hover:bg-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            {FACETS.map(({ key, label, hint }) => {
              const n = facetCount(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterFacet(key)}
                  title={hint}
                  disabled={n === 0 && key !== 'all'}
                  className={`px-2 py-1 rounded text-[11px] ${
                    filterFacet === key ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {label} <span className="opacity-70">{n}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[11px] text-slate-400">
            Showing <strong className="text-slate-200">{visiblePacks.length}</strong> of {packs.length} packs
            {visiblePacks.length > 0 && (
              <> · {visiblePacks.reduce((n, p) => n + p.puzzleCount, 0)} puzzles</>
            )}
            {selectedHidden && (
              <span className="text-amber-400"> · the open pack is outside this filter</span>
            )}
          </p>
        </div>
      )}

      {/* Pack selector */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400">Pack</span>
        {visiblePacks.length === 0 && packs.length > 0 && (
          <span className="text-xs text-slate-500">No pack matches this filter.</span>
        )}
        {visiblePacks.map((pack) => (
          <button
            key={pack.packItemId}
            type="button"
            onClick={() => selectPack(pack)}
            title={pack.isActive ? undefined : 'Inactive — hidden from players'}
            className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 ${
              selectedId === pack.packItemId ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            } ${pack.isActive ? '' : 'opacity-60'}`}
          >
            {pack.name || pack.slug}
            <span className="text-[11px] opacity-70">{pack.puzzleCount}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={newPack}
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 ${
            draft && !draft.packId ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
          }`}
        >
          <Plus className="w-4 h-4" /> New pack
        </button>
      </div>

      {loading && packs.length === 0 && <p className="text-xs text-slate-400">Loading packs…</p>}
      {!loading && packs.length === 0 && !draft && <p className="text-xs text-slate-400">No packs yet — create the first one.</p>}

      {/* Pack editor */}
      {draft && (
        <div className={`p-4 rounded-xl bg-slate-800 border space-y-3 ${draft.isActive ? 'border-slate-700' : 'border-red-900/60'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
            {/* Cover */}
            <div className="lg:col-span-3 space-y-2">
              {draft.coverUrl ? (
                // Plain <img>: the R2 host is not in next.config images.remotePatterns.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.coverUrl} alt={draft.name || 'Pack cover'} className="w-full aspect-video object-cover rounded-md border border-slate-600" />
              ) : (
                <div className="w-full aspect-video rounded-md border border-dashed border-slate-600 flex items-center justify-center text-slate-500 text-xs">
                  No cover
                </div>
              )}
              <JigsawPackCoverUploader packSlug={packSlug} onUploaded={(url) => updateDraft({ coverUrl: url })} />
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Cover URL</label>
                <input value={draft.coverUrl} onChange={(e) => updateDraft({ coverUrl: e.target.value })} placeholder="https://…" className={inputCls} />
              </div>
            </div>

            {/* Identity */}
            <div className="lg:col-span-5 space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Name</label>
                <input value={draft.name} onChange={(e) => updateDraft({ name: e.target.value })} placeholder="e.g. Autumn Roads" className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Slug</label>
                <input value={draft.slug} onChange={(e) => updateDraft({ slug: e.target.value })} placeholder="autumn_roads" className={inputCls} />
                <p className="text-[11px] text-slate-500 mt-1">
                  Normalised on save. It names the R2 folder covers and puzzle images land in, and seeds the store item slug — renaming it later moves neither.
                </p>
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Description</label>
                <input value={draft.description} onChange={(e) => updateDraft({ description: e.target.value })} placeholder="Short blurb shown on the pack tile" className={inputCls} />
              </div>
            </div>

            {/* Shelf + price */}
            <div className="lg:col-span-4 space-y-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Collection</label>
                {newCollection === null ? (
                  <select
                    value={draft.collection}
                    onChange={(e) => {
                      // The sentinel is not a key. It swaps the select for a text
                      // box; nothing is filed until that box is committed.
                      if (e.target.value === NEW_COLLECTION) setNewCollection('');
                      else updateDraft({ collection: e.target.value });
                    }}
                    className={inputCls}
                  >
                    <option value="">No collection</option>
                    {collectionKeys.map((key) => (
                      <option key={key} value={key}>{collectionLabel(key)}</option>
                    ))}
                    <option value={NEW_COLLECTION}>+ New collection…</option>
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={newCollection}
                      onChange={(e) => setNewCollection(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); commitNewCollection(); }
                        if (e.key === 'Escape') setNewCollection(null);
                      }}
                      placeholder="e.g. Winter Nights"
                      className={inputCls}
                    />
                    <button
                      type="button"
                      onClick={commitNewCollection}
                      className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 shrink-0"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewCollection(null)}
                      className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 shrink-0"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {/* The key is what every other pack must match to land on the same
                    shelf, so show it rather than leaving the admin to guess how
                    their typing was slugified. */}
                {newCollection !== null && slugify(newCollection) ? (
                  <p className="text-[10px] text-slate-500 mt-1">key: {slugify(newCollection)}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Sort order</label>
                <input type="number" value={draft.sortOrder} onChange={(e) => updateDraft({ sortOrder: parseInt(e.target.value, 10) || 0 })} className={inputCls} />
              </div>
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Price</label>
                <div className="flex gap-2">
                  <select value={draft.currency} onChange={(e) => updateDraft({ currency: e.target.value as Currency })} className={inputCls}>
                    <option value="coins">Coins</option>
                    <option value="gems">Gems</option>
                    <option value="free">Free</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={draft.amount}
                    disabled={draft.currency === 'free'}
                    onChange={(e) => updateDraft({ amount: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                    className={`${inputCls} disabled:opacity-50`}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  One currency per pack. Free unlinks the store item and leaves it in place, so picking a currency again re-attaches the same row at the new price.
                </p>
                {draft.itemId && !linkedItem && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    Linked store item is not in the jigsaw catalog, so its price could not be read — the amount above is a guess until you set it.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void savePack()}
              disabled={saving}
              className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 flex items-center gap-1"
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : draft.packId ? 'Save pack' : 'Create pack'}
            </button>
            {draft.packId ? (
              <>
                <button
                  type="button"
                  onClick={() => void togglePackActive()}
                  disabled={saving}
                  title={draft.isActive ? 'Deactivate (hide from the shop and the shelf)' : 'Activate (show to players)'}
                  className={`px-3 py-2 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1 ${
                    draft.isActive ? 'bg-green-900/50 text-green-300 hover:bg-green-900' : 'bg-red-900/60 text-red-200 hover:bg-red-900'
                  }`}
                >
                  <Power className="w-4 h-4" /> {draft.isActive ? 'Active' : 'Inactive'}
                </button>
                <button
                  type="button"
                  onClick={() => void deletePack()}
                  disabled={saving}
                  title="Delete the pack, its puzzles, and every board started on them"
                  className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900 disabled:opacity-50 flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setDraft(null)}
                title="Discard this unsaved pack"
                className="px-3 py-2 rounded-lg bg-red-900/60 text-red-200 text-sm hover:bg-red-900 flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" /> Discard
              </button>
            )}
          </div>

          {draft.packId && (
            <p className="text-[11px] text-slate-500">
              pack: {draft.packId}
              {draft.itemId ? ` · store item: ${draft.itemId}` : ' · free (no store item)'}
            </p>
          )}
        </div>
      )}

      {/* Puzzles in the selected pack */}
      {draft?.packId && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-100">
              Puzzles <span className="text-slate-500">({puzzles.length})</span>
            </h2>
            <JigsawPuzzleUploader packId={draft.packId} packSlug={draft.slug} existing={puzzles} onUploaded={() => void loadPuzzles()} />
          </div>

          {puzzles.length === 0 ? (
            <p className="text-xs text-slate-400 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
              {puzzlesLoading ? 'Loading puzzles…' : 'No puzzles in this pack yet — add some images above.'}
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {puzzles.map((puzzle) => (
                <div
                  key={puzzle.puzzleId}
                  className={`rounded-lg bg-slate-800 border overflow-hidden flex flex-col ${puzzle.isActive ? 'border-slate-700' : 'border-red-900/60'}`}
                >
                  <div className="aspect-video bg-slate-900 flex items-center justify-center">
                    {puzzle.thumbUrl || puzzle.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={puzzle.thumbUrl || puzzle.previewUrl} alt={puzzle.name} className="max-w-full max-h-full object-contain" />
                    ) : (
                      <span className="text-xs text-slate-600">no image</span>
                    )}
                  </div>
                  <div className="p-2 space-y-1 flex-1">
                    {editingPuzzleId === puzzle.puzzleId ? (
                      <div className="space-y-1.5">
                        <input
                          autoFocus
                          value={puzzleDraft.name}
                          onChange={(e) => setPuzzleDraft((d) => ({ ...d, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); void savePuzzleEdit(puzzle); }
                            if (e.key === 'Escape') setEditingPuzzleId('');
                          }}
                          placeholder="Puzzle name"
                          className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs"
                        />
                        <label className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          Order
                          <input
                            type="number"
                            value={puzzleDraft.sortOrder}
                            onChange={(e) => setPuzzleDraft((d) => ({ ...d, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                            className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs"
                          />
                        </label>
                        {/* The slug is the uploader's match key, so it is shown but
                            never edited here — see savePuzzleEdit. */}
                        <p className="text-[10px] text-slate-500 truncate" title={puzzle.slug}>slug: {puzzle.slug}</p>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-slate-100 truncate" title={puzzle.name}>{puzzle.name || puzzle.slug}</p>
                    )}
                    {puzzle.imageWidth && puzzle.imageHeight ? (
                      <p className="text-[10px] text-slate-400">{puzzle.imageWidth} × {puzzle.imageHeight}</p>
                    ) : (
                      // The legal piece counts are derived from the aspect ratio, so
                      // a 0x0 puzzle ships a wrong slider to everyone who opens it.
                      // Re-uploading the image is the only fix.
                      <p className="text-[10px] text-red-400">no dimensions — the piece-count slider will be wrong</p>
                    )}
                    {puzzle.isFree && <p className="text-[10px] text-emerald-400">free sampler</p>}
                    {!puzzle.isActive && <p className="text-[10px] text-amber-400">unpublished</p>}
                  </div>
                  {editingPuzzleId === puzzle.puzzleId ? (
                    <div className="p-2 pt-0 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void savePuzzleEdit(puzzle)}
                        disabled={busyPuzzleId === puzzle.puzzleId}
                        className="flex-1 px-2 py-1 rounded text-[11px] bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {busyPuzzleId === puzzle.puzzleId ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingPuzzleId('')}
                        disabled={busyPuzzleId === puzzle.puzzleId}
                        className="flex-1 px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="p-2 pt-0 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => void togglePuzzleFree(puzzle)}
                        disabled={busyPuzzleId === puzzle.puzzleId}
                        title={puzzle.isFree ? 'Playable without owning the pack' : 'Needs the pack'}
                        className="flex-1 px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                      >
                        {busyPuzzleId === puzzle.puzzleId ? '…' : puzzle.isFree ? 'Free' : 'Locked'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePuzzleActive(puzzle)}
                        disabled={busyPuzzleId === puzzle.puzzleId}
                        className="flex-1 px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                      >
                        {busyPuzzleId === puzzle.puzzleId ? '…' : puzzle.isActive ? 'Unpublish' : 'Restore'}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditPuzzle(puzzle)}
                        disabled={busyPuzzleId === puzzle.puzzleId}
                        title="Rename this puzzle or change its order in the pack"
                        className="px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePuzzle(puzzle)}
                        disabled={busyPuzzleId === puzzle.puzzleId}
                        title="Delete the puzzle and every board started on it"
                        className="px-2 py-1 rounded text-[11px] bg-red-900/60 text-red-200 hover:bg-red-900 disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <CollectionManager packs={packs} busy={saving} onRename={renameCollection} />

      <DailySchedule puzzles={puzzles} />

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}

// ─── Collections ───

/**
 * Rename a collection across every pack filed under it.
 *
 * There is no collections table: `jigsaw_packs.collection` is a free-text
 * column, so a collection exists exactly as long as some pack names it and
 * renaming one means rewriting all of its members. That also makes the empty
 * state honest — a collection with no packs is not "empty", it is gone, which
 * is why this lists what is in use rather than the curated key list.
 *
 * Creating a collection is deliberately NOT here. A new key with no pack on it
 * would vanish on reload, so the only place it can be minted is the pack editor,
 * where a pack is there to carry it.
 */
function CollectionManager({
  packs,
  busy,
  onRename,
}: {
  packs: JigsawPack[];
  busy: boolean;
  onRename: (from: string, to: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState('');
  const [value, setValue] = useState('');

  // Key → pack count, in first-seen order. Packs with no collection are counted
  // separately below rather than filed under '': "unfiled" is not a shelf and
  // must not be renamable into one.
  const counts = new Map<string, number>();
  for (const pack of packs) {
    const key = pack.collection ?? '';
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const unfiled = packs.filter((p) => !(p.collection ?? '')).length;

  const commit = async (from: string) => {
    const next = slugify(value);
    if (!next || next === from) { setEditing(''); return; }
    await onRename(from, next);
    setEditing('');
  };

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <FolderTree className="w-4 h-4" /> Collections
        </h2>
        <p className="text-[11px] text-slate-400 mt-1">
          The shop&apos;s filter chips. A collection is just a tag every pack in it carries, so renaming one re-files all of its packs and a collection with no packs left stops existing. Add one from a pack&apos;s Collection field.
        </p>
      </div>

      {counts.size === 0 ? (
        <p className="text-xs text-slate-400">No collections in use yet.</p>
      ) : (
        <div className="space-y-1.5">
          {[...counts.entries()].map(([key, count]) => (
            <div key={key} className="flex items-center gap-2 flex-wrap">
              {editing === key ? (
                <>
                  <input
                    autoFocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void commit(key); }
                      if (e.key === 'Escape') setEditing('');
                    }}
                    className="px-2 py-1 rounded bg-slate-900 border border-slate-600 text-slate-100 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => void commit(key)}
                    disabled={busy}
                    className="px-2 py-1 rounded text-[11px] bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : `Rename ${count} pack${count === 1 ? '' : 's'}`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing('')}
                    disabled={busy}
                    className="px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  {slugify(value) && slugify(value) !== key ? (
                    <span className="text-[10px] text-slate-500">key: {slugify(value)}</span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="text-xs text-slate-100">{collectionLabel(key)}</span>
                  <span className="text-[10px] text-slate-500">{key}</span>
                  <span className="text-[10px] text-slate-400">
                    {count} pack{count === 1 ? '' : 's'}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setEditing(key); setValue(collectionLabel(key)); }}
                    disabled={busy}
                    title="Rename this collection and re-file every pack in it"
                    className="px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-200 hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" /> Rename
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {unfiled > 0 && (
        <p className="text-[11px] text-slate-500">
          {unfiled} pack{unfiled === 1 ? '' : 's'} with no collection.
        </p>
      )}
    </div>
  );
}

// ─── Daily free puzzle ───

/**
 * The daily schedule: one puzzle per calendar date, playable whether or not its
 * pack is owned. Scheduling from a pack nobody owns is the point rather than a
 * mistake — it is the game's main shop window.
 *
 * The picker lists the puzzles of the pack selected above, which is the only
 * puzzle list this page has loaded.
 */
function DailySchedule({ puzzles }: { puzzles: JigsawPuzzle[] }) {
  const [entries, setEntries] = useState<AdminDailyEntry[]>([]);
  const [playDate, setPlayDate] = useState(todayISO());
  const [puzzleId, setPuzzleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminListDaily();
      setEntries(res.entries ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the daily schedule');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Selecting another pack leaves behind a puzzle id that is no longer on offer.
  // Deriving the value rather than storing it keeps the dropdown and the write
  // agreeing, instead of the select reading blank while the button schedules the
  // puzzle from the pack before it.
  const chosen = puzzles.some((p) => p.puzzleId === puzzleId) ? puzzleId : '';
  const taken = entries.find((e) => e.playDate === playDate);

  const schedule = async () => {
    if (!playDate) { setError('Pick a date.'); return; }
    if (!chosen) { setError('Pick a puzzle to schedule.'); return; }
    setSaving(true);
    setError('');
    try {
      await adminSetDaily({ playDate, puzzleId: chosen });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to schedule the daily puzzle');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-slate-800 border border-slate-700 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> Daily free puzzle
        </h2>
        <p className="text-[11px] text-slate-400 mt-1">
          One puzzle per date, free to everyone that day whether or not they own its pack. An empty date is a missing shop window, not a cosmetic gap. The picker lists the puzzles of the pack selected above.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="w-44">
          <label className="block text-[11px] text-slate-400 mb-1">Date</label>
          <input type="date" value={playDate} onChange={(e) => setPlayDate(e.target.value)} className={inputCls} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] text-slate-400 mb-1">Puzzle</label>
          <select value={chosen} onChange={(e) => setPuzzleId(e.target.value)} className={inputCls}>
            <option value="">Select a puzzle…</option>
            {puzzles.map((p) => (
              <option key={p.puzzleId} value={p.puzzleId}>{p.name || p.slug}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void schedule()}
          disabled={saving || !chosen}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? 'Scheduling…' : 'Schedule'}
        </button>
      </div>

      {taken && (
        <p className="text-[11px] text-amber-400">
          {playDate} already runs {taken.puzzleName || taken.puzzleId} — scheduling reassigns the date.
        </p>
      )}

      {loading && entries.length === 0 && <p className="text-xs text-slate-400">Loading schedule…</p>}
      {!loading && entries.length === 0 && <p className="text-xs text-slate-400">Nothing scheduled yet.</p>}

      {entries.length > 0 && (
        <div className="space-y-1">
          {entries.map((entry) => (
            <div key={entry.playDate} className="flex items-center gap-2 text-xs text-slate-300">
              {entry.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.thumbUrl} alt={entry.puzzleName || entry.playDate} className="w-8 h-8 rounded object-cover border border-slate-700" />
              ) : (
                <div className="w-8 h-8 rounded border border-dashed border-slate-600" />
              )}
              <span className="font-mono text-slate-400">{entry.playDate}</span>
              <span className="truncate">{entry.puzzleName || entry.puzzleId}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  );
}
