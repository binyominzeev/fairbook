"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get("mode");
    if (requestedMode === "register") {
      setMode("register");
    }
  }, []);

  async function handleResendVerification() {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }

    setError("");
    setInfo("");
    setResendingVerification(true);

    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
      } else {
        setInfo(data.message ?? "Verification email sent.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setResendingVerification(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setNeedsVerification(false);
    setLoading(true);

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body =
      mode === "login" ? { email, password } : { name, email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === "EMAIL_NOT_VERIFIED") {
          setNeedsVerification(true);
        }
        setError(data.error ?? "Something went wrong.");
      } else if (mode === "register") {
        setInfo(data.message ?? "Please verify your email before signing in.");
        setMode("login");
        setNeedsVerification(true);
      } else {
        router.push("/feed");
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">fairbook</h1>
          <p className="mt-2 text-sm text-slate-500">
            Discourse with dignity and intellectual honesty
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
                  mode === m
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m === "login" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Your full name"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            {mode === "login" && (
              <div className="-mt-1 text-right">
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-blue-600 hover:text-blue-700"
                >
                  Forgot password?
                </Link>
              </div>
            )}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                {info}
              </p>
            )}
            {needsVerification && mode === "login" && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendingVerification}
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                {resendingVerification ? "Sending..." : "Resend verification email"}
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
