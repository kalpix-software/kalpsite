# Chat Shop — Admin Guide

A complete reference for using the kalpsite Chat Shop admin: what each page
does, what every RPC does, the exact request/response shapes on the wire, how
CDN uploads flow, and the operational patterns admins should follow.

This document is the contract between kalpsite (admin UI) and kalpix-backend
(Go server). When shapes change on one side, update the other and this guide
in the same PR.

> **Breaking changes — 2026-04-22 refactor.**
>
> - Five admin RPCs renamed to the `admin_*` prefix. The kalpsite TS
>   client (`lib/chat-shop-api.ts`) was updated in the same change; if
>   you have local scripts pinning the old names, update them:
>   `chat_shop/sync` → `chat_shop/admin_upsert_item`,
>   `chat_shop/publish_item` → `chat_shop/admin_publish_item`,
>   `chat_shop/archive_item` → `chat_shop/admin_archive_item`,
>   `chat_shop/list_items_admin` → `chat_shop/admin_list_items`,
>   `chat_shop/grant_item_to_user` → `chat_shop/admin_grant_item`.
> - Price wire shape flattened to match avatar/store: scalar
>   `currencyType` (`"coins" | "gems" | "free"`) + `price` (number) +
>   optional `discountedPrice` (number, must be `< price`). The old
>   `{ currency, amount }` object is gone. `discountedPercent` is
>   computed server-side and returned only on read paths.
> - `chat_shop/admin_list_items` now uses **cursor pagination** (the old
>   `offset` field is gone). Pass `cursor` (empty on first page) and
>   read `nextCursor` from the response (empty when exhausted). Total
>   count is still returned for "X of N" headers.
> - `chat_shop/admin_grant_item` accepts an optional `requestId` (UUID
>   v4); reuse it on retries — the backend deduplicates for 24h via the
>   shared idempotency store.
> - New error codes worth catching: `1100 ITEM_NOT_OWNED` (user-side),
>   `1101 SHOP_VERSION_STALE` (admin write conflict — refetch + retry).

---

## 1. Who talks to what

```
┌────────────────┐   multipart PUT     ┌───────────────┐
│ Admin browser  │────────────────────▶│ Cloudflare R2 │
│  (kalpsite)    │  (via upload proxy) │    (CDN)      │
└──────┬─────────┘                     └───────────────┘
       │
       │ JSON over /api/admin/rpc
       ▼
┌────────────────┐   kalpix socket    ┌──────────────────┐
│ Next.js server │───────────────────▶│ kalpix-backend   │
│ (kalpsite API) │                    │ (Go, chatshop pkg)│
└────────────────┘                    └──────────────────┘
```

Two wire channels:

1. **`POST /api/admin/upload`** — kalpsite's own Next.js route. Accepts
   multipart/form-data, verifies the admin session, streams the file to R2,
   returns `{ publicUrl, key }`. The admin UI drops that `publicUrl` into
   the right field of a sync payload.
2. **`POST /api/admin/rpc`** — proxy that forwards an authenticated RPC
   to the kalpix backend socket. Body shape:
   ```json
   { "rpcId": "chat_shop/admin_upsert_item", "payload": "<JSON string>" }
   ```
   Response shape:
   ```json
   { "success": true, "data": { ... } }
   ```
   or on failure
   ```json
   { "success": false, "error": { "message": "…" } }
   ```

All `chat_shop/*` RPCs (except read endpoints used by the game client) are
**admin-gated server-side**. kalpsite does not bypass auth — the backend
re-checks on every call.

---

## 2. Data model cheat-sheet

Everything the Chat Shop stores lives in one of these Postgres tables:

- `store_items` — generic catalogue row (slug, name, price, status, rarity,
  availability window, is_default, preview_allowed, vertical='chat', type=subcategory).
- `chat_bubble_styles`, `chat_backgrounds`, `chat_fonts`, `chat_themes` —
  typed detail rows, one-per-item, FK to `store_items.item_id`.
