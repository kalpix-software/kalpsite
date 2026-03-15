"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();

      if (data.needRegister) {
        setError(data.error || "Account not verified.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      // Login succeeded and cookie is set by the response – go to admin
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm p-6 rounded-xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">
          Kalpix Admin
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">
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
          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="text-indigo-400 hover:underline">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
