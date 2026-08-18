'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Crown } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';
import ChessCosmeticUploader from '@/components/admin/ChessCosmeticUploader';

// Chess cosmetics admin — upload board / piece-set / background art and list
// what already exists in the catalog.
//
// Everything here is an ordinary `game_upgrade` store_item tagged to the chess
// game, so pricing, bundles, deals and the player-facing shop all work with no
// chess-specific handling. The only chess-specific contract is the metadata:
//   pieces     → metadata.baseUrl points at the folder of 12 FEN-named sprites
//   board      → metadata.assetUrl is the full-res board image
//   background → metadata.assetUrl is the surface behind the board
// These are read by GetChessCosmetics / GetEquippedPieceSetBaseURL in
// services/game/preferences.go.

type ChessSubcategory = 'pieces' | 'board' | 'background';

type StoreItemRow = {
  itemId: string;
  slug?: string;
  name: string;
  previewUrl?: string;
  subcategory?: string;
  type?: string;
  isActive?: boolean;
  price?: { coins?: number; gems?: number };
  metadata?: Record<string, string>;
};

const SUBCATEGORY_LABEL: Record<ChessSubcategory, string> = {
  pieces: 'Piece sets',
  board: 'Boards',
  background: 'Backgrounds',
};

// Which layers the opponent can see. Surfaced in the UI because it is the one
// non-obvious rule of the system and it changes how art should be judged.
const SUBCATEGORY_VISIBILITY: Record<ChessSubcategory, string> = {
  pieces: 'Visible to your opponent',
  board: 'Only you see it',
  background: 'Only you see it',
};

export default function ChessCosmeticsPage() {
  const [items, setItems] = useState<StoreItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // store/get_items is the same read the Store Items admin page uses;
      // includeInactive keeps just-uploaded-but-disabled art visible here.
      const raw = await callAdminRpc(
        'store/get_items',
        JSON.stringify({
          upgradeType: 'game_upgrade',
          category: 'chess',
          includeInactive: true,
          limit: 200,
        }),
      );
      const data = unwrapAdminRpcData<{ items?: StoreItemRow[] }>(raw);
      setItems(data?.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load chess items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const bySubcategory = (sub: ChessSubcategory) =>
    items.filter((it) => (it.subcategory ?? it.type) === sub);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-semibold text-slate-100">Chess Cosmetics</h1>
            <p className="text-xs text-slate-400">
              Boards, piece sets and backgrounds sold as chess game upgrades.
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

      <ChessCosmeticUploader onUploaded={() => void load()} />

      {error && (
        <p className="text-sm text-red-400 p-3 rounded-lg bg-red-900/20 border border-red-800">{error}</p>
      )}

      {(['pieces', 'board', 'background'] as ChessSubcategory[]).map((sub) => {
        const rows = bySubcategory(sub);
        return (
          <section key={sub} className="space-y-2">
            <div className="flex items-baseline gap-3">
              <h2 className="text-sm font-semibold text-slate-100">{SUBCATEGORY_LABEL[sub]}</h2>
              <span className="text-xs text-slate-500">{rows.length} item(s)</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                {SUBCATEGORY_VISIBILITY[sub]}
              </span>
            </div>

            {rows.length === 0 ? (
              <p className="text-xs text-slate-500 p-3 rounded-lg bg-slate-800/50 border border-slate-700">
                {loading ? 'Loading…' : 'Nothing uploaded yet.'}
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {rows.map((it) => (
                  <div key={it.itemId} className="rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
                    <div className="aspect-square bg-slate-900 flex items-center justify-center">
                      {it.previewUrl ? (
                        // Plain <img>: these are R2 URLs on a host that is not in
                        // next.config images.remotePatterns, and the admin panel
                        // has no need for the optimizer.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.previewUrl} alt={it.name} className="max-w-full max-h-full object-contain" />
                      ) : (
                        <span className="text-xs text-slate-600">no preview</span>
                      )}
                    </div>
                    <div className="p-2 space-y-1">
                      <p className="text-xs font-medium text-slate-100 truncate" title={it.name}>{it.name}</p>
                      <p className="text-[10px] text-slate-500 truncate" title={it.slug}>{it.slug}</p>
                      <p className="text-[10px] text-slate-400">
                        {it.price?.coins ? `${it.price.coins} coins` : ''}
                        {it.price?.gems ? ` · ${it.price.gems} gems` : ''}
                      </p>
                      {it.isActive === false && (
                        <p className="text-[10px] text-amber-400">inactive</p>
                      )}
                      {sub === 'pieces' && !it.metadata?.baseUrl && (
                        <p className="text-[10px] text-red-400">missing metadata.baseUrl</p>
                      )}
                      {sub !== 'pieces' && !it.metadata?.assetUrl && (
                        <p className="text-[10px] text-amber-400">no assetUrl — falls back to preview</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
