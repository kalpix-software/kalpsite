import { NextRequest, NextResponse } from 'next/server';
import { gameRpc } from '@/lib/kalpix-api';
import { AUTH_COOKIE_NAME, validateOrigin } from '@/lib/auth-cookie';

// assets/admin_publish_bundle downloads and hashes the archive it is being
// asked to register before it writes anything, which takes longer than the
// default function budget. Without this the proxy times out while the backend
// goes on to publish successfully, and the panel reports a failure that isn't.
export const maxDuration = 60;

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Allowed RPC IDs for the admin panel. Backend still enforces is_admin for admin_* RPCs. */
const ALLOWED_ADMIN_RPC_IDS = new Set([
  'profile/get', // session check + Plak uses this
  // Player-facing search, reused by the admin Users page to find someone by
  // username. Deliberately NOT an admin_* RPC: the backend's global scope is a
  // plain LIKE over username with no visibility filtering, which is exactly what
  // an admin needs. It reaches only id/username/display_name/avatar — no email,
  // wallet or security fields — so exposing it here widens nothing.
  'users/search',
  // Avatar identity (display name + thumbnail) and game catalog art, both
  // editable from the admin panel. Backend enforces is_admin on each.
  'avatar/admin_update_avatar',
  'game/admin_list_games',
  'game/admin_update_game',
  // Shop sub-tab labels ("Table Themes", "Card Decks"). These are copy shown
  // above a game's cosmetic tabs; which tabs exist is still derived from
  // published store items, so these only rename and reorder.
  'game/admin_list_shop_labels',
  'game/admin_upsert_shop_label',
  'game/admin_delete_shop_label',
  // Admin 2FA (TOTP) management — backend enforces is_admin on each.
  'auth/admin_totp_status',
  'auth/admin_enroll_totp',
  'auth/admin_confirm_totp',
  'auth/admin_disable_totp',
  'auth/admin_regenerate_backup_codes',
  'admin/get_fake_user_conversations',
  'admin/get_fake_user_conversation_messages',
  'admin/delete_fake_user_conversations',
  'admin/send_message_as_fake_user',
  'admin/accept_fake_user_dm_request',
  'admin/decline_fake_user_dm_request',
  // Chat (same as Plak – for consistency; bot chat uses admin/* above)
  'chat/get_messages',
  'chat/mark_messages_read',
  'chat/send_message',
  'chat/create_or_get_dm_channel',
  'chat/add_reaction',
  'chat/remove_reaction',
  'chat/join_stream',
  'chat/leave_stream',
  'media/upload',
  // Store – player view (same session as logged-in user)
  'store/get_wallet',
  'store/get_items',
  'store/purchase_summary',
  'store/confirm_purchase',
  'store/get_inventory',
  'store/equip_item',
  'store/get_deals',
  'store/purchase_deal',
  'store/get_bundles',
  'store/purchase_bundle',
  'store/get_daily_rewards',
  'store/claim_daily_reward',
  'store/admin_update_daily_reward',
  'store/get_current_season',
  'store/purchase_premium_pass',
  'store/claim_season_reward',
  'store/get_achievements',
  'store/claim_achievement_reward',
  'store/get_received_gifts',
  'store/get_sent_gifts',
  'store/accept_gift',
  'store/decline_gift',
  // Store – admin only
  'store/admin_get_wallet',
  'store/add_currency',
  'store/admin_create_deal',
  'store/admin_get_item_stats',
  'store/admin_add_item',
  'store/admin_update_item',
  'store/admin_delete_item',
  // Shelf state, separate from delete. unpublish takes an item off every shop
  // surface while owners keep it and it still equips; restore undoes both that
  // and an archive. Both accept an item id or a slug.
  'store/admin_unpublish_item',
  'store/admin_restore_item',
  'store/admin_get_upload_url',
  // IAP (in-app purchase) products – admin only
  'store/admin_get_iap_products',
  'store/admin_upsert_iap_product',
  'store/admin_delete_iap_product',
  // IAP promo banners – admin only
  'store/admin_get_iap_promos',
  'store/admin_upsert_iap_promo',
  'store/admin_delete_iap_promo',
  'store/admin_add_bundle',
  'store/admin_delete_bundle',
  'avatar/admin_list_avatars',
  'avatar/admin_set_avatar_active',
  'avatar/admin_set_avatar_assignable',
  'avatar/admin_set_default_option',
  'avatar/admin_set_option_preview',
  'avatar/sync_avatars',
  'avatar/get_character_catalog',
  'admin/set_bots_online_status',
  'admin/seed_fake_users',
  'admin/get_fake_users',
  // Account enforcement – admin only
  'admin/suspend_user',
  'admin/unsuspend_user',
  'admin/user_suspension_status',
  // Content takedown – admin only
  'chat/admin_delete_message',
  // User reports – admin only
  'chat/admin_list_user_reports',
  'chat/admin_update_report_status',
  // Message reports – admin only
  'chat/admin_list_message_reports',
  'chat/admin_update_message_report_status',
  // Chat shop – admin only (see lib/chat-shop-api.ts callers).
  'chat_shop/admin_list_items',
  'chat_shop/admin_get_pack', // load a pack's cover + items to pre-fill the edit form
  'chat_shop/admin_get_item', // load one item (meta + typed assets) to pre-fill the edit form
  'chat_shop/admin_upsert_item',
  'chat_shop/admin_publish_item',
  'chat_shop/admin_archive_item',
  'chat_shop/admin_grant_item',
  // Chat redesign Slice 4b — admin trending read + writes for the picker.
  'chat_shop/admin_list_trending',
  'chat_shop/admin_set_trending',
  // Cross-vertical shop — admin featured writes for the All-tab carousel.
  'shop/admin_set_featured',
  'shop/admin_list_featured',
  // Lounges (Plato-style public rooms) — admin only.
  'lounge/admin_list',
  'lounge/admin_upsert',
  'lounge/admin_set_active',
  // News (home-screen news posts) — admin only. news/list is app-only.
  'news/admin_list',
  'news/admin_upsert',
  'news/admin_set_published',
  'news/admin_delete',
  // Jigsaw — admin only. Packs, the puzzles inside them, and the daily-free
  // schedule. The player-facing jigsaw/get_* and the session RPCs are app-only
  // and deliberately absent: this route is the admin console's door, not a
  // general proxy.
  'jigsaw/admin_list_packs',
  'jigsaw/admin_upsert_pack',
  'jigsaw/admin_set_pack_active',
  'jigsaw/admin_delete_pack',
  'jigsaw/admin_list_puzzles',
  'jigsaw/admin_upsert_puzzle',
  'jigsaw/admin_set_puzzle_active',
  'jigsaw/admin_delete_puzzle',
  'jigsaw/admin_list_daily',
  'jigsaw/admin_set_daily',
  // Refer and Earn — admin only. get_status/redeem are app-only, and
  // referral/resolve_code is deliberately public (the /r/<code> landing page
  // calls it with no session), so neither belongs in this allowlist.
  'referral/admin_list_milestones',
  'referral/admin_upsert_milestone',
  'referral/admin_list',
  // Downloadable asset packs (Tero Spine effects, sprite sheets, audio) —
  // admin only. The zip is built and uploaded to R2 outside this system;
  // these RPCs only register the pointer at it.
  'assets/admin_list_bundles',
  'assets/admin_publish_bundle',
  'assets/admin_set_active',
  'assets/admin_delete_bundle',
  // Broadcasts (promotional push to opted-in users) — admin only.
  'notifications/admin_broadcast',
  'notifications/admin_list_broadcasts',
  'notifications/admin_delete_broadcast',
]);

/**
 * Admin RPC: requires a valid game session cookie (set at Kalpsite login).
 * Only allowlisted RPC IDs are accepted. The session must be for a user with is_admin; the backend enforces that.
 */
export async function POST(req: NextRequest) {
  // CSRF defense-in-depth (matches /api/auth/login) on top of the SameSite=Strict
  // cookie — these RPCs include state-changing 2FA enroll/disable/regenerate.
  if (!validateOrigin(req)) {
    return NextResponse.json({ error: 'Invalid origin' }, { status: 403, headers: NO_STORE });
  }
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: NO_STORE });
  }
  try {
    const { rpcId, payload } = await req.json();
    if (!rpcId || typeof rpcId !== 'string') {
      return NextResponse.json({ error: 'rpcId required' }, { status: 400, headers: NO_STORE });
    }
    if (!ALLOWED_ADMIN_RPC_IDS.has(rpcId)) {
      return NextResponse.json({ error: 'RPC not allowed' }, { status: 403, headers: NO_STORE });
    }
    const body = typeof payload === 'string' ? (payload || '{}') : JSON.stringify(payload ?? '{}');
    const result = await gameRpc(token, rpcId, body);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'RPC failed';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE });
  }
}
