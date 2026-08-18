'use client';

import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

type Status = { enabled: boolean; backupCodesRemaining: number };

export default function AdminSecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Enrollment flow.
  const [enroll, setEnroll] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  // Disable + regenerate flows.
  const [disableCode, setDisableCode] = useState('');
  const [regenCode, setRegenCode] = useState('');

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = unwrapAdminRpcData<Status>(await callAdminRpc('auth/admin_totp_status'));
      setStatus({
        enabled: !!data.enabled,
        backupCodesRemaining: data.backupCodesRemaining ?? 0,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load 2FA status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // Render the QR code locally whenever we have a provisioning URL. The secret
  // never leaves the browser/our backend — no third-party QR service.
  useEffect(() => {
    if (!enroll?.otpauthUrl) {
      setQrDataUrl('');
      setQrError(false);
      return;
    }
    let cancelled = false;
    setQrError(false);
    QRCode.toDataURL(enroll.otpauthUrl, { width: 220, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl('');
          setQrError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [enroll?.otpauthUrl]);

  async function startEnroll() {
    setBusy(true);
    setError('');
    setBackupCodes(null);
    try {
      const data = unwrapAdminRpcData<{ secret: string; otpauthUrl: string }>(
        await callAdminRpc('auth/admin_enroll_totp')
      );
      setEnroll({ secret: data.secret, otpauthUrl: data.otpauthUrl });
      setConfirmCode('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start enrollment');
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = unwrapAdminRpcData<{ backupCodes: string[] }>(
        await callAdminRpc('auth/admin_confirm_totp', JSON.stringify({ code: confirmCode.trim() }))
      );
      setBackupCodes(data.backupCodes ?? []);
      setEnroll(null);
      setConfirmCode('');
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm code');
    } finally {
      setBusy(false);
    }
  }

  async function disable2fa(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await callAdminRpc('auth/admin_disable_totp', JSON.stringify({ code: disableCode.trim() }));
      setDisableCode('');
      setBackupCodes(null);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable 2FA');
    } finally {
      setBusy(false);
    }
  }

  async function regenerateCodes(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = unwrapAdminRpcData<{ backupCodes: string[] }>(
        await callAdminRpc('auth/admin_regenerate_backup_codes', JSON.stringify({ code: regenCode.trim() }))
      );
      setRegenCode('');
      setBackupCodes(data.backupCodes ?? []);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to regenerate backup codes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-100 mb-1">Security · Two-Factor Authentication</h1>
      <p className="text-slate-400 mb-6">
        Protect the admin dashboard with a time-based one-time code (TOTP) from an
        app like Google Authenticator or Authy, in addition to your password.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading…
        </div>
      ) : backupCodes ? (
        // One-time backup codes panel (shown right after enabling 2FA).
        <BackupCodesPanel codes={backupCodes} onDone={() => setBackupCodes(null)} />
      ) : status?.enabled ? (
        // 2FA is ON — show status + disable form.
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/40">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-emerald-300 font-medium">Two-factor authentication is ON.</p>
              <p className="text-slate-400 text-sm">
                {status.backupCodesRemaining} backup recovery code
                {status.backupCodesRemaining === 1 ? '' : 's'} remaining.
              </p>
            </div>
          </div>

          {status.backupCodesRemaining <= 3 && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/40">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              <p className="text-amber-200 text-sm">
                You&apos;re running low on backup codes. Regenerate a fresh set below
                and store them safely — they&apos;re your only way back in if you lose
                your authenticator device.
              </p>
            </div>
          )}

          <form onSubmit={regenerateCodes} className="rounded-lg border border-slate-700 p-4 space-y-3">
            <p className="text-slate-300 font-medium">Regenerate backup codes</p>
            <p className="text-slate-500 text-sm">
              Replaces your existing backup codes with a new set. Enter a current
              authenticator code (or a remaining backup code) to confirm.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={regenCode}
              onChange={(e) => setRegenCode(e.target.value)}
              placeholder="6-digit code or backup code"
              required
              className="w-full max-w-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 tracking-widest focus:ring-2 focus:ring-indigo-500"
            />
            <div>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? 'Working…' : 'Regenerate codes'}
              </button>
            </div>
          </form>

          <form onSubmit={disable2fa} className="rounded-lg border border-slate-700 p-4 space-y-3">
            <p className="text-slate-300 font-medium">Disable 2FA</p>
            <p className="text-slate-500 text-sm">
              Enter a current authenticator code (or a backup code) to confirm.
            </p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="6-digit code or backup code"
              required
              className="w-full max-w-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 tracking-widest focus:ring-2 focus:ring-indigo-500"
            />
            <div>
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-500 disabled:opacity-50"
              >
                {busy ? 'Disabling…' : 'Disable 2FA'}
              </button>
            </div>
          </form>
        </div>
      ) : enroll ? (
        // Enrollment in progress — scan QR / enter secret, then confirm a code.
        <div className="space-y-5 rounded-lg border border-slate-700 p-5">
          <p className="text-slate-300">
            1. Scan this QR code with your authenticator app (or enter the key manually):
          </p>
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <div className="bg-white p-2 rounded-lg">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="2FA QR code" width={220} height={220} />
              ) : qrError ? (
                <div className="w-[220px] h-[220px] flex items-center justify-center text-center text-xs text-slate-600 p-3">
                  Couldn&apos;t render the QR code — use the manual entry key instead.
                </div>
              ) : (
                <div className="w-[220px] h-[220px] flex items-center justify-center text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              )}
            </div>
            <div className="text-sm">
              <p className="text-slate-400 mb-1">Manual entry key:</p>
              <code className="block break-all px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-200">
                {enroll.secret}
              </code>
            </div>
          </div>

          <form onSubmit={confirmEnroll} className="space-y-3">
            <p className="text-slate-300">2. Enter the 6-digit code shown in your app to finish:</p>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              placeholder="6-digit code"
              required
              className="w-full max-w-xs px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 tracking-widest focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {busy ? 'Verifying…' : 'Enable 2FA'}
              </button>
              <button
                type="button"
                onClick={() => setEnroll(null)}
                className="px-4 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : (
        // 2FA is OFF — offer to enable.
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/40">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <p className="text-amber-200">
              Two-factor authentication is <strong>off</strong>. Your dashboard is
              protected by password only.
            </p>
          </div>
          <button
            onClick={startEnroll}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Enable 2FA'}
          </button>
        </div>
      )}
    </div>
  );
}

function BackupCodesPanel({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const text = codes.join('\n');
  function copy() {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
  return (
    <div className="space-y-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-emerald-400" />
        <p className="text-emerald-300 font-medium">2FA is now enabled. Save your backup codes.</p>
      </div>
      <p className="text-slate-400 text-sm">
        Each code works once if you lose access to your authenticator app. Store
        them somewhere safe — <strong>they won&apos;t be shown again.</strong>
      </p>
      <div className="grid grid-cols-2 gap-2 font-mono text-slate-100">
        {codes.map((c) => (
          <code key={c} className="px-3 py-2 rounded bg-slate-900 border border-slate-700 text-center">
            {c}
          </code>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="px-4 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-800"
        >
          Copy codes
        </button>
        <button
          onClick={onDone}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500"
        >
          I&apos;ve saved them
        </button>
      </div>
    </div>
  );
}