- `chat_sticker_packs` + `chat_sticker_assets`, `chat_gif_packs` +
  `chat_gif_assets`, `chat_emote_packs` + `chat_emote_assets` — packs have a
  cover row plus ordered child assets.
- `user_inventory` — ownership rows, with a new `source` column that
  distinguishes `purchase | gift | reward | default | theme_bundle | admin_grant | promo`.
- `user_chat_preferences` + `user_appearance_preferences` — per-user selection
  (separate from ownership).
- `shop_versions` — single-row counter bumped on every admin write; drives
  client ETag / cache invalidation.

The **seven chat sub-categories** (the values you pass as `subcategory` in
every payload):

| value | display | detail table | assets key |
|---|---|---|---|
| `theme` | Themes | `chat_themes` | `assets.theme` |
| `bubble_style` | Bubble styles | `chat_bubble_styles` | `assets.bubbleStyle` |
| `background` | Backgrounds | `chat_backgrounds` | `assets.background` |
| `font` | Fonts | `chat_fonts` | `assets.font` |
| `emote_pack` | Emote packs | `chat_emote_packs` + `chat_emote_assets` | `assets.pack` |
| `sticker_pack` | Sticker packs | `chat_sticker_packs` + `chat_sticker_assets` | `assets.pack` |
| `gif_pack` | GIF packs | `chat_gif_packs` + `chat_gif_assets` | `assets.pack` |

---

## 3. The upload channel

### POST /api/admin/upload

Used by the `AssetUploader` widget under the hood. You do not call this
directly from the RPC layer — the admin UI runs it when a file is chosen.

**Request (multipart/form-data):**

| field | value |
|---|---|
| `itemType` | **must be `chat_item`** for Chat Shop uploads |
| `category` | literal string `chat` |
| `subcategory` | one of the seven sub-category values (e.g. `bubble_style`) |
| `fileName` | original filename (the server sanitises it) |
| `file` | the raw binary |

**Content-type allowlist (server-side):** `image/webp`, `image/png`,
`image/jpeg`, `image/gif`, `application/json`, `text/plain`. Fonts travel as
`application/octet-stream` today — if you need to enforce `.ttf` vs `.otf`
at upload time, extend the allowlist in `app/api/admin/upload/route.ts`.

**Response (200):**
```json
{
  "success": true,
  "publicUrl": "https://<your-R2-public-host>/chat/items/<subcategory>/<ts><ext>",
  "key":       "chat/items/<subcategory>/<ts><ext>"
}
```

**Response (error):**
```json
{ "error": "Content type \"image/bmp\" not allowed" }
```

Key points:

- Files **never touch the browser→backend path**. Next.js uploads straight
  to R2 with its server credentials.
- The admin's role is verified every upload via a backend `social/get_profile_info`
  RPC probe. If the session is invalid, 401.
- Uploaded files land under `chat/items/{subcategory}/` on R2. The returned
  `publicUrl` goes straight into the RPC payload (e.g. as
  `assets.bubbleStyle.sentImageUrl`).

Admin workflow implication: **always upload all assets first, then call
`chat_shop/admin_upsert_item`** with the returned URLs. The upsert RPC
trusts whatever URLs you hand it.

---

## 4. Admin RPCs — what each does

Every RPC below goes over `POST /api/admin/rpc` with body
`{ rpcId, payload }`. Responses are wrapped as `{ success, data }`. The `data`
object structure below is what you receive inside `data`.

### 4.1 `chat_shop/admin_upsert_item` — Upsert a Chat Shop item

**What it does.** Idempotent upsert: creates or updates one chat-shop item
plus its matching detail row in a single database transaction, then bumps
`shop_versions.version`. Clients with a cached shop will see the ETag change
and refetch on their next call.

**Uniqueness.** Keyed by `slug` (unique in `store_items`). If you pass a slug
that already exists, the row is updated. If not, a new UUID item_id is generated
and returned.

**Request payload (JSON encoded as a string in the `payload` field):**

