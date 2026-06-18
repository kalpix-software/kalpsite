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
  name: string;
  subcategory: string;
  iconUrl: string;
  priceCoins: number;
  priceCurrency?: string;
  isOwned: boolean;
  isEquipped: boolean;
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

  getStoreItems(args: {
    gameId: string;
    subcategory: string;
  }): Promise<{ items: StoreItem[] }> {
    return this.http.call<{ items: StoreItem[] }>('store/get_items', args);
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
