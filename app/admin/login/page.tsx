"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          totpCode: totpRequired ? totpCode.trim() : undefined,
        }),
        credentials: "include",
      });
      const data = await res.json();

      // 2FA is enabled for this account: switch to the code-entry step.
      if (data.totpRequired) {
        setTotpRequired(true);
        setError("");
        return;
      }
      if (data.needRegister) {
        setError(data.error || "Account not verified.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      // Login succeeded and the session cookie is set by the response. Use a
      // full-page navigation (not router.push) so the browser sends the freshly
      // set cookie on the next request — a client-side push races the cookie
      // write and the layout's session check bounces back to /admin/login.
      window.location.assign("/admin");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  function resetToPasswordStep() {
    setTotpRequired(false);
    setTotpCode("");
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm p-6 rounded-xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">Kalpix Admin</h1>

        <form onSubmit={handleLogin} className="space-y-4">
          {!totpRequired ? (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Admin email"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500"
                  placeholder="Password"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm text-slate-400 mb-1">
                Authentication code
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 tracking-widest focus:ring-2 focus:ring-indigo-500"
                placeholder="6-digit code"
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                Enter the code from your authenticator app, or a backup recovery code.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading
              ? "Signing in…"
              : totpRequired
              ? "Verify code"
              : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          {totpRequired ? (
            <button
              type="button"
              onClick={resetToPasswordStep}
              className="text-indigo-400 hover:underline"
            >
              Back
            </button>
          ) : (
            <Link href="/" className="text-indigo-400 hover:underline">
              Back to site
            </Link>
          )}
        </p>
      </div>
    </div>
  );
}