```json
{
  "itemId":         "optional-uuid-for-updates",
  "subcategory":    "bubble_style",
  "slug":           "chat_bubble_cloud_red",
  "name":           "Red Cloud",
  "description":    "Warm gradient bubble.",
  "iconUrl":        "https://cdn/.../thumb.webp",
  "previewUrl":     "https://cdn/.../preview.webp",
  "currencyType":    "coins",
  "price":           500,
  "discountedPrice": 350,
  "rarity":         "rare",
  "status":         "draft",
  "sortOrder":      0,
  "isDefault":      false,
  "previewAllowed": true,
  "availableFrom":  1735689600,
  "availableUntil": 1736294400,
  "assets": {
    "bubbleStyle": {
      "sentImageUrl":        "https://cdn/.../sent.png",
      "sentCenterSlice":     { "x": 60, "y": 40, "w": 4, "h": 4 },
      "sentPadding":         { "t": 12, "r": 48, "b": 12, "l": 20 },
      "sentTextColor":       "#FFFFFF",
      "receivedImageUrl":    "https://cdn/.../recv.png",
      "receivedCenterSlice": { "x": 60, "y": 40, "w": 4, "h": 4 },
      "receivedPadding":     { "t": 12, "r": 20, "b": 12, "l": 48 },
      "receivedTextColor":   "#222222",
      "timestampColor":      "#FFFFFFB3",
      "minBubbleWidthPx":    60
    }
  }
}
```

Exactly **one** key under `assets` is required — the one that matches the
`subcategory`. Other keys are ignored. Required inner shape by subcategory:

| `subcategory` | required assets key | what it must contain |
|---|---|---|
| `bubble_style` | `bubbleStyle` | sent+received image URLs, `{x,y,w,h}` center-slice, `{t,r,b,l}` padding, text colors, timestamp color (default `#FFFFFFB3`), `minBubbleWidthPx` (0..500) |
| `background` | `background` | `imageUrl`, `widthPx > 0`, `heightPx > 0`, `tileable`, optional `blurhash` |
| `font` | `font` | `fontFamily`, `fontFileUrl`, `supportedWeights` (number array), `fallbackFamily`, optional `licenseUrl` |
| `theme` | `theme` | at least one of `bubbleStyleId` / `backgroundId` / `fontId` (uuids that already exist in `store_items`), `accentColor` |
| `sticker_pack` / `gif_pack` / `emote_pack` | `pack` | `coverUrl`, optional `items[]`. For emote packs, each item needs a `shortcode`. For gif packs each item may include a static `previewUrl`. |

**Server validation (hard rejects):**

- `slug` must match `^[a-z0-9][a-z0-9_]{1,63}$`.
- `currencyType` ∈ `coins | gems | free`. If `free`, `price` must be 0.
- `discountedPrice` (when set) must be in `[0, price)` — strictly less than
  `price`. The currency is implicit (same as `currencyType`).
- `rarity` ∈ `common | rare | epic | legendary`.
- `status` ∈ `draft | active | hidden | archived`.
- `availableFrom ≤ availableUntil` when both set.
- Color fields must be `#RRGGBB` or `#RRGGBBAA`.
- `isDefault: true` is rejected if another default already exists for the
  same subcategory (partial unique index `idx_store_items_one_default_per_vertical_type`).
  You must first demote the current default (set `isDefault: false`), then
  promote the new one in a second sync call.

**Behavior on updates:**

- When `slug` matches an existing row, **all scalar fields on store_items are
  overwritten** with what you send. This is wholesale update semantics.
- For **packs**, the `items[]` array **replaces the existing contents
  wholesale** — old rows in `chat_*_assets` are deleted and the new ones
  inserted. Omitting `items` entirely (undefined) leaves the existing
  contents untouched; sending `[]` clears them.

**Response (success):**
```json
{
  "success": true,
  "data": {
    "itemId":      "a17b2e74-1b5f-4b3e-8e53-cf1f9f4a1de0",
    "shopVersion": 42
  }
}
```

**Common errors:**

