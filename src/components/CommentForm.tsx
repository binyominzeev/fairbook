"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";

interface Props {
  postId: string;
}

export default function CommentForm({ postId }: Props) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    setNotice(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setContent("");
        setNotice({
          kind: data.moderation?.status === "author_only" ? "warning" : "success",
          message: data.message ?? "Comment accepted.",
        });
        router.refresh();
      } else {
        setError(data.error ?? "Failed to post comment.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <AutoResizeTextarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add to the discussion…"
          minRows={3}
          className="min-h-24 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={submitting || !content.trim()}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
        >
          {submitting ? "…" : "Post"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && (
        <p className={`text-xs ${notice.kind === "warning" ? "text-amber-700" : "text-emerald-700"}`}>
          {notice.message}
        </p>
      )}
    </form>
  );
}
