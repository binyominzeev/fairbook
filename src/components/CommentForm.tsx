"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  postId: string;
}

export default function CommentForm({ postId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setContent("");
        router.refresh();
      } else {
        setError(data.error ?? "Failed to post comment.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add to the discussion…"
        className="flex-1 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        disabled={submitting || !content.trim()}
        className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg font-medium transition-colors"
      >
        {submitting ? "…" : "Post"}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </form>
  );
}