| server message | cause |
|---|---|
| `invalid payload: slug must be lowercase alphanumeric+underscore (2-64 chars)` | slug failed the regex |
| `invalid payload: assets.bubbleStyle is required` | subcategory/assets mismatch |
| `invalid payload: bubbleStyle: centerSlice must be {x,y,w,h}` | missing a key in the JSON slice object |
| `invalid payload: theme must reference at least one component` | empty theme |
| `invalid payload: theme.bubbleStyleId references non-chat item` | FK component isn't a chat item |
| `upsert store_items: duplicate key value violates unique constraint "idx_store_items_one_default_per_vertical_type"` | second default for this subcategory |

---

### 4.2 `chat_shop/admin_publish_item` — Flip an item to `status=active`

**What it does.** Updates one row in `store_items` setting `status='active'`
and `is_active=true`, bumps `shop_versions.version`. Nothing else.

Use this when you saved an item as `draft` (to QA it in a staging client)
and are now ready to expose it in the shop.

**Request:**
```json
{ "itemId": "a17b2e74-1b5f-4b3e-8e53-cf1f9f4a1de0" }
```

**Response:**
```json
{ "success": true, "data": { "shopVersion": 43 } }
```

**Errors:**

- `item not found` — bad UUID or item already deleted.

---

### 4.3 `chat_shop/admin_archive_item` — Hide an item from the shop permanently

**What it does.** Sets `status='archived'`, `is_active=false`, bumps shop
version. Users who already own the item keep their inventory rows and can
keep using it — it simply disappears from the shop listing.

**Never** delete items. Archive is the right end-of-life for retired content
because `user_inventory.item_id` has an `ON DELETE RESTRICT` FK to
`store_items.item_id`.

**Request:**
```json
{ "itemId": "a17b2e74-1b5f-4b3e-8e53-cf1f9f4a1de0" }
```

**Response:**
```json
{ "success": true, "data": { "shopVersion": 44 } }
```

---

### 4.4 `chat_shop/admin_list_items` — List items including drafts

**What it does.** Admin-mode listing that returns `store_items` rows of
vertical=`chat`, including ones in `draft`, `hidden`, and `archived`. This is
the data that powers the main table on the Chat Shop admin page.

Unlike the client-facing `chat_shop/get_all`, this does **not** join the
detail tables — it returns only the generic metadata needed for the table
view (slug, name, status, rarity, updated_at, is_default). To see a single
item's full detail, use the "Edit" button (which re-opens an assets form,
albeit scaffolded from defaults — see Limitations below).

**Request:**
```json
{
  "subcategory": "bubble_style",
  "statuses":    ["draft", "active"],
  "limit":       50,
  "cursor":      ""
}
```

All fields optional:

