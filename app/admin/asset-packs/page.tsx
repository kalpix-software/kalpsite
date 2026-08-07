'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Trash2, Upload } from 'lucide-react';
import { callAdminRpc, unwrapAdminRpcData } from '@/lib/admin-rpc';

/**
 * Downloadable asset packs (Tero Spine effects, sprite sheets, audio).
 *
 * The archive itself is built and uploaded outside this page: build.py stages
 * and validates it, pack.sh zips and hashes it, and the zip goes to R2 under
 * an immutable versioned key. All that gets typed here is the pointer at it,
 * which is what removes the backend redeploy that used to be needed to change
 * one version string.
 *
 * pack.sh prints exactly these fields as a Go struct literal, so the paste box
 * below reads that block directly rather than asking anyone to retype a
 * 64-character digest.
 */

interface Bundle {
  scope: string;
  version: string;
  url: string;
  sha256: string;
  sizeBytes: number;
  required: boolean;
  manifestSchema: number;
  isActive: boolean;
  publishedBy: string;
  publishedAt: number;
  updatedAt: number;
}

interface ListResponse {
  bundles: Bundle[];
  knownScopes: string[];
  envOverrides: Record<string, string[]>;
  currentSchema: number;
}

interface FormState {
  scope: string;
  version: string;
  url: string;
  sha256: string;
  sizeBytes: string;
  manifestSchema: string;
  required: boolean;
  skipVerify: boolean;
}

const EMPTY_FORM: FormState = {
  scope: 'tero',
  version: '',
  url: '',
  sha256: '',
  sizeBytes: '',
  manifestSchema: '1',
  required: true,
  skipVerify: false,
};

function formatBytes(n: number): string {
  if (!n) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(epochSeconds: number): string {
  if (!epochSeconds) return '';
  return new Date(epochSeconds * 1000).toLocaleString();
}

/**
 * Pull the fields out of the block pack.sh prints:
 *
 *   {
 *     Scope:          ScopeTero,
 *     Version:        "v7",
 *     URL:            "https://assets.kalpixsoftware.com/.../tero_v7.zip",
 *     SHA256:         "668d3e...",
 *     SizeBytes:      7686557,
 *     Required:       true,
 *     ManifestSchema: CurrentManifestSchema,
 *   },
 *
 * Every field is optional so a partial paste still fills what it can — the
 * form is reviewed before it is submitted either way. Returns null when the
 * text carries none of them, so the caller can say "that isn't the block".
 */
function parsePackBlock(text: string): Partial<FormState> | null {
  const out: Partial<FormState> = {};

  const scope = text.match(/Scope:\s*Scope(\w+)/);
  if (scope) out.scope = scope[1].toLowerCase();

  const version = text.match(/Version:\s*"([^"]+)"/);
  if (version) out.version = version[1];

  const url = text.match(/URL:\s*"([^"]+)"/);
  if (url) out.url = url[1];

  const sha = text.match(/SHA256:\s*"([0-9a-fA-F]{64})"/);
  if (sha) out.sha256 = sha[1].toLowerCase();

  const size = text.match(/SizeBytes:\s*(\d+)/);
  if (size) out.sizeBytes = size[1];

  const required = text.match(/Required:\s*(true|false)/);
  if (required) out.required = required[1] === 'true';

  // pack.sh emits the symbolic CurrentManifestSchema; a literal is honoured
  // too in case the block was hand-edited for an older client.
  const schema = text.match(/ManifestSchema:\s*(\d+)/);
  if (schema) out.manifestSchema = schema[1];

  return Object.keys(out).length ? out : null;
}

