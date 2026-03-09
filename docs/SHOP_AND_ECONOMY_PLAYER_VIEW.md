# Kalpsite – Player view (Shop & Economy)

This doc describes the **Player view** in Kalpsite admin: the same shop, wallet, and economy flows as the plazy Flutter app, so you can test as the logged-in user.

## Overview

- **Route:** `/admin/play`
- **Auth:** Uses the same admin session. Store RPCs run as the authenticated user (the admin account), so you see that user’s wallet, inventory, daily rewards, battle pass, achievements, and gifts.
- **Purpose:** Test player-facing flows (shop, cart, rewards, battle pass, achievements, gifts, inventory) without leaving the admin panel.

## Implemented flows

| Flow | Description |
|------|-------------|
| **Wallet bar** | Coins and gems at the top; refreshes after claims/purchases. |
| **Shop** | Deals, bundles, and catalog grid. Add items to cart by coins or gems. |
| **Cart** | Modal with cart lines, totals, and checkout (calls `store/purchase_item` per line with `requestId`). |
| **Daily rewards** | 7-day schedule, streak, and “Claim today’s reward”. |
| **Battle pass** | Current season, tiers, claim free/premium, unlock premium with gems. |
| **Achievements** | List with progress and “Claim” when completed. |
| **Gifts** | Inbox of pending received gifts; Accept / Decline. |
| **Inventory** | Grid of owned items with “Equip”. |

## Code layout

- **`lib/store-types.ts`** – TypeScript types aligned with backend (Wallet, StoreItem, Deal, Bundle, DailyRewards, Season, Achievement, Gift, Inventory).
- **`lib/store-api.ts`** – Store RPC client (`getWallet`, `getItems`, `purchaseItem`, `getDeals`, `purchaseDeal`, `getBundles`, `purchaseBundle`, `getDailyRewards`, `claimDailyReward`, `getCurrentSeason`, `claimSeasonReward`, `purchasePremiumPass`, `getAchievements`, `claimAchievementReward`, `getReceivedGifts`, `getSentGifts`, `acceptGift`, `declineGift`, `getInventory`, `equipItem`).
- **`app/api/admin/rpc/route.ts`** – Allowed RPC IDs extended with store player RPCs (see comment “Store – player view”).
- **`app/admin/play/page.tsx`** – Player view page with tabs and wallet/cart state.
- **`components/store/`** – `WalletBar`, `ShopView`, `DailyRewardsView`, `BattlePassView`, `AchievementsView`, `GiftsView`, `InventoryView`, `CartView`.

## Design reference

Same behaviour and flows as in **plazy** and the design doc:

- **plazy:** `plazy/docs/SHOP_AND_ECONOMY_UI_UX_DESIGN.md`
- **Backend:** `kalpix-backend/docs/MONETIZATION_ENGAGEMENT_AND_SHOP_FLOWS.md`, `SHOP_SYSTEM_PRODUCT_GUIDE.md`

## Navigation

- **Admin sidebar:** “Player view (Shop)” under Overview → links to `/admin/play`.
