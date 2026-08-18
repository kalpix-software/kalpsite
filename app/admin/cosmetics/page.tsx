'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Shapes } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';
import TeroBackgroundUploader from '@/components/admin/TeroBackgroundUploader';
import DeckVariantUploader from '@/components/admin/DeckVariantUploader';
import ChessCosmeticUploader from '@/components/admin/ChessCosmeticUploader';

// One entry point for every game's purchasable cosmetics: pick a game, pick a
// cosmetic type, upload, and see what already exists.
//
// Every cosmetic is an ordinary `game_upgrade` store_item tagged to its game, so
// pricing, bundles, deals and the shop need no per-game handling. What differs
// per type is the CONTRACT the backend reads, which is why the uploaders stay
// separate components rather than becoming one generic form:
//
//   tero / background  → metadata.assetUrl + metadata.mediaType   (video or image)
//   tero / card_decks  → sprite+atlas rebuilt from the variant slug alone
//   chess / pieces     → metadata.baseUrl, a folder of 12 FEN-named sprites
//   chess / board      → metadata.assetUrl
//   chess / background → metadata.assetUrl
//
// A generic "upload a file, set a price" form cannot satisfy those at once —
// that is exactly how backgrounds without an assetUrl got created.

type GameRow = { gameId: string; slug: string; name: string };

type ShopLabel = {
  gameSlug: string;
  subcategoryKey: string;
  displayName: string;
  sortOrder: number;
};

type StoreItemRow = {
  itemId: string;
  slug?: string;
  name: string;
  description?: string;
  previewUrl?: string;
  subcategory?: string;
  type?: string;
  isActive?: boolean;
  price?: { coins?: number; gems?: number };
  metadata?: Record<string, string>;
};

/** What each game sells, and which contract the backend expects for it. */
type CosmeticKind = {
  key: string;
  label: string;
  /** Which metadata field must be present for the item to actually render. */
  requires?: 'assetUrl' | 'baseUrl';
  note: string;
};

const COSMETICS_BY_GAME: Record<string, CosmeticKind[]> = {
  tero: [
    {
      key: 'background',
      label: 'Table Backgrounds',
      requires: 'assetUrl',
      note: 'Video or image behind the table. Per-viewer — only the owner sees their own.',
    },
    {
      key: 'card_decks',
      label: 'Card Decks',
      note: 'One folder per variant. The sheet + atlas are rebuilt from the variant slug, so no assetUrl is stored.',
    },
  ],
  chess: [
    {
      key: 'pieces',
      label: 'Piece Sets',
      requires: 'baseUrl',
      note: 'All 12 FEN-named sprites become ONE item. Visible to your opponent.',
    },
    { key: 'board', label: 'Boards', requires: 'assetUrl', note: 'One item per file. Only you see it.' },
    { key: 'background', label: 'Backgrounds', requires: 'assetUrl', note: 'The surface around the board. Only you see it.' },
  ],
};

