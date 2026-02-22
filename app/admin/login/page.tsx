"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "credentials" | "otp";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function clearError() {
    setError("");
  }

  // —— Login (existing account) ——
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    clearError();
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
        setError(data.error || "Account not set up. Use “Send OTP” to register, then verify.");
        return;
      }
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  // —— Start registration (send OTP) ——
  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send OTP");
        return;
      }
      setRegistrationId(data.registrationId ?? "");
      setStep("otp");
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  // —— Verify OTP and finish registration ——
  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/admin-verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, registrationId }),
        credentials: "include",
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Verification failed");
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  function backToCredentials() {
    setStep("credentials");
    setOtp("");
    setRegistrationId("");
    clearError();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="w-full max-w-sm p-6 rounded-xl bg-slate-800 border border-slate-700 shadow-xl">
        <h1 className="text-xl font-bold text-slate-100 mb-6">
          Kalpix Admin
        </h1>

        {step === "credentials" ? (
          <>
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
              <div className="flex flex-col gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
                >
                  {loading ? "Signing in…" : "Login"}
                </button>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="w-full py-2 rounded-lg bg-slate-600 text-white font-medium hover:bg-slate-500 disabled:opacity-50"
                >
                  {loading ? "Sending…" : "Register — Send OTP"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter the code sent to <strong className="text-slate-200">{email}</strong>
            </p>
            <div>
              <label className="block text-sm text-slate-400 mb-1">OTP</label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-600 text-slate-100 focus:ring-2 focus:ring-indigo-500 font-mono text-lg tracking-widest"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "Verifying…" : "Verify OTP"}
              </button>
              <button
                type="button"
                onClick={backToCredentials}
                disabled={loading}
                className="w-full py-2 rounded-lg bg-slate-600 text-white font-medium hover:bg-slate-500"
              >
                Back
              </button>
            </div>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="text-indigo-400 hover:underline">
            Back to site
          </Link>
        </p>
      </div>
    </div>
  );
}
