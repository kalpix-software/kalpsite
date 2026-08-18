// Typed wrappers over the existing kalpix-backend RPCs that any game needs.
// These mirror the Tero data layer in plak/lib/features/games/tero/data so the
// same lobby UI shape works across games.

import type { KalpixHttp } from './rpc';

export interface GameModeConfig {
  key: string;
  displayName: string;
  subtitle?: string;
  maxPlayers: number;
  teamSize: number;
}

export interface GameSubcategory {
  key: string;
  name: string;
}

/** One payout slot within a tier's prize breakdown. */
export interface PrizePlace {
  place: number;
  coins: number;
}

export interface ModePrizes {
  totalPool: number;
  afterRake: number;
  perWinner?: number;
  payouts: PrizePlace[];
}

/** One entry-fee bracket as delivered inside game/get_catalog metadata. */
export interface TierPrizes {
  tier: string;
  entryFee: number;
  levelUnlock: number;
  prizesByMode: Record<string, ModePrizes>;
}

export interface EntryTiersResponse {
  rake: number;
  tiers: TierPrizes[];
}

export interface GameCatalogItem {
  gameId: string;
  name: string;
  description: string;
  iconUrl: string;
  bannerUrl: string;
  modes: string[];
  modeConfigs: GameModeConfig[];
  minPlayers: number;
  maxPlayers: number;
  category: string;
  status: string;
  version: string;
  isActive: boolean;
  subcategories?: GameSubcategory[];
  metadata?: {
    features?: string[];
    turnTimer?: number;
    clientType?: 'native' | 'webview';
    webviewUrl?: string;
    /** Entry-fee tiers, embedded here rather than a separate RPC. */
    entryTiers?: EntryTiersResponse;
  };
  createdAt: number;
  updatedAt: number;
}

export interface GameCatalogResponse {
  games: GameCatalogItem[];
  totalCount: number;
}

export interface ActiveMatchSummary {
  matchId: string;
  label: string;
  matchType: string;
  players: number;
  playingCount: number;
}

export interface GetActiveMatchResponse {
  active: boolean;
  matches: ActiveMatchSummary[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  score: number;
  numScore: number;
  updatedAt: number;
}

export interface LeaderboardResponse {
  leaderboardId: string;
  entries: LeaderboardEntry[];
  totalCount: number;
  hasMore: boolean;
  cursor: string;
  ownerEntry?: LeaderboardEntry;
}

export interface RatingResponse {
  userId: string;
  gameId: string;
  rating: number;
  deviation: number;
  volatility: number;
  numResults: number;
  peakRating: number;
  provisional: boolean;
  ranked: boolean;
  rank?: number;
  updatedAt: number;
}

export interface RulesResponse {
  gameId: string;
  title: string;
  overview: string;
  sections: { title: string; content: string }[];
  quickTips: string[];
}

// Unified per-game stats from game/get_stats (single game). Mirrors the
// backend models.GameStats: level/XP progression + the match record.
export interface GameStatsResponse {
  gameId: string;
  name: string;
  iconUrl: string;
  level: number;
  zone: string;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  isMaxLevel: boolean;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDrawn: number;
  winRate: number;
}

/**
 * One catalog row as the CLIENT sees it (models.StoreItemResponse).
 *
 * Note this is not the admin shape: store/get_items only returns raw
 * models.StoreItem when includeInactive is set, which is admin-gated. The
 * difference matters most for price — here it is a single amount plus a
 * currencyType, not a {coins, gems} pair.
 */
export interface StoreItem {
  itemId: string;
  name: string;
  description?: string;
  upgradeType?: string;
  category: string;
  subcategory: string;
  previewUrl: string;
  mediaType?: string;
  assetUrl?: string;
  /** "coins" | "gems" — which wallet `price` is denominated in. */
  currencyType: string;
  price: number;
  /** Present only when a discount is active. */
  discountedPrice?: number;
  discountedPercent?: number;
  purchaseLimit?: number;
  quantityAvailable?: number;
  quantityAddedToCart?: number;
  isOwned: boolean;
  isEquipped: boolean;
}

/** One seat in a chess replay. */
export interface ChessReplayPlayer {
  userId: string;
  username?: string;
  avatarUrl?: string;
  isBot?: boolean;
  rating?: number;
  pieceSetBaseUrl?: string;
}

/**
 * A finished chess game, complete enough to scrub through offline.
 *
 * `moves` are UCI from the start position — unambiguous without board context,
 * so the client replays them by applying one at a time. `result` is
 * authoritative from the game state, NOT parsed from the PGN tail (a
 * resignation or timeout leaves that as "*").
 */
export interface ChessReplayWire {
  pgn: string;
  moves: string[];
  finalFen: string;
  result: string;
  reason?: string;
  timeControl?: string;
  whiteMs: number;
  blackMs: number;
  white?: ChessReplayPlayer;
  black?: ChessReplayPlayer;
  entryFee?: number;
  tier?: string;
}

export interface MatchReplayResponse {
  available: boolean;
  matchId: string;
  gameSlug?: string;
  gameMode?: string;
  result?: string;
  completedAt?: number;
  duration?: number;
  players?: Array<{ userId: string; username?: string; displayName?: string; avatarUrl?: string; isBot?: boolean }>;
  winner?: { userId: string; username?: string; displayName?: string; avatarUrl?: string; isBot?: boolean };
  chatLog?: Array<{ seq: number; senderId: string; username?: string; kind: string; text?: string; quickCode?: number; tsMs: number }>;
  coinDelta?: number;
  chess?: ChessReplayWire;
}

/** Equipped cosmetic slots for one (user, game). Null = bundled default. */
export interface GamePreferences {
  gameId: string;
  gameSlug?: string;
  equippedCardDeckId?: string;
  equippedBackgroundId?: string;
  equippedBoardId?: string;
  equippedPieceSetId?: string;
  updatedAt?: number;
}

/**
 * Buy-and-equip in one transaction. Registered under the `game_upgrade/`
 * namespace, NOT `game/` like the other cosmetic RPCs — see main.go. The
 * doc comment in services/game/buy_and_apply.go calls it
 * "game/buy_and_apply_cosmetic", which is not a registered name.
 */
const BUY_AND_APPLY_RPC = 'game_upgrade/buy_and_apply';

export class GameApi {
  constructor(private http: KalpixHttp) {}

