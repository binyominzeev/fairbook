"use client";

import Avatar from "@/components/Avatar";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import { buildProfilePath } from "@/lib/profile-path";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DiscourseIndicators from "./DiscourseIndicators";
import type { DiscourseSignal } from "@/lib/ai";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

interface Author {
  id: string;
  slug?: string | null;
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
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
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

function renderTextWithLinks(text: string, className: string) {
  return (
    <p className={className}>
      {text.split("\n").map((line, lineIndex) => (
        <span key={`${lineIndex}:${line}`}>
          {lineIndex > 0 && <br />}
          {line.split(URL_PATTERN).map((part, partIndex) =>
            /^https?:\/\/\S+$/i.test(part) ? (
              <a
                key={`${lineIndex}:${partIndex}:${part}`}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-blue-600 hover:underline"
              >
                {part}
              </a>
            ) : (
              <span key={`${lineIndex}:${partIndex}`}>{part}</span>
            )
          )}
        </span>
      ))}
    </p>
  );
}

export default function CommentCard({
  comment,
  postId,
  currentUserId,
  depth = 0,
}: Props) {
  const router = useRouter();
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [localComment, setLocalComment] = useState<CommentData>(comment);
  const [localReplies, setLocalReplies] = useState<CommentData[]>(
    comment.replies ?? []
  );
  const [analysis, setAnalysis] = useState<Analysis | null>(comment.analysis);
  const [replyNotice, setReplyNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);
  const [actionNotice, setActionNotice] = useState<{
    kind: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [deleted, setDeleted] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isOwnComment = localComment.author.id === currentUserId;

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
        setReplyNotice({
          kind: data.moderation?.status === "author_only" ? "warning" : "success",
          message: data.message ?? "Comment accepted.",
        });
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
      } else {
        setReplyNotice({
          kind: "warning",
          message: data.error ?? "Failed to post reply.",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }, [replyText, postId, comment.id]);

  const submitEdit = useCallback(async () => {
    if (!editText.trim() || editText.trim() === localComment.content) {
      setShowEditForm(false);
      setEditText(localComment.content);
      return;
    }

    setSavingEdit(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/comments/${localComment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText }),
      });
      const data = await res.json();

      if (res.ok) {
        setLocalComment((prev) => ({
          ...prev,
          ...data.comment,
          replies: prev.replies,
        }));
        setAnalysis(null);
        setActionNotice({
          kind: data.moderation?.status === "author_only" ? "warning" : "success",
          message: data.message ?? "Comment updated.",
        });
        setShowEditForm(false);
        setEditText(data.comment.content);
        router.refresh();

        setTimeout(async () => {
          const aRes = await fetch(`/api/comments/${localComment.id}/analysis`);
          const aData = await aRes.json();
          if (aData.analysis) {
            setAnalysis(aData.analysis);
          }
        }, 5000);
      } else {
        setActionNotice({
          kind: "error",
          message: data.error ?? "Failed to update comment.",
        });
      }
    } finally {
      setSavingEdit(false);
    }
  }, [editText, localComment.content, localComment.id, router]);

  const deleteComment = useCallback(async () => {
    if (!confirm("Delete this comment? Replies will also be removed.")) return;

    setDeleting(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/comments/${localComment.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        setDeleted(true);
        router.refresh();
      } else {
        setActionNotice({
          kind: "error",
          message: data.error ?? "Failed to delete comment.",
        });
      }
    } finally {
      setDeleting(false);
    }
  }, [localComment.id, router]);

  const timeAgo = (date: string) => {
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (deleted) return null;

  return (
    <div className={`${depth > 0 ? "ml-3 border-l-2 border-slate-100 pl-3 sm:ml-6 sm:pl-4" : ""}`}>
      <div className="flex gap-3 py-3">
        <Avatar
          name={localComment.author.name}
          avatarUrl={localComment.author.avatarUrl}
          sizeClassName="h-8 w-8"
          textClassName="text-sm font-medium"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={buildProfilePath(localComment.author)}
              className="text-sm font-semibold text-slate-900 hover:underline"
            >
              {localComment.author.name}
            </Link>
            <span className="text-xs text-slate-400">
              {timeAgo(localComment.createdAt)}
            </span>
            {isOwnComment && (
              <>
                <button
                  onClick={() => {
                    setShowEditForm((value) => !value);
                    setEditText(localComment.content);
                    setActionNotice(null);
                  }}
                  className="text-xs text-slate-400 hover:text-blue-600"
                >
                  Edit
                </button>
                <button
                  onClick={deleteComment}
                  disabled={deleting}
                  className="text-xs text-slate-400 hover:text-red-600 disabled:text-slate-300"
                >
                  {deleting ? "Deleting…" : "Delete"}
                </button>
              </>
            )}
          </div>
          {showEditForm ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <AutoResizeTextarea
                className="min-h-20 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={editText}
                minRows={3}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                    e.preventDefault();
                    void submitEdit();
                  }
                  if (e.key === "Escape") {
                    setShowEditForm(false);
                    setEditText(localComment.content);
                  }
                }}
              />
              <div className="flex gap-2 sm:w-auto">
                <button
                  onClick={() => void submitEdit()}
                  disabled={savingEdit || !editText.trim()}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {savingEdit ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setShowEditForm(false);
                    setEditText(localComment.content);
                  }}
                  disabled={savingEdit}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            renderTextWithLinks(localComment.content, "mt-0.5 whitespace-pre-wrap text-sm text-slate-800")
          )}
          {localComment.moderationStatus === "author_only" && currentUserId === localComment.author.id && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <p className="font-medium">
                Filtered{localComment.moderationReason ? ` · ${localComment.moderationReason}` : ""}
              </p>
              <p className="mt-1 text-amber-800">
                {localComment.moderationExplanation ?? "Only you can see this comment."}
              </p>
            </div>
          )}
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
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
              <AutoResizeTextarea
                className="min-h-20 flex-1 resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm leading-6 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Write a reply…"
                value={replyText}
                minRows={3}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
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
          {replyNotice && (
            <p
              className={`mt-2 text-xs ${replyNotice.kind === "warning" ? "text-amber-700" : "text-emerald-700"}`}
            >
              {replyNotice.message}
            </p>
          )}
          {actionNotice && (
            <p
              className={`mt-2 text-xs ${actionNotice.kind === "error" ? "text-red-600" : actionNotice.kind === "warning" ? "text-amber-700" : "text-emerald-700"}`}
            >
              {actionNotice.message}
            </p>
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
