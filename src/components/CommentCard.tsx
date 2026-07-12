"use client";

import Avatar from "@/components/Avatar";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import { buildProfilePath } from "@/lib/profile-path";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DiscourseIndicators from "./DiscourseIndicators";
import LikersListTrigger from "./LikersListTrigger";
import type { DiscourseSignal } from "@/lib/ai";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
const MAX_INDENT_DEPTH = 2;
const INITIAL_VISIBLE_REPLIES = 5;

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
  likedByCurrentUser?: boolean;
  likeCount?: number;
  replies?: CommentData[];
}

interface Props {
  comment: CommentData;
  postId: string;
  currentUserId: string;
  currentUserIsAdmin?: boolean;
  currentUserCanModerateGroup?: boolean;
  depth?: number;
  commentInsightsEnabled?: boolean;
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
  currentUserIsAdmin = false,
  currentUserCanModerateGroup = false,
  depth = 0,
  commentInsightsEnabled = true,
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
  const [appealing, setAppealing] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [hasOpenAppeal, setHasOpenAppeal] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [liked, setLiked] = useState(Boolean(comment.likedByCurrentUser));
  const [likeCount, setLikeCount] = useState(Number(comment.likeCount ?? 0));
  const [liking, setLiking] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const [expandRepliesForHash, setExpandRepliesForHash] = useState(() =>
    typeof window !== "undefined" ? window.location.hash.startsWith("#comment-") : false
  );

  const isOwnComment = localComment.author.id === currentUserId;
  const canDeleteComment = isOwnComment || currentUserCanModerateGroup;

  const submitAppeal = useCallback(async () => {
    if (!isOwnComment || currentUserIsAdmin) return;

    setAppealing(true);
    setActionNotice(null);
    try {
      const response = await fetch(`/api/comments/${localComment.id}/appeal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestText: appealText }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionNotice({
          kind: "error",
          message: data.error ?? "Failed to submit appeal.",
        });
        return;
      }

      setHasOpenAppeal(true);
      setAppealText("");
      setActionNotice({
        kind: "success",
        message: "Appeal submitted. Admin can now review this case in Dev Sidebar.",
      });
    } finally {
      setAppealing(false);
    }
  }, [appealText, currentUserIsAdmin, isOwnComment, localComment.id]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const syncHashExpansion = () => {
      setExpandRepliesForHash(window.location.hash.startsWith("#comment-"));
    };

    syncHashExpansion();
    window.addEventListener("hashchange", syncHashExpansion);
    return () => window.removeEventListener("hashchange", syncHashExpansion);
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
        setShowAllReplies(true);
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

  const toggleLike = useCallback(async () => {
    if (liking) return;

    setLiking(true);
    setActionNotice(null);
    try {
      const response = await fetch(`/api/comments/${localComment.id}/like`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setActionNotice({
          kind: "error",
          message: data.error ?? "Failed to update comment like.",
        });
        return;
      }

      setLiked(Boolean(data.liked));
      setLikeCount(Number(data.likeCount ?? 0));
    } finally {
      setLiking(false);
    }
  }, [liking, localComment.id]);

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

  const shouldIndent = depth > 0 && depth <= MAX_INDENT_DEPTH;
  const repliesExpanded = showAllReplies || expandRepliesForHash;
  const visibleReplies = repliesExpanded
    ? localReplies
    : localReplies.slice(0, INITIAL_VISIBLE_REPLIES);
  const hiddenReplyCount = Math.max(0, localReplies.length - visibleReplies.length);
  const canCollapseReplies = !expandRepliesForHash && showAllReplies && localReplies.length > INITIAL_VISIBLE_REPLIES;

  return (
    <div
      id={`comment-${localComment.id}`}
      className={`scroll-mt-24 ${shouldIndent ? "ml-3 border-l-2 border-slate-100 pl-3 sm:ml-6 sm:pl-4" : ""}`}
    >
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
            {canDeleteComment && (
              <>
                {isOwnComment && (
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
                )}
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
              {!currentUserIsAdmin && (
                <div className="mt-2 space-y-2">
                  {!hasOpenAppeal ? (
                    <>
                      <AutoResizeTextarea
                        value={appealText}
                        onChange={(event) => setAppealText(event.target.value)}
                        minRows={2}
                        placeholder="Optional note for admin (why this should be allowed)."
                        className="w-full resize-y rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-xs leading-5 text-amber-900 placeholder:text-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      />
                      <button
                        type="button"
                        onClick={() => void submitAppeal()}
                        disabled={appealing}
                        className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:opacity-60"
                      >
                        {appealing ? "Submitting..." : "Appeal this decision"}
                      </button>
                    </>
                  ) : (
                    <p className="text-[11px] text-amber-800">
                      Appeal is open. An admin will review it.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          {commentInsightsEnabled && <DiscourseIndicators analysis={analysis} />}
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void toggleLike()}
              disabled={liking}
              className={`text-xs transition-colors ${liked ? "text-blue-600" : "text-slate-400 hover:text-blue-600"} disabled:text-slate-300`}
            >
              {liked ? "♥ Liked" : "♡ Like"}
            </button>
            <LikersListTrigger kind="comment" targetId={localComment.id} likeCount={likeCount} />
            {depth < 3 && (
              <button
                onClick={() => setShowReplyForm((v) => !v)}
                className="text-xs text-slate-400 hover:text-blue-600"
              >
                Reply
              </button>
            )}
          </div>
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
      {hiddenReplyCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAllReplies(true)}
          className="mb-2 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          Show {hiddenReplyCount} more repl{hiddenReplyCount === 1 ? "y" : "ies"}
        </button>
      )}
      {canCollapseReplies && (
        <button
          type="button"
          onClick={() => setShowAllReplies(false)}
          className="mb-2 text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          Show fewer replies
        </button>
      )}
      {visibleReplies.map((reply) => (
        <CommentCard
          key={reply.id}
          comment={reply}
          postId={postId}
          currentUserId={currentUserId}
          currentUserIsAdmin={currentUserIsAdmin}
          currentUserCanModerateGroup={currentUserCanModerateGroup}
          commentInsightsEnabled={commentInsightsEnabled}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}
