"use client";

import { useState } from "react";

export default function GroupNotificationToggle({
  groupIdOrSlug,
  initiallySubscribed,
}: {
  groupIdOrSlug: string;
  initiallySubscribed: boolean;
}) {
  const [subscribed, setSubscribed] = useState(initiallySubscribed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (loading) return;

    const nextSubscribed = !subscribed;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/notifications`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subscribed: nextSubscribed }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not update group notifications.");
        return;
      }

      setSubscribed(Boolean(data.subscribed));
    } catch {
      setError("Could not update group notifications.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:text-slate-400"
      >
        {loading
          ? "Working..."
          : subscribed
            ? "Unsubscribe group notifications"
            : "Subscribe group notifications"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
