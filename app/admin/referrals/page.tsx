'use client';

import { useState, useEffect, useCallback } from 'react';
import { Share2, Plus, RefreshCw, Save, Power } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

// Refer and Earn admin: edit the milestone reward tiers, and review redemptions
// for fraud. Tiers are keyed on `threshold` (the qualified-friend count), which
// is also the natural key the upsert RPC uses — there is no separate id.

type MilestoneRow = {
  threshold: number;
  rewardType: string;
  rewardAmount: number;
  itemId: string;
  title: string;
  imageUrl: string;
  isActive: boolean;
  // UI-only
  saving?: boolean;
  isNew?: boolean;
};

type RawMilestone = {
  threshold?: number;
  rewardType?: string;
  rewardAmount?: number;
  itemId?: string;
  title?: string;
  imageUrl?: string;
  isActive?: boolean;
};

type ReferralRow = {
  inviteeId: string;
  inviteeUsername: string;
  referrerId: string;
  referrerUsername: string;
  code: string;
  status: string;
  deviceId?: string;
  ip?: string;
  redeemedAt: number;
  qualifiedAt?: number;
};

const inputCls =
  'w-full rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-slate-500';

function toRow(m: RawMilestone): MilestoneRow {
  return {
    threshold: m.threshold ?? 0,
    rewardType: m.rewardType ?? 'coins',
    rewardAmount: m.rewardAmount ?? 0,
    itemId: m.itemId ?? '',
    title: m.title ?? '',
    imageUrl: m.imageUrl ?? '',
    isActive: m.isActive ?? true,
  };
}

function fmtDate(unixSeconds?: number): string {
  if (!unixSeconds) return '—';
  return new Date(unixSeconds * 1000).toLocaleString();
}

