# Kalpsite – Pages and Login

This document describes what each page in Kalpsite does and how to log in (including which credentials to use).

---

## Public pages

### **`/` (Home)**

- **URL:** `http://localhost:3000/` (or your deployed URL)
- **What it does:** Main marketing/landing site for Kalpix.
- **Contents:** Navigation, Hero, Features, Stats, About, CTA, Footer, and a particle background. No login required.

---

## Admin area

All admin pages live under `/admin` and **require login**. If you are not logged in, you are redirected to `/admin/login`.

### **`/admin/login`**

- **URL:** `http://localhost:3000/admin/login`
- **What it does:** **Login only** (no registration). Use an admin account created manually in kalpix (Dashboard, API Explorer, or Postman) with **`is_admin: true`** in account metadata.
- **Fields:** **Email** and **Password** (that account’s credentials). Only users with **`is_admin`** in kalpix can log in.
- **Behaviour:** On success, sets a session cookie and redirects to `/admin`. On failure (invalid credentials or not an admin account), shows an error message.
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

Log in with the **email and password** of a **game user** (same as Plazy or Postman). Admin access is **verified from the kalpix DB**: only users who have **`is_admin`** in their account metadata can log in.

- **Login:** Kalpsite uses the same auth as Plazy: **auth/login_email**. The backend returns **isAdmin** in the response (from account metadata). Session check uses **social/get_profile_info** (same RPC Plazy uses); profile includes **isAdmin**.
- **Admin tasks:** Kalpsite calls the game API with that session token; the backend enforces `is_admin` for admin RPCs.

**Setup:** In **kalpix-backend** set **ADMIN_EMAIL** so the backend grants `is_admin` to that user on register/verify, or set **`is_admin: true`** manually in kalpix for a user. See **docs/ADMIN_AUTH_SECURITY.md**.

---

## Environment (for reference)

- **`kalpix_URL`** – Game server URL (e.g. `http://127.0.0.1:80` or your Nginx in front of kalpix). Used for login and all admin RPCs.
- **`kalpix_SERVER_KEY`** – Server key (see `.env.example`). No Kalpsite-specific admin credentials; admin is verified from kalpix DB.

---

## Quick reference

| Page            | Path           | Purpose                          |
|-----------------|----------------|----------------------------------|
| Home            | `/`            | Public marketing site            |
| Admin login     | `/admin/login` | Log in with kalpix Dashboard username and password      |
| Admin dashboard | `/admin`       | Links to Store, Stats, Bundles, Sync |
| Store items     | `/admin/store` | Catalog, add/edit/delete items   |
| Purchase stats  | `/admin/stats` | Sales and revenue                |
| Bundles         | `/admin/bundles` | Create/delete bundles          |
| Sync            | `/admin/sync`  | Sync avatars and store items     |
