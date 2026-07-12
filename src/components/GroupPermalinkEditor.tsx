"use client";

import { useState } from "react";

export default function GroupPermalinkEditor({
  groupIdOrSlug,
  initialSlug,
}: {
  groupIdOrSlug: string;
  initialSlug: string | null;
}) {
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/permalink`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update permalink.");
        return;
      }

      setSlug(data.permalinkSlug ?? slug);
      setMessage("Permalink updated.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Permalink</p>
      <div className="mt-2 flex gap-2">
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="group-slug"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