  getCatalog(): Promise<GameCatalogResponse> {
    return this.http.call<GameCatalogResponse>('game/get_catalog', {});
  }

  getActiveMatch(gameId: string): Promise<GetActiveMatchResponse> {
    return this.http.call<GetActiveMatchResponse>('game/get_active_match', {
      gameId,
    });
  }

  // One Glicko-2 rating board per game; resolved server-side from gameId.
  getLeaderboard(args: {
    gameId: string;
    limit?: number;
    cursor?: string;
  }): Promise<LeaderboardResponse> {
    return this.http.call<LeaderboardResponse>('game/get_leaderboard', {
      gameId: args.gameId,
      limit: args.limit ?? 20,
      cursor: args.cursor ?? '',
    });
  }

  // A player's Glicko-2 rating for a game (rating, deviation, provisional/ranked,
  // peak, leaderboard rank). Defaults to the current user.
  getRating(gameId: string): Promise<RatingResponse> {
    return this.http.call<RatingResponse>('game/get_rating', { gameId });
  }

  getRules(gameId: string): Promise<RulesResponse> {
    return this.http.call<RulesResponse>('game/get_rules', { gameId });
  }

  getStats(gameId: string): Promise<GameStatsResponse> {
    return this.http.call<GameStatsResponse>('game/get_stats', {
      gameId,
    });
  }

  /**
   * Game-upgrade catalog for one game + subcategory.
   *
   * `category` carries the game slug — store/get_items has no gameId field, so
   * passing one silently returns every game's upgrades instead of this game's.
   */
  getStoreItems(args: {
    gameId: string;
    subcategory: string;
    limit?: number;
  }): Promise<{ items: StoreItem[]; total?: number }> {
    return this.http.call<{ items: StoreItem[]; total?: number }>('store/get_items', {
      upgradeType: 'game_upgrade',
      category: args.gameId,
      subcategory: args.subcategory,
      limit: args.limit ?? 100,
    });
  }