- `subcategory`: empty = all seven sub-categories.
- `statuses`: empty = all four states.
- `limit`: default 50, clamped to 200.
- `cursor`: empty on the first page; pass `nextCursor` from the previous
  response to load subsequent pages. The cursor is opaque (base64URL of
  `<updatedAt>|<itemId>`) — don't try to construct it on the client.
  Order is `updated_at DESC, item_id DESC`.

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "itemId":     "uuid",
        "subcategory":"bubble_style",
        "slug":       "chat_bubble_cloud_red",
        "name":       "Red Cloud",
        "status":     "draft",
        "isDefault":  false,
        "rarity":     "rare",
        "updatedAt":  1761312000
      }
    ],
    "nextCursor": "MTc2MTMxMjAwMHxhMTdiMmU3NC0xYjVmLTRiM2UtOGU1My1jZjFmOWY0YTFkZTA=",
    "total": 37
  }
}
```

`nextCursor` is empty when no more pages exist. Pass it back as `cursor`
on the next call.

---

### 4.5 `chat_shop/admin_grant_item` — Customer-support grant

**What it does.** Inserts a row into `user_inventory` for a specific user
without going through the purchase flow. Used for CS apology credits,
influencer seeding, event rewards, etc.

Idempotent: re-granting an already-owned item is a no-op, not an error.

**Theme explosion.** If the item is a `theme`, the RPC **also** inserts
inventory rows for each non-null bundled component (`bubble_style_id`,
`background_id`, `font_id`) with `source='theme_bundle'`. This matches the
purchase-path theme explosion so the user gets the full bundle on day one.

**Request:**
```json
{
  "userId":    "00000000-0000-0000-0000-000000000000",
  "itemId":    "a17b2e74-1b5f-4b3e-8e53-cf1f9f4a1de0",
  "source":    "admin_grant",
  "endsAt":    1767225600,
  "requestId": "client-uuid-v4"
}
```

- `source`: one of `gift | reward | admin_grant | promo`. Default
  `admin_grant`. Writes the same column the CS analytics dashboards read from.
- `endsAt`: optional unix timestamp for time-boxed ownership (event-exclusive
  items). Omit for permanent grants.
- `requestId`: optional UUID v4. When provided, the backend deduplicates
  retries with the same `requestId` for 24h via the shared idempotency
  store, so a CS rep double-clicking "Grant" doesn't fan out a second
  theme-bundle explosion.

**Response:**
```json
{
  "success": true,
  "data": {
    "granted": true,
    "inventoryAdds": [
      "a17b2e74-…",   // the theme item
      "c2380e3e-…",   // bundled bubble
      "9675a66d-…",   // bundled background
      "c7908fcb-…"    // bundled font
    ]
  }
}
```

`inventoryAdds` is the list of item_ids that were *newly* inserted. Items
the user already owned are excluded (ON CONFLICT DO NOTHING is silent).

**Errors:**

- `userId and itemId are required`
- `chat item not found: <uuid>` — bad item_id or item is not in the chat vertical
- `invalid source: <value>`

---

## 5. The kalpsite UI pages

Everything above hangs off one screen: **Catalog → Chat Shop** in the admin
sidebar.

### Chat Shop page anatomy

```
┌─ Chat Shop ──────────────────────────────────────── Refresh ┐
│                                                             │
│ [Themes] [Bubble styles] [Backgrounds] [Fonts] [Emote …]    │  ← subcategory tabs
│                                                             │
│ Status: [All] [Draft] [Active] [Hidden] [Archived]   + New  │  ← filter + create
│                                                             │
│ ┌ item table ──────────────────────────────────────────────┐│
│ │ Name │ Slug │ Rarity │ Status │ Default │ Updated │ Actions││
│ ├──────┼──────┼────────┼────────┼─────────┼─────────┼────────┤│
│ │  …   │  …   │   …    │   …    │   …     │   …     │ ⬆ ✏ 🎁 📦││
│ └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

Row actions:

- ⬆ **Publish** — only when item is non-active. Calls `publish_item`.
- ✏ **Edit** — opens the drawer. See limitations below.
- 🎁 **Grant** — opens grant dialog, calls `grant_item_to_user`.
- 📦 **Archive** — only when item is non-archived. Calls `archive_item`.

### The "New / Edit" drawer

Top half — common metadata that maps to `store_items`:

- Slug (lowercase, unique — enforces the regex).
- Display name, description.
- Rarity, Status, Currency + Price, Sort order.
- `is_default`, `preview_allowed` checkboxes.
- Optional `availableFrom` / `availableUntil` date-time pickers.

Bottom half — subcategory-specific assets form. Picks the right widget from
`SubcategoryFields.tsx` based on `subcategory`:

- **Bubble style.** Two upload fields (sent, received). Four numeric inputs
  per side for center-slice (x/y/w/h). Four numeric inputs per side for
  padding (t/r/b/l). Text-colour hex fields. Min bubble width.
- **Background.** One upload, width+height numbers, tileable checkbox,
  optional blurhash.
- **Font.** Family name, fallback, comma-separated weights, file upload,
  license URL.
- **Theme.** Three dropdowns populated by calling `chat_shop/admin_list_items`
  for bubble_style / background / font. Dropdowns show every item in those
  sub-categories (including drafts, so you can compose themes against
  upcoming content). Plus accent colour.
- **Sticker / GIF / Emote packs.** Pack cover upload + repeatable item list
  with per-item media upload + (gif-pack only) a preview-URL input +
  (emote-pack only) a required shortcode input + tags + sort order.

### Save button semantics

