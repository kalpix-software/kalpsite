/**
 * Store RPC client for player-facing flows (wallet, shop, cart, rewards, battle pass, etc.).
 * Uses the same admin session; backend treats the caller as the authenticated user.
 */

import { callAdminRpc } from '@/lib/admin-rpc';
import type {
  Wallet,
  GetItemsResponse,
  StoreDeal,
  Bundle,
  DailyRewardsResponse,
  SeasonResponse,
  UserAchievement,
  Gift,
  GetInventoryResponse,
  PurchaseLineInput,
  PurchaseSummaryResponse,
  ConfirmPurchaseResponse,
} from '@/lib/store-types';

function unwrap<T>(raw: unknown): T {
  const o = raw as { data?: unknown };
  return (o?.data ?? raw) as T;
}

export async function getWallet(): Promise<Wallet> {
  const raw = await callAdminRpc('store/get_wallet', '{}');
  const w = unwrap<{ wallet: Wallet }>(raw);
  return w?.wallet ?? { coins: 0, gems: 0 };
}

export async function getItems(params: {
  upgradeType?: string;
  category?: string;
  subcategory?: string;
  limit?: number;
  cursor?: string;
}): Promise<GetItemsResponse> {
  const payload = JSON.stringify({
    limit: params.limit ?? 20,
    ...(params.cursor && { cursor: params.cursor }),
    ...(params.upgradeType && { upgradeType: params.upgradeType }),
    ...(params.category && { category: params.category }),
    ...(params.subcategory && { subcategory: params.subcategory }),
  });
  const raw = await callAdminRpc('store/get_items', payload);
  return unwrap<GetItemsResponse>(raw);
}

/** Step 1: Get a purchase summary (quote) for the given items. */
export async function purchaseSummary(
  items: PurchaseLineInput[],
  requestId?: string,
): Promise<PurchaseSummaryResponse> {
  const payload = JSON.stringify({ items, ...(requestId && { requestId }) });
  const raw = await callAdminRpc('store/purchase_summary', payload);
  return unwrap<PurchaseSummaryResponse>(raw);
}

/** Step 2: Confirm the purchase using a quoteId (from purchase_summary). */
export async function confirmPurchase(
  quoteId: string,
  requestId?: string,
): Promise<ConfirmPurchaseResponse> {
  const payload = JSON.stringify({ quoteId, ...(requestId && { requestId }) });
  const raw = await callAdminRpc('store/confirm_purchase', payload);
  return unwrap<ConfirmPurchaseResponse>(raw);
}

/** Convenience: one-shot purchase (summary → confirm) for a list of items. */
export async function purchaseItems(
  items: PurchaseLineInput[],
  requestId?: string,
): Promise<ConfirmPurchaseResponse> {
  const summary = await purchaseSummary(items, requestId);
  return confirmPurchase(summary.quoteId, requestId);
}

export async function getDeals(): Promise<StoreDeal[]> {
  const raw = await callAdminRpc('store/get_deals', '{}');
  const o = unwrap<{ deals?: StoreDeal[] }>(raw);
  return o?.deals ?? [];
}

export async function purchaseDeal(params: {
  dealId: string;
  currencyType?: string;
  requestId?: string;
}): Promise<{ newBalance: Wallet }> {
  const payload = JSON.stringify({
    dealId: params.dealId,
    ...(params.currencyType && { currencyType: params.currencyType }),
    ...(params.requestId && { requestId: params.requestId }),
  });
  const raw = await callAdminRpc('store/purchase_deal', payload);
  return unwrap(raw);
}

export async function getBundles(): Promise<Bundle[]> {
  const raw = await callAdminRpc('store/get_bundles', '{}');
  const o = unwrap<{ bundles?: Bundle[] }>(raw);
  return o?.bundles ?? [];
}

export async function purchaseBundle(params: {
  bundleId: string;
  currencyType?: string;
  requestId?: string;
}): Promise<{ newBalance: Wallet }> {
  const payload = JSON.stringify({
    bundleId: params.bundleId,
    ...(params.currencyType && { currencyType: params.currencyType }),
    ...(params.requestId && { requestId: params.requestId }),
  });
  const raw = await callAdminRpc('store/purchase_bundle', payload);
  return unwrap(raw);
}

