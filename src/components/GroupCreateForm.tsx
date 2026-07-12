"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GroupCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [visibility, setVisibility] = useState<"public" | "closed">("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/communities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          visibility,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to create group.");
        return;
      }

      const slug = data.community?.permalinkSlug ?? data.community?.id;
      if (slug) {
        router.push(`/groups/${encodeURIComponent(slug)}`);
        router.refresh();
        return;
      }

      router.refresh();
      setName("");
      setDescription("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Create Group</h2>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Group name"
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Group description and policy"
        rows={4}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
      />
      <div className="flex items-center gap-4 text-sm text-slate-700">
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="visibility"
            value="public"
            checked={visibility === "public"}
            onChange={() => setVisibility("public")}
          />
          Public
        </label>
        <label className="inline-flex items-center gap-2">
          <input
            type="radio"
            name="visibility"
            value="closed"
            checked={visibility === "closed"}
            onChange={() => setVisibility("closed")}
          />
          Closed
        </label>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
      >
        {submitting ? "Creating..." : "Create"}
      </button>
    </form>
  );
}
