"use client";

import { useState } from "react";

export default function AdminResendVerificationButton({ userId }: { userId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  const handleResend = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/resend-verification`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Nem sikerült elküldeni a megerősítő emailt.");
        return;
      }

      setStatus("success");
      setMessage(data.message ?? "Megerősítő email elküldve.");
    } catch {
      setStatus("error");
      setMessage("Nem sikerült elküldeni a megerősítő emailt.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={handleResend}
        disabled={isSubmitting}
        className="text-xs font-medium text-blue-700 underline underline-offset-2 transition-colors hover:text-blue-800 disabled:cursor-not-allowed disabled:text-slate-400"
      >
        {isSubmitting ? "Küldés..." : "Email megerősítő link újraküldése"}
      </button>
      {status !== "idle" && (
        <p className={`mt-1 text-[11px] ${status === "success" ? "text-emerald-700" : "text-red-600"}`}>
          {message}
        </p>
      )}
    </div>
  );
}
