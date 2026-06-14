"use client";

import Avatar from "@/components/Avatar";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import DiscourseIndicators from "./DiscourseIndicators";
import type { DiscourseSignal } from "@/lib/ai";

interface Author {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Analysis {
  positiveSignals: DiscourseSignal[];
  negativeSignals: DiscourseSignal[];
  neutralSignals: DiscourseSignal[];
  explanation: string;
}

interface CommentData {
  id: string;
  content: string;
  createdAt: string;
  author: Author;
  analysis: Analysis | null;
  replies?: CommentData[];
}

interface Props {
  comment: CommentData;
  postId: string;
  currentUserId: string;
  depth?: number;
}

export default function CommentCard({
  comment,
  postId,
  currentUserId,
  depth = 0,
}: Props) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localReplies, setLocalReplies] = useState<CommentData[]>(
    comment.replies ?? []
  );
  const [analysis] = useState<Analysis | null>(comment.analysis);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const submitReply = useCallback(async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId,
          parentId: comment.id,
          content: replyText,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setLocalReplies((prev) => [...prev, { ...data.comment, replies: [] }]);
        setReplyText("");
        setShowReplyForm(false);
        // Poll for analysis after a few seconds
        setTimeout(async () => {
          const aRes = await fetch(`/api/comments/${data.comment.id}/analysis`);
          const aData = await aRes.json();
          if (aData.analysis) {
            setLocalReplies((prev) =>
              prev.map((r) =>
                r.id === data.comment.id
                  ? { ...r, analysis: aData.analysis }
                  : r
              )
            );
          }
        }, 5000);
      }
    } finally {
      setSubmitting(false);
    }
  }, [replyText, postId, comment.id]);

  const timeAgo = (date: string) => {
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className={`${depth > 0 ? "ml-3 border-l-2 border-slate-100 pl-3 sm:ml-6 sm:pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <Avatar
          name={comment.author.name}
          avatarUrl={comment.author.avatarUrl}
          sizeClassName="h-8 w-8"
          textClassName="text-sm font-medium"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={`/profile/${comment.author.id}`}
              className="text-sm font-semibold text-slate-900 hover:underline"
            >
              {comment.author.name}
            </Link>
            <span className="text-xs text-slate-400">
              {timeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm text-slate-800 mt-0.5 whitespace-pre-wrap">
            {comment.content}
          </p>
          <DiscourseIndicators analysis={analysis} />
          {depth < 3 && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="text-xs text-slate-400 hover:text-blue-600 mt-1"
            >
              Reply
            </button>
          )}
          {showReplyForm && (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                className="flex-1 text-sm rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write a reply…"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submitReply();
                  }
                }}
              />
              <button
                onClick={submitReply}
                disabled={submitting || !replyText.trim()}
                className="w-full rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
              >
                Post
              </button>
            </div>
          )}
        </div>
      </div>
      {localReplies.map((reply) => (
        <CommentCard
          key={reply.id}
          comment={reply}
          postId={postId}
          currentUserId={currentUserId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