- "Save" posts to `chat_shop/admin_upsert_item`. Status in the form is honoured. If you
  pick `active`, the item is live immediately. If you pick `draft`, it
  remains invisible to players until you click Publish.
- On success the drawer closes, the table refreshes, and a toast appears.
- On server validation failure a red error line appears under the form; no
  row is written (the whole sync runs in one Postgres transaction).

### Grant dialog

Minimal UI — user ID (UUID) + source dropdown (`admin_grant` default). Calls
`grant_item_to_user` and shows how many inventory rows were actually added
(1 for ordinary items, up to 4 for themes).

---

## 6. Typical admin workflows

### 6.1 Shipping a new bubble style

1. Open Chat Shop → Bubble styles tab → **New bubble style**.
2. Fill metadata (slug `chat_bubble_sunset`, name "Sunset Bubble", rarity
   `rare`, price `coins/500`, status `draft`).
3. In the assets form:
   a. **Upload sent image** — click Upload, pick the PNG. The uploader
      posts to `/api/admin/upload` with `itemType=chat_item, subcategory=bubble_style`.
      On success the public R2 URL is written into `sentImageUrl`.
   b. **Upload received image** — same flow.
   c. Set center-slice + padding on both sides so the 9-slice stretcher
      works (tip: use a 2-pixel stretchable strip in the middle of each
      image, e.g. `{x:60, y:40, w:4, h:4}`).
   d. Set text colours and timestamp colour.
4. **Save.** You get back `{ itemId, shopVersion }`. The row shows up in the
   table under Draft.
5. QA in a staging client: the Flutter app with an admin session can already
   see drafts if you extend its listing query; the player-facing app will
   not see the row yet.
6. **Publish** (row action). Item flips to active, shop version bumps again,
   the next `chat_shop/get_all` call from any client returns the new item.

### 6.2 Creating a themed bundle

1. Make sure the component items (bubble + background + font) already exist
   and are at least in `draft` so the theme dropdowns can find them.
2. New theme → pick the component IDs in the dropdowns, set accent colour,
   save.
3. Publish the theme.
4. Players who buy the theme will automatically receive inventory rows for
   the bundled components too (backend's `ExplodeThemeOnPurchase` handles
   this in the same transaction as the purchase).

### 6.3 Setting a new default item

Only **one** item per (vertical, subcategory) can be the default. To rotate:

1. Find the current default (filter by Default column or look at live app
   behavior — the seeded item on new accounts).
2. Edit it, uncheck `is_default`, save (its detail row stays — only the flag
   flips).
3. Edit the new item, check `is_default`, save. The partial unique index
   now allows it.

If you try to save the new default first without demoting the old one, the
backend rejects with a Postgres duplicate-key error. The UI surfaces the
message verbatim.

### 6.4 Running a limited-time event item

1. Create the item. Set `availableFrom` to the launch timestamp,
   `availableUntil` to the end-of-event timestamp (unix seconds).
2. Save as `active` — **players still won't see it until `availableFrom`**
   because `chat_shop/get_all` reads from the `store_items_live` view which
   filters by the availability window.
3. At end-of-event the item disappears from the shop automatically. Players
   who bought it keep it — ownership rows outlive the availability window.

### 6.5 Customer-support grant

1. Copy the item's UUID from the table (double-click the row in dev tools if
   kalpsite doesn't expose it directly; admins can also copy from the edit
   drawer once opened).
2. Click the 🎁 icon in the row. Paste user UUID, leave source as
   `admin_grant`, Grant.
3. For themes, the response `inventoryAdds` will typically have 4 entries.
   For standalone items, 1 entry. For already-owned items, 0 entries and
   `granted: true` — the call is idempotent.

### 6.6 Retiring an item

1. Click the 📦 icon. Confirm.
2. Item flips to `archived`; disappears from the shop listing.
3. Owners continue to render it — inventory rows + detail rows remain.
4. **Never DELETE.** The DELETE would violate the FK on `user_inventory`.

---

## 7. Error model kalpsite should show the admin

Every RPC failure comes back as

