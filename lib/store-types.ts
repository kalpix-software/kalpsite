/**
 * Store & economy types aligned with kalpix-backend and plazy.
 * Used by admin player-view and any store UI.
 */

export interface Wallet {
  coins: number;
  gems: number;
}

export interface Price {
  coins: number;
  gems: number;
}

export interface StoreItem {
  itemId: string;
  name: string;
  description?: string;
  upgradeType?: string;
  category: string;
  subcategory?: string;
  iconUrl?: string;
  previewUrl?: string;
  price: Price;
  isActive: boolean;
}

export interface StoreDeal {
  dealId: string;
  itemId: string;
  item?: StoreItem;
  discountPercent: number;
  discountedCoins: number;
  discountedGems: number;
  startTime: number;
  endTime: number;
  maxPurchases: number;
  isActive: boolean;
}

export interface Bundle {
  bundleId: string;
  name: string;
  description: string;
  itemIds: string[];
  price: Price;
  originalPrice: Price;
  iconUrl?: string;
  previewUrl?: string;
  isActive: boolean;
  expiresAt?: number;
}

export interface DailyRewardTier {
  day: number;
  rewardType: string;
  rewardAmount: number;
  itemId?: string;
  description?: string;
}

export interface UserLoginStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastClaimDate: string;
  lastClaimAt?: number;
  totalClaims: number;
}

export interface DailyRewardsResponse {
  rewards: DailyRewardTier[];
  streak: UserLoginStreak;
  canClaimToday: boolean;
  nextRewardDay: number;
}

export interface Season {
  seasonId: string;
  name: string;
  description: string;
  startTime: number;
  endTime: number;
  premiumPriceCoins: number;
  premiumPriceGems: number;
  isActive: boolean;
  totalTiers?: number;
}

export interface SeasonTier {
  tierNumber: number;
  xpRequired: number;
  freeRewardType?: string;
  freeRewardAmount?: number;
  freeRewardItemId?: string;
  premiumRewardType?: string;
  premiumRewardAmount?: number;
  premiumRewardItemId?: string;
  freeRewardClaimed?: boolean;
  premiumRewardClaimed?: boolean;
}

export interface UserSeasonProgress {
  userId: string;
  seasonId: string;
  currentXp: number;
  currentTier: number;
  isPremium: boolean;
  claimedFreeTiers: number[];
  claimedPremiumTiers: number[];
  purchasedAt?: number;
}

export interface SeasonResponse {
  season: Season | null;
  tiers: SeasonTier[];
  progress: UserSeasonProgress | null;
}

export interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  iconUrl?: string;
  category: string;
  targetValue: number;
  rewardType: string;
  rewardAmount: number;
  rewardItemId?: string;
  isActive: boolean;
}

export interface UserAchievement {
  achievementId: string;
  achievement?: Achievement;
  currentValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface Gift {
  giftId: string;
  senderId: string;
  recipientId: string;
  itemId: string;
  item?: StoreItem;
  message?: string;
  status: string;
  coinsSpent: number;
  gemsSpent: number;
  createdAt: number;
  updatedAt: number;
}

export interface UserInventoryItem {
  inventoryId: string;
  userId: string;
  itemId: string;
  item?: StoreItem;
  quantity: number;
  isEquipped: boolean;
  isCollection: boolean;
  acquiredAt: number;
  expiresAt?: number;
}

export interface GetItemsResponse {
  items: StoreItem[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
}

export interface GetInventoryResponse {
  items: UserInventoryItem[];
  total: number;
  nextCursor?: string;
  hasMore: boolean;
}
