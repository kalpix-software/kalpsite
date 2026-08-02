'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Coins, Gem, Loader2, Sparkles } from 'lucide-react';

import type { GameApi, GamePreferences, GameSubcategory, StoreItem } from '@/lib/kalpix-web-sdk/games';
import { lobbyTheme } from '@/components/games/shell/theme';

// Chess upgrades — the in-game mirror of Tero's customize sheet.
//
// Sub-tabs are NOT hardcoded: they come from game/get_catalog, which derives
// them from `SELECT DISTINCT store_items.type` for this game. Uploading a new
// subcategory in /admin/chess-cosmetics makes a tab appear here with no code
// change, and the labels resolve server-side (so "background" reads
// "Backgrounds" for chess but "Table Themes" for Tero).
//
// Equipped state comes from game/get_preferences, not the catalog's isEquipped
// flag — store/get_items does not populate that field.

const GAME_ID = 'chess';

/** Maps a subcategory key to the preferences field holding its equipped item. */
const SLOT_FIELD: Record<string, keyof GamePreferences> = {
  board: 'equippedBoardId',
  pieces: 'equippedPieceSetId',
  background: 'equippedBackgroundId',
};

type Busy = { itemId: string; action: 'equip' | 'buy' } | null;

export default function UpgradesTab({ games }: { games: GameApi }) {
  const [subcategories, setSubcategories] = useState<GameSubcategory[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<StoreItem[] | null>(null);
  const [prefs, setPrefs] = useState<GamePreferences | null>(null);
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Sub-tabs + equipped state. Loaded once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catalog, preferences] = await Promise.all([
          games.getCatalog(),
          games.getPreferences(GAME_ID).catch(() => null),
        ]);
        if (cancelled) return;
        const chess = catalog.games?.find((g) => g.gameId === GAME_ID);
        const subs = chess?.subcategories ?? [];
        setSubcategories(subs);
        setActive((cur) => cur ?? subs[0]?.key ?? null);
        setPrefs(preferences);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [games]);

  // Items for the active sub-tab.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setItems(null);
    games
      .getStoreItems({ gameId: GAME_ID, subcategory: active })
      .then((r) => { if (!cancelled) setItems(r.items ?? []); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [games, active]);

  const equippedItemId = useMemo(() => {
    if (!active || !prefs) return null;
    const field = SLOT_FIELD[active];
    return field ? (prefs[field] as string | undefined) ?? null : null;
  }, [active, prefs]);

  const refreshPrefs = useCallback(async () => {
    try {
      setPrefs(await games.getPreferences(GAME_ID));
    } catch {
      // Non-fatal: the badge just stays stale until the next load.
    }
  }, [games]);

  const flash = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2200);
  }, []);

  const onEquip = useCallback(
    async (item: StoreItem) => {
      setBusy({ itemId: item.itemId, action: 'equip' });
      setError(null);
      try {
        const next = await games.applyCosmetic({ gameId: GAME_ID, itemId: item.itemId });
        setPrefs(next);
        flash(`${item.name} equipped`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [games, flash],
  );

  const onBuy = useCallback(
    async (item: StoreItem) => {
      setBusy({ itemId: item.itemId, action: 'buy' });
      setError(null);
      try {
        // Quote first so an unaffordable purchase fails before the wallet is
        // touched, and an already-owned item skips straight to equipping.
        const quote = await games.quoteBuyAndApply({ gameId: GAME_ID, itemId: item.itemId });
        if (quote.canAfford === false && !quote.alreadyOwned) {
          setError('Not enough balance for this item.');
          return;
        }
        await games.commitBuyAndApply({ gameId: GAME_ID, itemId: item.itemId });
        // Re-read both: the item is now owned and occupies its slot.
        const [refreshed] = await Promise.all([
          games.getStoreItems({ gameId: GAME_ID, subcategory: active ?? '' }),
          refreshPrefs(),
        ]);
        setItems(refreshed.items ?? []);
        flash(`${item.name} purchased and equipped`);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [games, active, refreshPrefs, flash],
  );

  const visible = useMemo(() => {
    if (!items) return null;
    return ownedOnly ? items.filter((i) => i.isOwned) : items;
  }, [items, ownedOnly]);

  return (
    <div className="flex flex-col gap-3 px-5 pb-32 pt-4">
      {/* Sub-tabs */}
      {subcategories && subcategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {subcategories.map((s) => {
            const on = s.key === active;
            return (
              <button
                key={s.key}
                onClick={() => setActive(s.key)}
                className="rounded-full px-3.5 py-1.5 text-sm font-medium transition"
                style={{
                  background: on ? lobbyTheme.primarySoft : lobbyTheme.cardSoft,
                  border: `1px solid ${on ? lobbyTheme.primaryBorder : 'transparent'}`,
                  color: on ? lobbyTheme.text : lobbyTheme.textMuted,
                }}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Owned-only toggle */}
      <div className="flex items-center justify-between">
        <div className="text-xs" style={{ color: lobbyTheme.textDim }}>
          {visible ? `${visible.length} item${visible.length === 1 ? '' : 's'}` : ' '}
        </div>
        <button
          onClick={() => setOwnedOnly((v) => !v)}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition"
          style={{
            background: ownedOnly ? lobbyTheme.primarySoft : lobbyTheme.cardSoft,
            border: `1px solid ${ownedOnly ? lobbyTheme.primaryBorder : 'transparent'}`,
            color: ownedOnly ? lobbyTheme.text : lobbyTheme.textMuted,
          }}
        >
          <span
            className="grid h-4 w-4 place-items-center rounded-[4px]"
            style={{
              background: ownedOnly ? lobbyTheme.primary : 'transparent',
              border: `1px solid ${ownedOnly ? lobbyTheme.primary : lobbyTheme.textDim}`,
            }}
          >
            {ownedOnly && <Check className="h-3 w-3 text-white" />}
          </span>
          Owned only
        </button>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(229,72,77,0.15)', color: lobbyTheme.danger }}>
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'rgba(5,135,34,0.15)', color: lobbyTheme.success }}>
          {notice}
        </div>
      )}

      {subcategories?.length === 0 && <EmptyState text="No upgrades available for chess yet." />}

      {visible === null && active && <GridSkeleton />}

      {visible && visible.length === 0 && (
        <EmptyState text={ownedOnly ? "You don't own anything here yet." : 'Nothing in this category yet.'} />
      )}

      {visible && visible.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((item) => (
            <ItemCard
              key={item.itemId}
              item={item}
              equipped={item.itemId === equippedItemId}
              busy={busy?.itemId === item.itemId ? busy.action : null}
              onEquip={() => onEquip(item)}
              onBuy={() => onBuy(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item, equipped, busy, onEquip, onBuy,
}: {
  item: StoreItem;
  equipped: boolean;
  busy: 'equip' | 'buy' | null;
  onEquip(): void;
  onBuy(): void;
}) {
  const coins = item.price?.coins ?? item.priceCoins ?? 0;
  const gems = item.price?.gems ?? 0;
  const art = item.previewUrl || item.iconUrl;

  return (
    <div
      className="overflow-hidden rounded-xl"
      style={{
        background: lobbyTheme.card,
        border: `1px solid ${equipped ? lobbyTheme.primaryBorder : lobbyTheme.divider}`,
      }}
    >
      <div className="relative grid aspect-square place-items-center" style={{ background: lobbyTheme.cardSoft }}>
        {art ? (
          // Plain <img>: the R2 host isn't in next.config images.remotePatterns
          // and these are already sized for display.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt={item.name} className="h-full w-full object-contain p-2" />
        ) : (
          <Sparkles className="h-7 w-7" style={{ color: lobbyTheme.textDim }} />
        )}
        {equipped && (
          <div
            className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
            style={{ background: lobbyTheme.primary, color: '#fff' }}
          >
            <Check className="h-3 w-3" /> Equipped
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 p-2.5">
        <div className="truncate text-sm font-medium" style={{ color: lobbyTheme.text }} title={item.name}>
          {item.name}
        </div>

        {item.isOwned ? (
          <button
            onClick={onEquip}
            disabled={equipped || busy !== null}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-60"
            style={{
              background: equipped ? lobbyTheme.cardSoft : lobbyTheme.primarySoft,
              border: `1px solid ${equipped ? 'transparent' : lobbyTheme.primaryBorder}`,
              color: equipped ? lobbyTheme.textMuted : lobbyTheme.text,
            }}
          >
            {busy === 'equip' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {equipped ? 'Equipped' : 'Equip'}
          </button>
        ) : (
          <button
            onClick={onBuy}
            disabled={busy !== null}
            className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition disabled:opacity-60"
            style={{ background: lobbyTheme.primary, color: '#fff' }}
          >
            {busy === 'buy' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : gems > 0 ? (
              <><Gem className="h-3.5 w-3.5" /> {gems}</>
            ) : (
              <><Coins className="h-3.5 w-3.5" /> {coins}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="grid place-items-center rounded-xl py-12 text-center" style={{ background: lobbyTheme.cardSoft }}>
      <Sparkles className="mb-2 h-7 w-7" style={{ color: lobbyTheme.textDim }} />
      <div className="max-w-xs text-sm" style={{ color: lobbyTheme.textMuted }}>{text}</div>
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-xl"
          style={{ background: lobbyTheme.card, border: `1px solid ${lobbyTheme.divider}` }}
        >
          <div className="aspect-square" style={{ background: lobbyTheme.cardSoft }} />
          <div className="p-2.5">
            <div className="h-3 w-2/3 rounded" style={{ background: lobbyTheme.cardSoft }} />
            <div className="mt-2 h-7 rounded-lg" style={{ background: lobbyTheme.cardSoft }} />
          </div>
        </div>
      ))}
    </div>
  );
}