```json
{ "success": false, "error": { "message": "<string>" } }
```

Surfacing rules the UI already follows:

- Validation / business errors (price mismatch, bad slug, missing required
  asset) → red inline text in the drawer or under the filter bar. No toast
  (those are reserved for successful state transitions).
- Network / 500 / auth errors → red error line, don't clear the form.
- Admin-not-authorized (expired session) → the top-level `AdminLayout` hook
  catches it on the next fetch and redirects to `/admin/login`.

Known error message shapes to watch for in automated flows:

| startsWith | meaning |
|---|---|
| `invalid payload:` | client-side payload error; fix and retry |
| `item not found` | wrong itemId or already deleted |
| `Admin access required` | session expired or you aren't admin |
| `You were forfeited …` | not an admin path — means a player client hit a player-only RPC |
| `duplicate key value violates unique constraint` | two defaults, two slugs, etc. |

---

## 8. Caching and the shop_version counter

Every write RPC (`sync`, `publish_item`, `archive_item`, `grant_item_to_user`)
bumps `shop_versions.version`. Client listing RPCs return this value as
`etag`. The game client sends the last ETag it saw in `ifNoneMatch`; when
server and client agree, the server short-circuits with
`{ notModified: true }`.

**What this means for admins:** after you publish/archive, the next call to
`chat_shop/get_all` from any client sees the new payload within roughly the
time it takes them to retry (there is no push notification — clients poll on
tab re-open, on app resume, or on manual refresh). If you need a forced
refresh, the current best option is to expire the Flutter client's cached
ETag via the app's own "pull to refresh" on the shop tab.

---

## 9. Limitations & known gaps

These are intentional deferrals; worth knowing because you'll hit them
immediately when using the admin:

1. **Edit does not prefill assets.** The current edit drawer reopens an item
   with its metadata but scaffolded (default) assets. This is because
   `chat_shop/admin_list_items` only returns generic item rows; it does not
   join the detail tables. Practically: when editing an existing item, upload
   files again if you want to change them, otherwise the existing assets on
   the server remain (the `ON CONFLICT DO UPDATE` only rewrites fields you
   sent a value for — but the UI currently sends defaults, which *does*
   overwrite with zeros). **Safe edit pattern: treat edit as "I'm rewriting
   the whole item," and fill in all fields.** To get "true" edit, we'll
   need to add a small `chat_shop/get_item_admin` RPC that returns the
   joined detail row.
2. **No pack contents editor for existing packs.** When editing a published
   sticker/gif/emote pack, the items list starts empty. Saving with an empty
   `items` array will not clear items (the backend only replaces when
   `items` is present); saving with a non-empty array wholesale replaces. To
   remove individual items from a live pack today, re-sync the full desired
   items list.
3. **No item search box.** Filtering is by subcategory + status only.
   Admins with many items can paginate via `cursor` (each call returns a
   `nextCursor`) and use browser find-in-page within a page.
4. **`chat_shop/admin_list_items` does not return discount/price.** The
   table shows rarity + status only, because those are the admin-only
   operational signals. Use Edit to see/set price.