export default function AdminReferralsPage() {
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ result?: string; error?: string }>({});

  const load = useCallback(async () => {
    setLoading(true);
    setStatus({});
    try {
      const [rawTiers, rawReferrals] = await Promise.all([
        callAdminRpc('referral/admin_list_milestones', '{}'),
        callAdminRpc('referral/admin_list', JSON.stringify({ limit: 100 })),
      ]);

      const tiers = unwrapAdminRpcData<{ milestones?: RawMilestone[] }>(rawTiers);
      setMilestones((tiers.milestones ?? []).map(toRow));

      const list = unwrapAdminRpcData<{ referrals?: ReferralRow[] }>(rawReferrals);
      setReferrals(list.referrals ?? []);
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = (index: number, next: Partial<MilestoneRow>) => {
    setMilestones((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...next } : row)),
    );
  };

  const save = async (index: number) => {
    const row = milestones[index];
    if (row.threshold <= 0) {
      setStatus({ error: 'Threshold must be a positive number.' });
      return;
    }
    // Mirrors the server-side guard: a tier that grants nothing at all would
    // render as an empty reward card in the app.
    if (row.rewardAmount <= 0 && !row.itemId.trim()) {
      setStatus({ error: 'A tier must grant currency, an item, or both.' });
      return;
    }

    patch(index, { saving: true });
    setStatus({});
    try {
      await callAdminRpc(
        'referral/admin_upsert_milestone',
        JSON.stringify({
          threshold: Number(row.threshold),
          rewardType: row.rewardType,
          rewardAmount: Number(row.rewardAmount),
          itemId: row.itemId.trim(),
          title: row.title,
          imageUrl: row.imageUrl,
          isActive: row.isActive,
        }),
      );
      // Re-fetch FIRST so a newly created tier lands in threshold order, then
      // set the confirmation — load() clears status on entry, so setting it
      // beforehand would wipe the message before it ever rendered.
      await load();
      setStatus({ result: `Saved tier at ${row.threshold} friends.` });
    } catch (e) {
      setStatus({ error: e instanceof Error ? e.message : String(e) });
      patch(index, { saving: false });
    }
  };

  const addTier = () => {
    setMilestones((rows) => [
      ...rows,
      {
        threshold: 0,
        rewardType: 'coins',
        rewardAmount: 0,
        itemId: '',
        title: '',
        imageUrl: '',
        isActive: true,
        isNew: true,
      },
    ]);
  };

  // Same device or IP across several invitees of one referrer is the signal a
  // farm leaves behind, so flag it inline rather than making an admin eyeball it.
  const suspicious = (row: ReferralRow): boolean => {
    if (!row.deviceId && !row.ip) return false;
    return referrals.some(
      (other) =>
        other.inviteeId !== row.inviteeId &&
        other.referrerId === row.referrerId &&
        ((!!row.deviceId && other.deviceId === row.deviceId) ||
          (!!row.ip && other.ip === row.ip)),
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-100">
          <Share2 className="h-5 w-5" /> Refer and Earn
        </h1>
        <div className="flex gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={addTier}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" /> Add tier
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Milestone tiers
        </h2>
        <p className="text-xs text-slate-500">
          Paid to the referrer once this many invitees have qualified. An invitee
          qualifies after linking a real account and reaching the qualifying
          level — never at redeem time.
        </p>

        {milestones.map((row, index) => (
          <div
            key={`${row.threshold}-${index}`}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Friends</label>
                <input
                  type="number"
                  min={1}
                  className={inputCls}
                  value={row.threshold}
                  // Threshold is the primary key: editing it on an existing row
                  // creates a second tier rather than renaming this one.
                  disabled={!row.isNew}
                  onChange={(e) => patch(index, { threshold: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Currency</label>
                <select
                  className={inputCls}
                  value={row.rewardType}
                  onChange={(e) => patch(index, { rewardType: e.target.value })}
                >
                  <option value="coins">coins</option>
                  <option value="gems">gems</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Amount</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={row.rewardAmount}
                  onChange={(e) => patch(index, { rewardAmount: Number(e.target.value) })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-xs text-slate-400">Title</label>
                <input
                  className={inputCls}
                  value={row.title}
                  onChange={(e) => patch(index, { title: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => patch(index, { isActive: !row.isActive })}
                  title={row.isActive ? 'Active' : 'Inactive'}
                  className={`flex h-[38px] items-center gap-1 rounded-lg px-3 text-sm ${
                    row.isActive
                      ? 'bg-emerald-600/20 text-emerald-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Power className="h-4 w-4" />
                </button>
                <button
                  onClick={() => save(index)}
                  disabled={row.saving}
                  className="flex h-[38px] flex-1 items-center justify-center gap-1 rounded-lg bg-indigo-600 px-3 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {row.saving ? '…' : 'Save'}
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">
                  Item ID (optional cosmetic, store_items UUID)
                </label>
                <input
                  className={inputCls}
                  placeholder="leave empty for currency-only"
                  value={row.itemId}
                  onChange={(e) => patch(index, { itemId: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Image URL</label>
                <input
                  className={inputCls}
                  value={row.imageUrl}
                  onChange={(e) => patch(index, { imageUrl: e.target.value })}
                />
              </div>
            </div>
          </div>
        ))}

        {!loading && milestones.length === 0 && (
          <p className="text-sm text-slate-500">No tiers configured.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-slate-400">
          Recent redemptions
        </h2>
        <p className="text-xs text-slate-500">
          Rows highlighted in amber share a device or IP with another invitee of
          the same referrer — the pattern a referral farm leaves behind.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-3 py-2">Invitee</th>
                <th className="px-3 py-2">Referrer</th>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">IP</th>
                <th className="px-3 py-2">Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((row) => (
                <tr
                  key={row.inviteeId}
                  className={`border-t border-slate-800 ${
                    suspicious(row) ? 'bg-amber-500/10' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-slate-200">{row.inviteeUsername}</td>
                  <td className="px-3 py-2 text-slate-200">{row.referrerUsername}</td>
                  <td className="px-3 py-2 font-mono text-slate-300">{row.code}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        row.status === 'qualified'
                          ? 'text-emerald-400'
                          : 'text-slate-400'
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {row.deviceId ? row.deviceId.slice(0, 12) : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {row.ip || '—'}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-400">
                    {fmtDate(row.redeemedAt)}
                  </td>
                </tr>
              ))}
              {!loading && referrals.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                    No redemptions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {status.result && <p className="text-sm text-emerald-400">{status.result}</p>}
      {status.error && <p className="text-sm text-red-400">{status.error}</p>}
    </div>
  );
}