export async function getDailyRewards(): Promise<DailyRewardsResponse> {
  const raw = await callAdminRpc('store/get_daily_rewards', '{}');
  return unwrap<DailyRewardsResponse>(raw);
}

export async function claimDailyReward(): Promise<{
  day: number;
  rewardType: string;
  rewardAmount: number;
  itemId?: string;
  newBalance: Wallet;
  streak: import('@/lib/store-types').UserLoginStreak;
}> {
  const raw = await callAdminRpc('store/claim_daily_reward', '{}');
  return unwrap(raw);
}

export async function getCurrentSeason(): Promise<SeasonResponse> {
  const raw = await callAdminRpc('store/get_current_season', '{}');
  return unwrap<SeasonResponse>(raw);
}

export async function purchasePremiumPass(requestId?: string): Promise<{ newBalance: Wallet }> {
  const payload = requestId ? JSON.stringify({ requestId }) : '{}';
  const raw = await callAdminRpc('store/purchase_premium_pass', payload);
  return unwrap(raw);
}

export async function claimSeasonReward(params: {
  seasonId: string;
  tierNumber: number;
  track: 'free' | 'premium';
}): Promise<{ rewardType: string; rewardAmount: number; rewardItemId?: string; newBalance: Wallet }> {
  const raw = await callAdminRpc(
    'store/claim_season_reward',
    JSON.stringify({
      seasonId: params.seasonId,
      tierNumber: params.tierNumber,
      track: params.track,
    })
  );
  return unwrap(raw);
}

export async function getAchievements(category?: string): Promise<UserAchievement[]> {
  const payload = category ? JSON.stringify({ category }) : '{}';
  const raw = await callAdminRpc('store/get_achievements', payload);
  const o = unwrap<{ achievements?: UserAchievement[] }>(raw);
  return o?.achievements ?? [];
}

export async function claimAchievementReward(achievementId: string): Promise<{
  rewardType: string;
  rewardAmount: number;
  rewardItemId?: string;
  newBalance: Wallet;
}> {
  const raw = await callAdminRpc(
    'store/claim_achievement_reward',
    JSON.stringify({ achievementId })
  );
  return unwrap(raw);
}

export async function getReceivedGifts(status?: string): Promise<Gift[]> {
  const payload = status ? JSON.stringify({ status }) : '{}';
  const raw = await callAdminRpc('store/get_received_gifts', payload);
  const o = unwrap<{ gifts?: Gift[] }>(raw);
  return o?.gifts ?? [];
}

export async function getSentGifts(): Promise<Gift[]> {
  const raw = await callAdminRpc('store/get_sent_gifts', '{}');
  const o = unwrap<{ gifts?: Gift[] }>(raw);
  return o?.gifts ?? [];
}

export async function acceptGift(giftId: string): Promise<void> {
  await callAdminRpc('store/accept_gift', JSON.stringify({ giftId }));
}

export async function declineGift(giftId: string): Promise<void> {
  await callAdminRpc('store/decline_gift', JSON.stringify({ giftId }));
}

export async function getInventory(params: {
  category?: string;
  subcategory?: string;
  isCollection?: boolean;
  limit?: number;
  cursor?: string;
}): Promise<GetInventoryResponse> {
  const payload = JSON.stringify({
    limit: params.limit ?? 20,
    ...(params.cursor && { cursor: params.cursor }),
    ...(params.category && { category: params.category }),
    ...(params.subcategory && { subcategory: params.subcategory }),
    ...(params.isCollection !== undefined && { isCollection: params.isCollection }),
  });
  const raw = await callAdminRpc('store/get_inventory', payload);
  return unwrap<GetInventoryResponse>(raw);
}

export async function equipItem(itemId: string): Promise<void> {
  await callAdminRpc('store/equip_item', JSON.stringify({ itemId }));
}