export default function CosmeticsPage() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [gameSlug, setGameSlug] = useState('');
  const [kindKey, setKindKey] = useState('');
  const [items, setItems] = useState<StoreItemRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [labels, setLabels] = useState<ShopLabel[]>([]);
  const [labelDraft, setLabelDraft] = useState<{ name: string; order: number } | null>(null);
  const [savingLabel, setSavingLabel] = useState(false);

  // Memoised so the `?? []` fallback doesn't mint a new array identity on every
  // render and re-run everything that depends on it.
  const kinds = useMemo(() => COSMETICS_BY_GAME[gameSlug] ?? [], [gameSlug]);
  const kind = useMemo(() => kinds.find((k) => k.key === kindKey), [kinds, kindKey]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await callAdminRpc('game/admin_list_games', '{}');
        const data = unwrapAdminRpcData<{ games?: GameRow[] }>(raw);
        const rows = (data?.games ?? []).filter((g) => COSMETICS_BY_GAME[g.slug]);
        setGames(rows);
        if (rows.length > 0 && !gameSlug) {
          setGameSlug(rows[0].slug);
          setKindKey(COSMETICS_BY_GAME[rows[0].slug][0].key);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load games');
      }
    })();
    // Runs once: this seeds the initial selection only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    if (!gameSlug || !kindKey) return;
    setLoading(true);
    setError('');
    try {
      const raw = await callAdminRpc(
        'store/get_items',
        JSON.stringify({ upgradeType: 'game_upgrade', category: gameSlug, includeInactive: true, limit: 200 }),
      );
      const data = unwrapAdminRpcData<{ items?: StoreItemRow[] }>(raw);
      setItems((data?.items ?? []).filter((it) => (it.subcategory ?? it.type) === kindKey));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [gameSlug, kindKey]);

  useEffect(() => { void load(); }, [load]);

  const loadLabels = useCallback(async () => {
    try {
      const raw = await callAdminRpc('game/admin_list_shop_labels', '{}');
      const data = unwrapAdminRpcData<{ labels?: ShopLabel[] }>(raw);
      setLabels(data?.labels ?? []);
    } catch {
      // A missing label just falls back to the built-in name, so this is not
      // worth blocking the page over.
      setLabels([]);
    }
  }, []);

  useEffect(() => { void loadLabels(); }, [loadLabels]);

  const currentLabel = useMemo(
    () => labels.find((l) => l.gameSlug === gameSlug && l.subcategoryKey === kindKey),
    [labels, gameSlug, kindKey],
  );

  // Re-seed the draft whenever the selection changes, so switching tabs never
  // carries a half-typed name onto a different subcategory.
  useEffect(() => {
    setLabelDraft(
      currentLabel
        ? { name: currentLabel.displayName, order: currentLabel.sortOrder }
        : { name: '', order: 0 },
    );
  }, [currentLabel, gameSlug, kindKey]);

  async function saveLabel() {
    if (!labelDraft || !gameSlug || !kindKey) return;
    setSavingLabel(true);
    setError('');
    try {
      await callAdminRpc(
        'game/admin_upsert_shop_label',
        JSON.stringify({
          gameSlug,
          subcategoryKey: kindKey,
          displayName: labelDraft.name.trim(),
          sortOrder: labelDraft.order,
        }),
      );
      await loadLabels();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the tab name');
    } finally {
      setSavingLabel(false);
    }
  }

  async function resetLabel() {
    if (!gameSlug || !kindKey) return;
    setSavingLabel(true);
    setError('');
    try {
      await callAdminRpc(
        'game/admin_delete_shop_label',
        JSON.stringify({ gameSlug, subcategoryKey: kindKey }),
      );
      await loadLabels();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset the tab name');
    } finally {
      setSavingLabel(false);
    }
  }

  async function toggleActive(it: StoreItemRow) {
    setBusyId(it.itemId);
    setError('');
    try {
      // unpublish takes it off every shop surface while existing owners keep it
      // equipped; restore puts it back. Neither deletes anything.
      await callAdminRpc(
        it.isActive === false ? 'store/admin_restore_item' : 'store/admin_unpublish_item',
        JSON.stringify({ itemId: it.itemId }),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change item state');
    } finally {
      setBusyId('');
    }
  }

  const broken = items.filter((it) => kind?.requires && !it.metadata?.[kind.requires]);

  function renderUploader() {
    if (gameSlug === 'tero' && kindKey === 'background') return <TeroBackgroundUploader onUploaded={() => void load()} />;
    if (gameSlug === 'tero' && kindKey === 'card_decks') return <DeckVariantUploader onUploaded={() => void load()} />;
    if (gameSlug === 'chess') return <ChessCosmeticUploader onUploaded={() => void load()} />;
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shapes className="w-6 h-6 text-sky-400" />
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Game Cosmetics</h1>
            <p className="text-xs text-slate-400">
              Upload and manage every purchasable cosmetic, per game.
            </p>
          </div>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-slate-400">Game</span>
        {games.map((g) => (
          <button
            key={g.slug}
            onClick={() => {
              setGameSlug(g.slug);
              setKindKey(COSMETICS_BY_GAME[g.slug]?.[0]?.key ?? '');
            }}
            className={`px-3 py-1.5 rounded-lg text-sm ${
              gameSlug === g.slug ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      {kinds.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-slate-400">Cosmetic</span>
          {kinds.map((k) => (
            <button
              key={k.key}
              onClick={() => setKindKey(k.key)}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                kindKey === k.key ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      )}

      {kind && <p className="text-xs text-slate-400">{kind.note}</p>}

      {kind && (
        <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 space-y-2">
          <div className="flex items-baseline gap-2">
            <h3 className="text-sm font-semibold text-slate-100">Shop tab name</h3>
            <span className="text-xs text-slate-500">
              what players see above this tab, in the game&rsquo;s shop
            </span>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs text-slate-400 mb-1">
                Name for <code className="text-slate-300">{kindKey}</code>
              </label>
              <input
                value={labelDraft?.name ?? ''}
                onChange={(e) => setLabelDraft((p) => ({ name: e.target.value, order: p?.order ?? 0 }))}
                placeholder="Not set — using the built-in name"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              />
            </div>
            <div className="w-24">
              <label className="block text-xs text-slate-400 mb-1" title="Ascending. Lower shows first.">
                Order
              </label>
              <input
                type="number"
                value={labelDraft?.order ?? 0}
                onChange={(e) => setLabelDraft((p) => ({ name: p?.name ?? '', order: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm"
              />
            </div>
            <button
              onClick={() => void saveLabel()}
              disabled={savingLabel || !labelDraft?.name.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-500 disabled:opacity-50"
            >
              {savingLabel ? 'Saving…' : 'Save name'}
            </button>
            {currentLabel && (
              <button
                onClick={() => void resetLabel()}
                disabled={savingLabel}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm hover:bg-slate-600 disabled:opacity-50"
                title="Delete the override and fall back to the name compiled into the backend"
              >
                Reset to default
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            This only renames and reorders the tab. Whether it appears at all is decided by
            whether any item is published under <code>{kindKey}</code>, so a tab cannot be hidden
            from here — unpublish its items instead.
          </p>
        </div>
      )}

      {renderUploader()}

      {error && (
        <p className="text-sm text-red-400 p-3 rounded-lg bg-red-900/20 border border-red-800">{error}</p>
      )}

      {broken.length > 0 && kind?.requires && (
        <div className="p-3 rounded-lg bg-red-900/20 border border-red-800 text-xs text-red-300 space-y-1">
          <p>
            <strong>{broken.length} item(s) are missing <code>metadata.{kind.requires}</code></strong> — they
            appear in the shop and can be bought and equipped, then render nothing in-match.
          </p>
          <p className="text-red-300/80">{broken.map((b) => b.name).join(', ')}</p>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 p-4 rounded-lg bg-slate-800/50 border border-slate-700">
          {loading ? 'Loading…' : 'Nothing uploaded yet for this cosmetic.'}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((it) => {
            const assetUrl = it.metadata?.assetUrl ?? '';
            const mediaType = it.metadata?.mediaType ?? '';
            const isVideo = mediaType === 'video';
            // Show what actually renders. For a still that is the asset itself;
            // a video cannot be thumbnailed here, so its poster stands in —
            // which is what plak shows while the video buffers anyway.
            const tileUrl = isVideo ? it.previewUrl : (assetUrl || it.previewUrl);
            const missing = kind?.requires && !it.metadata?.[kind.requires];
            const tileMismatch =
              !isVideo && assetUrl && it.previewUrl && it.previewUrl !== assetUrl;
            return (
              <div
                key={it.itemId}
                className={`rounded-lg bg-slate-800 border overflow-hidden flex flex-col ${
                  missing ? 'border-red-700' : 'border-slate-700'
                }`}
              >
                <div className="aspect-video bg-slate-900 flex items-center justify-center">
                  {tileUrl ? (
                    // Plain <img>: R2 host is not in next.config images.remotePatterns
                    // and the admin panel has no need for the optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tileUrl} alt={it.name} className="max-w-full max-h-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-600">no image</span>
                  )}
                </div>
                <div className="p-2 space-y-1 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-medium text-slate-100 truncate flex-1" title={it.name}>{it.name}</p>
                    {mediaType && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${isVideo ? 'bg-sky-900/60 text-sky-300' : 'bg-slate-700 text-slate-300'}`}>
                        {mediaType}
                      </span>
                    )}
                  </div>
                  {it.description && (
                    <p className="text-[10px] text-slate-400 line-clamp-2" title={it.description}>{it.description}</p>
                  )}
                  <p className="text-[10px] text-slate-500 truncate" title={it.slug}>{it.slug}</p>
                  <p className="text-[10px] text-slate-400">
                    {it.price?.coins ? `${it.price.coins} coins` : ''}
                    {it.price?.gems ? ` · ${it.price.gems} gems` : ''}
                  </p>
                  {missing && (
                    <p className="text-[10px] text-red-400">
                      missing metadata.{kind?.requires} — renders nothing
                    </p>
                  )}
                  {assetUrl && !mediaType && kindKey === 'background' && (
                    <p className="text-[10px] text-amber-400">
                      no mediaType — treated as an image, so an mp4 will not play
                    </p>
                  )}
                  {tileMismatch && (
                    <p className="text-[10px] text-amber-400">shop tile differs from the background</p>
                  )}
                  {it.isActive === false && <p className="text-[10px] text-amber-400">unpublished</p>}
                </div>
                <div className="p-2 pt-0 flex gap-1.5">
                  <button
                    onClick={() => void toggleActive(it)}
                    disabled={busyId === it.itemId}
                    className="flex-1 px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-100 hover:bg-slate-600 disabled:opacity-50"
                  >
                    {busyId === it.itemId ? '…' : it.isActive === false ? 'Restore' : 'Unpublish'}
                  </button>
                  {(assetUrl || it.previewUrl) && (
                    <a
                      href={assetUrl || it.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2 py-1 rounded text-[11px] bg-slate-700 text-slate-100 hover:bg-slate-600"
                      title={assetUrl || it.previewUrl}
                    >Open</a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
