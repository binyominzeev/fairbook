"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  communityId?: string;
}

export default function CreatePostForm({ communityId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [sharedTitle, setSharedTitle] = useState("");
  const [sharedSource, setSharedSource] = useState("");
  const [sharedDescription, setSharedDescription] = useState("");
  const [showLinkFields, setShowLinkFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !sharedUrl.trim()) {
      setError("Add some content or a link.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || null,
          sharedUrl: sharedUrl.trim() || null,
          sharedTitle: sharedTitle.trim() || null,
          sharedDescription: sharedDescription.trim() || null,
          sharedSource: sharedSource.trim() || null,
          communityId: communityId ?? null,
        }),
      });
      if (res.ok) {
        setContent("");
        setSharedUrl("");
        setSharedTitle("");
        setSharedSource("");
        setSharedDescription("");
        setShowLinkFields(false);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to post.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-200 p-4"
    >
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Share a thought, start a discussion…"
        rows={3}
        className="w-full text-sm text-slate-800 placeholder-slate-400 resize-none focus:outline-none"
      />

      {showLinkFields && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-slate-500">Share a link</p>
          <input
            type="url"
            placeholder="https://…"
            value={sharedUrl}
            onChange={(e) => setSharedUrl(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Headline / title"
            value={sharedTitle}
            onChange={(e) => setSharedTitle(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="text"
            placeholder="Source (e.g. Reuters, The Atlantic)"
            value={sharedSource}
            onChange={(e) => setSharedSource(e.target.value)}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <textarea
            placeholder="Brief description (optional)"
            value={sharedDescription}
            onChange={(e) => setSharedDescription(e.target.value)}
            rows={2}
            className="w-full text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}

      <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => setShowLinkFields((v) => !v)}
          className="text-left text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          🔗 {showLinkFields ? "Hide link fields" : "Add a link"}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
        >
          {submitting ? "Posting…" : "Post"}
        </button>
      </div>
    </form>
  );
}