5. **Hidden vs archived.** Both remove from shop listing. `hidden` is meant
   for "temporarily out" (a seasonal item you'll un-hide later). `archived`
   is meant for "retired permanently." UX-wise they're interchangeable; the
   distinction is for your own bookkeeping.

---

## 10. Minimal curl-equivalents (for debugging)

All of these go through `POST /api/admin/rpc` with body
`{ rpcId: <string>, payload: <stringified JSON> }`. Use the browser's dev
tools network tab in kalpsite to copy these as curl if you need to replay
outside the UI.

### List all draft bubble styles

```
rpcId:   chat_shop/admin_list_items
payload: {"subcategory":"bubble_style","statuses":["draft"],"limit":100,"cursor":""}
```

### Upsert a free default bubble (for first-launch bootstrap seeding)

```
rpcId:   chat_shop/admin_upsert_item
payload: {
  "subcategory":"bubble_style",
  "slug":"chat_bubble_classic",
  "name":"Classic",
  "description":"Default bubble for new users.",
  "iconUrl":"https://cdn.example/bubble_thumb.webp",
  "currencyType":"free",
  "price":0,
  "rarity":"common",
  "status":"active",
  "sortOrder":0,
  "isDefault":true,
  "previewAllowed":true,
  "assets":{
    "bubbleStyle":{
      "sentImageUrl":"https://cdn.example/sent.png",
      "sentCenterSlice":{"x":60,"y":40,"w":4,"h":4},
      "sentPadding":{"t":12,"r":48,"b":12,"l":20},
      "sentTextColor":"#FFFFFF",
      "receivedImageUrl":"https://cdn.example/recv.png",
      "receivedCenterSlice":{"x":60,"y":40,"w":4,"h":4},
      "receivedPadding":{"t":12,"r":20,"b":12,"l":48},
      "receivedTextColor":"#222222",
      "timestampColor":"#FFFFFFB3",
      "minBubbleWidthPx":60
    }
  }
}
```

### Publish an item

```
rpcId:   chat_shop/admin_publish_item
payload: {"itemId":"<uuid>"}
```

### Archive an item

```
rpcId:   chat_shop/admin_archive_item
payload: {"itemId":"<uuid>"}
```

### Grant a theme to a user (triggers bundle explosion)

```
rpcId:   chat_shop/admin_grant_item
payload: {"userId":"<uuid>","itemId":"<theme-uuid>","source":"gift","requestId":"<uuid-v4>"}
```

---

## 11. Cross-reference — backend source of truth

Keep this table handy when debugging:

| concern | file in `kalpix-backend` |
|---|---|
| Schema (chat tables, indexes, view) | `migrations/20260424000000-chat-shop-schema-up.sql` |
| `user_inventory.source` / `ends_at` | `migrations/20260424100000-chat-shop-inventory-source-up.sql` |
| Types + validators | `src/services/chatshop/validators.go` |
| Admin writes + grant + theme explosion | `src/services/chatshop/admin.go` |
| Preference writes | `src/services/chatshop/prefs_write.go` |
| Read path used by clients | `src/services/chatshop/catalog.go`, `prefs.go`, `api.go` |
| RPC handlers | `src/api/chatshop_handlers.go` |
| RPC registrations | `src/main.go` (search for `chat_shop/` and `chat_prefs/`) |
| Theme-explosion hook on purchase | `src/main.go` → `RpcStoreConfirmPurchase` + `explodeChatThemesFromPurchaseResult` |

On the kalpsite side:

| concern | file in `kalpsite` |
|---|---|
| TS types + RPC wrappers | `lib/chat-shop-api.ts` |
| Upload widget | `components/admin/chat-shop/AssetUploader.tsx` |
| Per-subcategory form bodies | `components/admin/chat-shop/SubcategoryFields.tsx` |
| Main admin page | `app/admin/chat-shop/page.tsx` |
| Nav entry | `components/admin/AdminLayout.tsx` |

---

## 12. Release checklist for new content drops

Before each drop, confirm:

1. All images are the right aspect ratio and compressed (WebP where possible).
2. Bubble center-slice + padding numbers tested in a preview app — wrong
   values stretch the art in ugly ways.
3. Font license URL populated; font file under 200KB.
4. Slug is unique and descriptive (`chat_bubble_diwali_2026` is better than
   `chat_bubble_new`).
5. Price aligned with the rest of the catalogue (use the Play View page to
   sanity-check how it compares to other rarities).
6. If it's a theme, components already exist and are `active`.
7. `availableFrom`/`availableUntil` set correctly for event items (double
   check the timezone — backend stores UTC).
8. Save as `draft` first, preview, then Publish. Publishing straight from
   the form is fine for trivial fixes, but drafts exist for a reason.

After the drop:

1. Open the Chat Shop player view (kalpsite's `/admin/play`) or the Flutter
   app to confirm the item appears.
2. Watch the error dashboard for the first 24h — validator failures in
   production mean a content-side issue (e.g. wrong image URL format), not
   a code bug.

---

End of guide.
