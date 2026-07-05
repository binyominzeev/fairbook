"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FeedSortMode } from "@/lib/feed-posts";

const SORT_LABELS: Record<FeedSortMode, string> = {
  current: "Személyre szabott",
  weighted: "Frissesség + aktivitás",
  likes: "Like-ok szerint",
  comments: "Kommentek szerint",
  time: "Legújabb elöl",
};

export default function FeedSortSelect({
  initialSort,
  saveEndpoint = "/api/users/feed-sort",
  mode,
  groupId,
  query,
}: {
  initialSort: FeedSortMode;
  saveEndpoint?: string;
  mode: "all" | "following" | "group";
  groupId: string | null;
  query: string;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<FeedSortMode>(initialSort);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const buildHref = (nextSort: FeedSortMode) => {
    const params = new URLSearchParams();

    if (mode === "following") {
      params.set("mode", "following");
    }

    if (mode === "group" && groupId) {
      params.set("group", groupId);
    }

    if (query) {
      params.set("q", query);
    }

    if (nextSort !== "current") {
      params.set("sort", nextSort);
    }

    const search = params.toString();
    return search ? `/feed?${search}` : "/feed";
  };

  const handleChange = (nextSort: FeedSortMode) => {
    setSort(nextSort);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(saveEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: nextSort }),
        });

        if (!response.ok) {
          throw new Error("Could not save feed sort mode.");
        }

        router.push(buildHref(nextSort));
      } catch {
        setSort(initialSort);
        setError("Nem sikerult menteni a rendezest.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor="feed-sort-mode">
        Rendezés
      </label>
      <div className="relative">
        <select
          id="feed-sort-mode"
          value={sort}
          onChange={(event) => handleChange(event.target.value as FeedSortMode)}
          disabled={isSaving}
          className="min-w-32 appearance-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500"
          aria-label="Rendezés"
        >
          <option value="current">{sort === "current" ? "✓ " : ""}{SORT_LABELS.current}</option>
          <option value="weighted">{sort === "weighted" ? "✓ " : ""}{SORT_LABELS.weighted}</option>
          <option value="likes">{sort === "likes" ? "✓ " : ""}{SORT_LABELS.likes}</option>
          <option value="comments">{sort === "comments" ? "✓ " : ""}{SORT_LABELS.comments}</option>
          <option value="time">{sort === "time" ? "✓ " : ""}{SORT_LABELS.time}</option>
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.094l3.71-3.864a.75.75 0 1 1 1.08 1.04l-4.25 4.425a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}