export default function AdminAssetPacksPage() {
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [paste, setPaste] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [busyRow, setBusyRow] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const raw = await callAdminRpc('assets/admin_list_bundles', '{}');
      setData(unwrapAdminRpcData<ListResponse>(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load asset packs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, Bundle[]>();
    for (const b of data?.bundles ?? []) {
      const list = map.get(b.scope) ?? [];
      list.push(b);
      map.set(b.scope, list);
    }
    return Array.from(map.entries());
  }, [data]);

  const applyPaste = () => {
    const parsed = parsePackBlock(paste);
    if (!parsed) {
      setError('Could not find any pack.sh fields in that text.');
      return;
    }
    setError('');
    setForm(f => ({ ...f, ...parsed }));
    setPaste('');
    setNotice('Form filled from the pasted block — check it, then publish.');
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setPublishing(true);
    try {
      const raw = await callAdminRpc('assets/admin_publish_bundle', JSON.stringify({
        scope: form.scope.trim(),
        version: form.version.trim(),
        url: form.url.trim(),
        sha256: form.sha256.trim(),
        sizeBytes: parseInt(form.sizeBytes, 10) || 0,
        required: form.required,
        manifestSchema: parseInt(form.manifestSchema, 10) || 0,
        skipVerify: form.skipVerify,
      }));
      const res = unwrapAdminRpcData<{ verified: boolean; envOverrides: string[] }>(raw);
      setForm({ ...EMPTY_FORM, scope: form.scope });
      setNotice(
        res.verified
          ? `Published ${form.scope} ${form.version}. The archive was downloaded and its sha256 matched.`
          : `Published ${form.scope} ${form.version} WITHOUT verification — nothing checked that the URL serves those bytes.`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const activate = async (b: Bundle) => {
    if (!confirm(`Point ${b.scope} at ${b.version}? Clients pick this up within a minute.`)) return;
    setBusyRow(`${b.scope}/${b.version}`);
    setError('');
    setNotice('');
    try {
      await callAdminRpc('assets/admin_set_active', JSON.stringify({ scope: b.scope, version: b.version }));
      setNotice(`${b.scope} is now serving ${b.version}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Activate failed');
    } finally {
      setBusyRow('');
    }
  };

  const remove = async (b: Bundle) => {
    if (!confirm(`Remove ${b.scope} ${b.version} from this list? The zip stays on R2.`)) return;
    setBusyRow(`${b.scope}/${b.version}`);
    setError('');
    setNotice('');
    try {
      await callAdminRpc('assets/admin_delete_bundle', JSON.stringify({ scope: b.scope, version: b.version }));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusyRow('');
    }
  };

  const scopes = data?.knownScopes ?? ['tero'];
  const envOverrides = data?.envOverrides ?? {};
  const input = 'px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 text-sm w-full';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Asset Packs</h1>
        <p className="text-sm text-slate-400 mt-1">
          Build the zip locally and upload it to R2 yourself, then register the pointer here.
          No backend deploy. Clients compare version strings at match entry and download when it changes.
        </p>
      </div>

      {Object.keys(envOverrides).length > 0 && (
        <div className="mb-4 p-4 rounded-xl bg-amber-950/40 border border-amber-800">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-200">
              <p className="font-medium">Environment variables are overriding what you publish here.</p>
              {Object.entries(envOverrides).map(([scope, vars]) => (
                <p key={scope} className="text-xs text-amber-300/80 mt-1">
                  <span className="font-mono">{scope}</span>: {vars.join(', ')}
                </p>
              ))}
              <p className="text-xs text-amber-300/80 mt-2">
                Env wins over the database, so publishing for these scopes will appear to succeed and change nothing.
                Unset them on the server first.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {notice && <p className="mb-4 text-sm text-emerald-400">{notice}</p>}

      <form onSubmit={publish} className="p-4 rounded-xl bg-slate-800 border border-slate-700 mb-6 space-y-3">
        <h3 className="text-sm font-medium text-slate-100">Publish a pack</h3>

        <div className="space-y-2">
          <textarea
            value={paste}
            onChange={e => setPaste(e.target.value)}
            rows={3}
            placeholder={'Paste the block pack.sh printed here to fill the form\n\n{ Scope: ScopeTero, Version: "v7", URL: "https://...", SHA256: "...", SizeBytes: 7686557, ... }'}
            className={`${input} font-mono text-xs`}
          />
          <button
            type="button"
            onClick={applyPaste}
            disabled={!paste.trim()}
            className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-medium disabled:opacity-40"
          >
            Fill form from paste
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">
            Scope
            <select
              value={form.scope}
              onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              className={`${input} mt-1`}
            >
              {scopes.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Version
            <input
              value={form.version}
              onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
              placeholder="v7"
              required
              className={`${input} mt-1`}
            />
          </label>
        </div>

        <label className="text-xs text-slate-400 block">
          URL
          <input
            value={form.url}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://assets.kalpixsoftware.com/games/tero/bundles/v7/tero_v7.zip"
            required
            className={`${input} mt-1 font-mono text-xs`}
          />
        </label>

        <label className="text-xs text-slate-400 block">
          SHA256
          <input
            value={form.sha256}
            onChange={e => setForm(f => ({ ...f, sha256: e.target.value }))}
            placeholder="64 hex characters"
            required
            className={`${input} mt-1 font-mono text-xs`}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">
            Size (bytes)
            <input
              value={form.sizeBytes}
              onChange={e => setForm(f => ({ ...f, sizeBytes: e.target.value }))}
              type="number"
              placeholder="7686557"
              required
              className={`${input} mt-1`}
            />
          </label>
          <label className="text-xs text-slate-400">
            Manifest schema
            <input
              value={form.manifestSchema}
              onChange={e => setForm(f => ({ ...f, manifestSchema: e.target.value }))}
              type="number"
              className={`${input} mt-1`}
            />
          </label>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.required}
              onChange={e => setForm(f => ({ ...f, required: e.target.checked }))}
              className="rounded"
            />
            Required — players must have this pack before they can enter a match
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={form.skipVerify}
              onChange={e => setForm(f => ({ ...f, skipVerify: e.target.checked }))}
              className="rounded"
            />
            Skip verification
            <span className="text-xs text-slate-500">
              (normally the server downloads the zip and checks the hash first)
            </span>
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={publishing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {publishing ? 'Verifying archive…' : 'Publish + activate'}
          </button>
          {publishing && !form.skipVerify && (
            <span className="text-xs text-slate-400">Downloading and hashing the zip — this takes a few seconds.</span>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-slate-400">Loading...</p>
      ) : grouped.length === 0 ? (
        <p className="text-slate-500">Nothing published yet. The server is serving its compiled-in defaults.</p>
      ) : (
        <div className="space-y-6">
          {grouped.map(([scope, versions]) => (
            <div key={scope}>
              <h2 className="text-sm font-semibold text-slate-300 mb-2 uppercase tracking-wide">{scope}</h2>
              <div className="space-y-2">
                {versions.map(b => {
                  const busy = busyRow === `${b.scope}/${b.version}`;
                  return (
                    <div
                      key={`${b.scope}/${b.version}`}
                      className={`p-4 rounded-xl border ${b.isActive ? 'bg-emerald-950/30 border-emerald-800' : 'bg-slate-800 border-slate-700'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-100">{b.version}</span>
                            {b.isActive && (
                              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> live
                              </span>
                            )}
                            {!b.required && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-900/50 text-amber-300">
                                not required
                              </span>
                            )}
                            <span className="text-xs text-slate-500">schema {b.manifestSchema}</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 font-mono truncate">{b.url}</p>
                          <p className="text-xs text-slate-500 mt-1 font-mono truncate">{b.sha256}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            {formatBytes(b.sizeBytes)} · published {formatDate(b.publishedAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {!b.isActive && (
                            <>
                              <button
                                onClick={() => activate(b)}
                                disabled={busy}
                                title="Make this the live pack"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-xs font-medium hover:bg-slate-600 disabled:opacity-40"
                              >
                                <RotateCcw className="w-3 h-3" /> Activate
                              </button>
                              <button
                                onClick={() => remove(b)}
                                disabled={busy}
                                title="Remove from this list (the zip stays on R2)"
                                className="p-2 text-red-400 hover:bg-red-900/30 rounded-lg disabled:opacity-40"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
