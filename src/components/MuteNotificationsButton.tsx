"use client";

import { useState } from "react";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { t, tf } from "@/lib/i18n";

export default function MuteNotificationsButton({
  targetUserId,
  targetName,
  initialMuted,
}: {
  targetUserId: string;
  targetName: string;
  initialMuted: boolean;
}) {
  const locale = useAppLocale();
  const [muted, setMuted] = useState(initialMuted);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggle = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/users/${targetUserId}/notification-mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ muted: !muted }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? t(locale, "notifications.preferenceUpdateFailed"));
        return;
      }

      setMuted(Boolean(data.muted));
    } catch {
      setError(t(locale, "notifications.preferenceUpdateFailed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => {
          void toggle();
        }}
        disabled={loading}
        className="whitespace-nowrap rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
      >
        {loading
          ? t(locale, "notifications.menuWorking")
          : tf(locale, muted ? "notifications.unmutePerson" : "notifications.mutePerson", {
              name: targetName,
            })}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
