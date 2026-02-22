# Kalpsite – Pages and Login

This document describes what each page in Kalpsite does and how to log in (including which credentials to use).

---

## Public pages

### **`/` (Home)**

- **URL:** `http://localhost:3000/` (or your deployed URL)
- **What it does:** Main marketing/landing site for Kalpix Games.
- **Contents:** Navigation, Hero, Features, Stats, About, CTA, Footer, and a particle background. No login required.

---

## Admin area

All admin pages live under `/admin` and **require login**. If you are not logged in, you are redirected to `/admin/login`.

### **`/admin/login`**

- **URL:** `http://localhost:3000/admin/login`
- **What it does:** Login form for the Kalpix admin panel.
- **Fields:** **Username** and **Password** (Nakama Dashboard / Console credentials).
- **Behaviour:** On success, sets a session cookie and redirects to `/admin`. On failure, shows an error message.
- **Link:** “Back to site” goes to `/`.

- **How to get there:** Use the **Admin** link in the top nav (or mobile menu), or the **Admin** link under **Company** in the footer. Or open `/admin` or `/admin/login` in the browser.

### **`/admin` (Dashboard)**

- **URL:** `http://localhost:3000/admin`
- **What it does:** Admin dashboard with links to the main admin tools.
- **Links:**
  - **Store Items** → `/admin/store`
  - **Purchase Stats** → `/admin/stats`
  - **Bundles** → `/admin/bundles`
  - **Sync** → `/admin/sync`

### **`/admin/store` (Store Items)**

- **What it does:** Manage the in-app store catalog.
- **Features:**
  - List store items (filter by category: Avatar Upgrades, Game Upgrades, Chat Upgrades, Cosmetic).
  - **Add Item:** Create items (itemId, name, description, category, type, price in coins/gems, gameId, avatarId, etc.). Calls RPC `store/admin_add_item`.
  - Edit/update and delete items (admin RPCs).
- **Categories:** `avatar_upgrade`, `game_upgrade`, `chat_upgrade`, `cosmetic` with types like `card_back`, `background`, `chat_bubble`, `sticker_pack`, etc.

### **`/admin/stats` (Purchase Stats)**

- **What it does:** View sales and revenue for store items.
- **Features:**
  - Totals: total coins spent, total gems spent, number of items with sales.
  - Table per item: item name/ID, category, number of purchases, coins, gems.
  - Filter by category; refresh to reload.
- **Backend:** RPC `store/admin_get_item_stats`.

### **`/admin/bundles` (Bundles)**

- **What it does:** Manage discounted item bundles (packs of items sold together).
- **Features:**
  - List existing bundles.
  - **Add Bundle:** bundleId, name, description, comma-separated item IDs, price (coins/gems). RPC `store/admin_add_bundle`.
  - Delete a bundle. RPC `store/admin_delete_bundle`.
- **Read-only list:** Uses `store/get_bundles`.

### **`/admin/sync` (Sync)**

- **What it does:** One-off sync operations for avatars and store.
- **Features:**
  - **Sync Avatars:** Optional JSON payload (e.g. `{"avatars":[{"slug":"avatar1"}]}`). RPC `avatar/sync_avatars`. Syncs avatar list from your source (e.g. avatars_list.json).
  - **Sync Store Items:** No payload. RPC `store/sync_avatar_items`. Syncs store items from avatar catalogs; run after syncing avatars.

---

## Which credentials to use

Log in with the **same username and password** you use for the **Nakama Dashboard** (Console). Kalpsite uses **only the Console API**:

- **Login:** `POST {NAKAMA_CONSOLE_URL}/v2/console/authenticate` (same endpoint as the Nakama Dashboard). On success, the returned console token is stored in a cookie.
- **Admin tasks (prices, sync, store, bundles, etc.):** Kalpsite calls the Console API **CallRpcEndpoint** with that token and **NAKAMA_ADMIN_USER_ID**. The RPC runs as that game user; the backend allows it only if that user has **is_admin: true** in metadata. No shared secret in requests.

**Setup:** Create a game user in Nakama, set **is_admin: true** in metadata, copy its UUID, and set **NAKAMA_ADMIN_USER_ID** in Kalpsite `.env`. See **docs/ADMIN_AUTH_SECURITY.md** for step-by-step instructions.

---

## Environment (for reference)

- **`NAKAMA_URL`** – Nakama game server (e.g. `http://127.0.0.1:7350`). Used by the game; Kalpsite admin uses Console API only.
- **`NAKAMA_SERVER_KEY`** – Server key for Nakama game API (e.g. `defaultkey`). See `.env.example`.
- **`NAKAMA_CONSOLE_URL`** – Nakama Console API (e.g. `http://localhost:7351`). Used for login and admin RPCs.
- **`NAKAMA_ADMIN_USER_ID`** – UUID of a game user with **is_admin** in metadata. Admin RPCs run as this user. Required. See docs/ADMIN_AUTH_SECURITY.md.

---

## Quick reference

| Page            | Path           | Purpose                          |
|-----------------|----------------|----------------------------------|
| Home            | `/`            | Public marketing site            |
| Admin login     | `/admin/login` | Log in with Nakama Dashboard username and password      |
| Admin dashboard | `/admin`       | Links to Store, Stats, Bundles, Sync |
| Store items     | `/admin/store` | Catalog, add/edit/delete items   |
| Purchase stats  | `/admin/stats` | Sales and revenue                |
| Bundles         | `/admin/bundles` | Create/delete bundles          |
| Sync            | `/admin/sync`  | Sync avatars and store items     |
