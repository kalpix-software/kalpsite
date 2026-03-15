import { NextRequest, NextResponse } from 'next/server';
import { gameRpc } from '@/lib/nakama';
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** Allowed RPC IDs for the admin panel. Backend still enforces is_admin for admin_* RPCs. */
const ALLOWED_ADMIN_RPC_IDS = new Set([
  'social/get_profile_info', // session check + Plazy uses this
  'admin/get_fake_user_conversations',
  'admin/get_fake_user_conversation_messages',
  'admin/send_message_as_fake_user',
  // Store – player view (same session as logged-in user)
  'store/get_wallet',
  'store/get_items',
  'store/purchase_item',
  'store/get_inventory',
  'store/equip_item',
  'store/get_deals',
  'store/purchase_deal',
  'store/get_bundles',
  'store/purchase_bundle',
  'store/get_daily_rewards',
  'store/claim_daily_reward',
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
  'store/admin_create_deal',
  'store/admin_get_item_stats',
  'store/admin_add_item',
  'store/admin_update_item',
  'store/admin_delete_item',
  'store/admin_add_bundle',
  'store/admin_delete_bundle',
  'avatar/admin_list_avatars',
  'avatar/admin_set_avatar_active',
  'avatar/sync_avatars',
]);

/**
 * Admin RPC: requires a valid game session cookie (set at Kalpsite login).
 * Only allowlisted RPC IDs are accepted. The session must be for a user with is_admin; the backend enforces that.
 */
export async function POST(req: NextRequest) {
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
