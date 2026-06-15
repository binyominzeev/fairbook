"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FeedRow = {
  id: string;
  title: string;
  rssUrl: string;
  siteUrl?: string | null;
  isActive: boolean;
  sourceWeight: number;
  lastFetchedAt?: string | null;
  page: {
    id: string;
    name: string;
    bio?: string | null;
    slug?: string | null;
  };
  _count: {
    posts: number;
  };
};

interface Props {
  feeds: FeedRow[];
}

export default function AdminFeedManager({ feeds }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [rssUrl, setRssUrl] = useState("");
  const [bio, setBio] = useState("");
  const [sourceWeight, setSourceWeight] = useState("1");
  const [slug, setSlug] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const createFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/feed-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          rssUrl,
          bio,
          sourceWeight: Number.parseFloat(sourceWeight) || 1,
          slug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to add feed.");
        return;
      }
      setName("");
      setRssUrl("");
      setBio("");
      setSourceWeight("1");
      setSlug("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  };

  const updateFeed = async (id: string, body: Record<string, unknown>) => {
    setPendingId(id);
    setError("");
    try {
      const res = await fetch(`/api/feed-sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update feed.");
        return;
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Admin feed management</h2>
        <p className="text-xs text-slate-500 mt-1">
          Add RSS feeds, sync new articles, and pause pages without removing their history.
        </p>
      </div>

      <form onSubmit={createFeed} className="space-y-3 rounded-lg bg-slate-50 p-4 border border-slate-200">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Page name, e.g. Reuters World"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="url"
            value={rssUrl}
            onChange={(e) => setRssUrl(e.target.value)}
            placeholder="https://example.com/rss.xml"
            required
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="number"
            min="0.25"
            max="5"
            step="0.25"
            value={sourceWeight}
            onChange={(e) => setSourceWeight(e.target.value)}
            placeholder="Source weight"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="Optional slug, e.g. reuters-world"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Short page description (optional)"
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Adding feed..." : "Add feed"}
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {feeds.length === 0 ? (
          <p className="text-sm text-slate-400">No RSS pages yet.</p>
        ) : (
          feeds.map((feed) => (
            <div key={feed.id} className="rounded-lg border border-slate-200 px-4 py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{feed.page.name}</p>
                  <p className="text-xs text-slate-500 break-all">{feed.rssUrl}</p>
                  <p className="text-xs text-slate-400">/{feed.page.slug ?? feed.page.id}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {feed._count.posts} imported posts
                    {` · weight ${feed.sourceWeight.toFixed(2)}`}
                    {feed.lastFetchedAt ? ` · synced ${new Date(feed.lastFetchedAt).toLocaleString()}` : " · not synced yet"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    feed.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {feed.isActive ? "Active" : "Paused"}
                </span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const formData = new FormData(event.currentTarget);
                  void updateFeed(feed.id, {
                    slug: String(formData.get("slug") ?? ""),
                  });
                }}
                className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 sm:flex-row sm:items-center"
              >
                <input
                  type="text"
                  name="slug"
                  defaultValue={feed.page.slug ?? ""}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={pendingId === feed.id}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Save slug
                </button>
              </form>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => updateFeed(feed.id, { action: "refresh" })}
                  disabled={pendingId === feed.id || !feed.isActive}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Refresh now
                </button>
                <button
                  onClick={() => updateFeed(feed.id, { isActive: !feed.isActive })}
                  disabled={pendingId === feed.id}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {feed.isActive ? "Pause feed" : "Resume feed"}
                </button>
                {feed.siteUrl && (
                  <a
                    href={feed.siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Open site
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}