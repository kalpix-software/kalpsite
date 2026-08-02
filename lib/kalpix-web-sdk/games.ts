// Typed wrappers over the existing kalpix-backend RPCs that any game needs.
// These mirror the Tero data layer in plazy/lib/features/games/uno/data so the
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

export interface StoreItem {
  itemId: string;
  slug?: string;
  name: string;
  subcategory: string;
  iconUrl: string;
  previewUrl?: string;
  price?: { coins?: number; gems?: number };
  priceCoins: number;
  priceCurrency?: string;
  isOwned: boolean;
  isEquipped: boolean;
  metadata?: Record<string, string>;
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
    balance?: number;
    canAfford?: boolean;
  }> {
    return this.http.call('game/buy_and_apply_cosmetic', { ...args, quote: true });
  }

  /** Purchase and equip in one transaction. */
  commitBuyAndApply(args: {
    gameId: string;
    itemId: string;
    idempotencyKey?: string;
  }): Promise<{ success?: boolean; message?: string }> {
    return this.http.call('game/buy_and_apply_cosmetic', { ...args, quote: false });
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
  }): Promise<{ matchId: string; message: string }> {
    return this.http.call('find_or_create_chess_match', args);
  }

  addBotToChessMatch(args: {
    matchId: string;
    difficulty?: number;
  }): Promise<{ success: boolean; message: string }> {
    return this.http.call('add_bot_to_chess_match', args);
  }
}
