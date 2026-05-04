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

export interface RulesResponse {
  gameId: string;
  title: string;
  overview: string;
  sections: { title: string; content: string }[];
  quickTips: string[];
}

export interface PlayerStatsResponse {
  userId: string;
  gameId: string;
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  totalScore: number;
  highestScore: number;
  currentStreak: number;
  longestWinStreak: number;
  rank: number;
  lastPlayedAt: number;
  createdAt: number;
  updatedAt: number;
  gameSpecific: Record<string, unknown>;
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

  getLeaderboard(args: {
    gameId: string;
    period: 'daily' | 'weekly' | 'alltime';
    limit?: number;
    cursor?: string;
  }): Promise<LeaderboardResponse> {
    return this.http.call<LeaderboardResponse>('game/get_leaderboard', {
      gameId: args.gameId,
      period: args.period,
      limit: args.limit ?? 20,
      cursor: args.cursor ?? '',
    });
  }

  getRules(gameId: string): Promise<RulesResponse> {
    return this.http.call<RulesResponse>('game/get_rules', { gameId });
  }

  getPlayerStats(gameId: string): Promise<PlayerStatsResponse> {
    return this.http.call<PlayerStatsResponse>('game/get_player_stats', {
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
