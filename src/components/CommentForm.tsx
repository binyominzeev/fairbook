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
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);
  const [lastTestContent, setLastTestContent] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    setNotice(null);
    try {
      const body: any = { postId, content };
      if (lastTestContent === content && lastTestResult) {
        body.preModeration = { content: lastTestContent, moderation: lastTestResult.moderation };
      }

      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const handleTest = async () => {
    if (!content.trim()) return;
    setTesting(true);
    setError("");
    setNotice(null);
    try {
      const res = await fetch("/api/comments/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, content }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastTestContent(content);
        setLastTestResult(data);
        const kind = data.moderation?.status === "author_only" ? "warning" : "success";
        setNotice({ kind, message: data.moderation?.explanation ?? "Test completed." });
      } else {
        setError(data.error ?? "Test failed.");
      }
    } finally {
      setTesting(false);
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
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !content.trim()}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm bg-white text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 sm:w-auto"
          >
            {testing ? "Testing…" : "Test"}
          </button>
          <button
            type="submit"
            disabled={submitting || !content.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
          >
            {submitting ? "…" : "Post"}
          </button>
        </div>
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