  /**
   * The caller's record of one finished match, including the chess move list.
   *
   * `available: false` is a normal outcome, not an error — match_history keeps
   * only the most recent matches per game, so replay links expire by design.
   */
  getMatchReplay(matchId: string): Promise<MatchReplayResponse> {
    return this.http.call<MatchReplayResponse>('game/get_match_replay', { matchId });
  }

  /**
   * Ask a live match to re-read this player's equipped cosmetics.
   *
   * MUST go over HTTP, never `session.signal()`: MatchSignal carries no caller
   * identity, so a socket signal lets the sender name any userId — which would
   * let a player burn their OPPONENT's swap allowance. This RPC stamps the
   * user from the authenticated session instead.
   *
   * The RPC is match-module agnostic despite living in tero_game.go.
   */
  refreshMatchCosmetics(matchId: string): Promise<unknown> {
    return this.http.call('refresh_match_cosmetics', { matchId });
  }

  /** Currently equipped cosmetics for a game. */
  getPreferences(gameId: string): Promise<GamePreferences> {
    return this.http.call<GamePreferences>('game/get_preferences', { gameId });
  }

  /** Equip an item the user already owns. The slot comes from its subcategory. */
  applyCosmetic(args: { gameId: string; itemId: string }): Promise<GamePreferences> {
    return this.http.call<GamePreferences>('game/apply_cosmetic', args);
  }

  /** Unequip whatever occupies a slot, falling back to the bundled default. */
  clearCosmetic(args: { gameId: string; cosmeticType: string }): Promise<GamePreferences> {
    return this.http.call<GamePreferences>('game/clear_cosmetic', args);
  }

  /**
   * Price an unowned item without spending anything. `alreadyOwned` comes back
   * true (and the price zeroed) when the user already has it, so the UI can
   * show "Apply" instead of "Buy & Apply".
   */
  quoteBuyAndApply(args: { gameId: string; itemId: string }): Promise<{
    itemId: string;
    subcategory: string;
    currencyType: string;
    unitPrice: number;
    discountedUnitPrice?: number | null;
    totalPrice?: number;
    alreadyOwned?: boolean;
    walletBalance?: number;
    newBalanceAfter?: number;
    /**
     * Minted by the quote and REQUIRED by commit — the server rejects a
     * commit without it. It is what makes a retried purchase charge once, so
     * never generate one client-side; always pass back the quote's.
     */
    idempotencyKey: string;
    expiresAt?: number;
  }> {
    return this.http.call(BUY_AND_APPLY_RPC, { ...args, quote: true });
  }

  /**
   * Purchase and equip in one transaction.
   *
   * `idempotencyKey` must be the one returned by quoteBuyAndApply — the server
   * rejects a commit without it, and it's what stops a retry double-charging.
   */
  commitBuyAndApply(args: {
    gameId: string;
    itemId: string;
    idempotencyKey: string;
  }): Promise<{ success?: boolean; message?: string }> {
    return this.http.call(BUY_AND_APPLY_RPC, { ...args, quote: false });
  }

  // ── Chess-specific RPCs (mirrors src/chess_game.go) ─────────────────────

  createChessMatch(args: {
    timeControl: 'blitz' | 'rapid';
    matchType: 'private' | 'random';
    rated?: boolean;
  }): Promise<{ matchId: string; message: string }> {
    return this.http.call('create_chess_match', args);
  }

  findOrCreateChessMatch(args: {
    timeControl: 'blitz' | 'rapid';
    rated?: boolean;
    allowBot?: boolean;
    /** Entry-fee bracket; omit or empty for a free table. */
    tier?: string;
  }): Promise<{ matchId: string; message: string }> {
    return this.http.call('find_or_create_chess_match', args);
  }

  /**
   * The caller's wallet. Needed by the tier picker to grey out tables the
   * player can't afford — the server rejects them anyway, but failing at the
   * button is a worse experience than never offering it.
   */
  getWallet(): Promise<{ coins: number; gems: number }> {
    return this.http.call<{ coins: number; gems: number }>('store/get_wallet', {});
  }

  addBotToChessMatch(args: {
    matchId: string;
    difficulty?: number;
  }): Promise<{ success: boolean; message: string }> {
    return this.http.call('add_bot_to_chess_match', args);
  }
}
