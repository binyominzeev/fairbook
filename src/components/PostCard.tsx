"use client";

import Avatar from "@/components/Avatar";
import { buildProfilePath } from "@/lib/profile-path";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Author {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
}

interface SharedPostData {
  id: string;
  content?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  createdAt: string;
  author: Author;
}

interface PostData {
  id: string;
  content?: string | null;
  moderationStatus: string;
  moderationReason?: string | null;
  moderationExplanation?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  sharedPost?: SharedPostData | null;
  createdAt: string;
  author: Author;
  likedByCurrentUser: boolean;
  sharedByCurrentUser: boolean;
  _count: { comments: number; likes: number; sharedBy: number };
}

interface Props {
  post: PostData;
  currentUserId: string;
  showDelete?: boolean;
}

export default function PostCard({ post, currentUserId, showDelete }: Props) {
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [liked, setLiked] = useState(post.likedByCurrentUser);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [shared, setShared] = useState(post.sharedByCurrentUser);
  const [shareCount, setShareCount] = useState(post._count.sharedBy);
  const [pendingAction, setPendingAction] = useState<"like" | "share" | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  const timeAgo = (date: string) => {
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      router.refresh();
    }
  };

  const handleLike = async () => {
    setPendingAction("like");
    setActionError("");

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update like.");
        return;
      }

      setLiked(Boolean(data.liked));
      setLikeCount(Number(data.likeCount ?? likeCount));
    } finally {
      setPendingAction(null);
    }
  };

  const handleShare = async () => {
    setPendingAction("share");
    setActionError("");

    try {
      const res = await fetch(`/api/posts/${post.id}/share`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to share post.");
        return;
      }

      setShared(true);
      setShareCount(Number(data.shareCount ?? shareCount));
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  };

  if (deleted) return null;

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-4 w-full min-w-0 overflow-hidden">
      {/* Author row */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            name={post.author.name}
            avatarUrl={post.author.avatarUrl}
            sizeClassName="h-9 w-9"
            textClassName="text-sm font-semibold"
          />
          <div className="min-w-0">
            <Link
              href={buildProfilePath(post.author)}
              className="block truncate text-sm font-semibold text-slate-900 hover:underline"
            >
              {post.author.name}
            </Link>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
              <span>{timeAgo(post.createdAt)}</span>
            </div>
          </div>
        </div>
        {showDelete && post.author.id === currentUserId && (
          <button
            onClick={handleDelete}
            className="shrink-0 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            Delete
          </button>
        )}
      </div>

      {/* Post body */}
      {post.content && (
        <p className="text-sm text-slate-800 whitespace-pre-wrap mb-3">
          {post.content}
        </p>
      )}

      {post.moderationStatus === "author_only" && post.author.id === currentUserId && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">
            Filtered{post.moderationReason ? ` · ${post.moderationReason}` : ""}
          </p>
          <p className="mt-1 text-amber-800">
            {post.moderationExplanation ?? "Only you can see this post."}
          </p>
        </div>
      )}

      {/* Shared link card */}
      {post.sharedUrl && (
        <a
          href={post.sharedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors mb-3"
        >
          {post.sharedImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.sharedImageUrl}
              alt={post.sharedTitle ?? ""}
              className="w-full h-40 object-cover"
            />
          )}
          <div className="p-3">
            {post.sharedSource && (
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                {post.sharedSource} · External source
              </p>
            )}
            {post.sharedTitle && (
              <p className="text-sm font-semibold text-slate-900 leading-snug">
                {post.sharedTitle}
              </p>
            )}
            {post.sharedDescription && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                {post.sharedDescription}
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1.5 break-all hover:underline">
              {post.sharedUrl}
            </p>
          </div>
        </a>
      )}

      {post.sharedPost && (
        <Link
          href={`/post/${post.sharedPost.id}`}
          className="mb-3 block rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300"
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>Shared from</span>
            <span className="font-medium text-slate-600">
              {post.sharedPost.author.name}
            </span>
            <span>·</span>
            <span>{timeAgo(post.sharedPost.createdAt)}</span>
          </div>

          {post.sharedPost.content && (
            <p className="whitespace-pre-wrap text-sm text-slate-800">
              {post.sharedPost.content}
            </p>
          )}

          {post.sharedPost.sharedUrl && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
              {post.sharedPost.sharedImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.sharedPost.sharedImageUrl}
                  alt={post.sharedPost.sharedTitle ?? ""}
                  className="mb-3 h-40 w-full rounded-lg object-cover"
                />
              )}
              {post.sharedPost.sharedSource && (
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  {post.sharedPost.sharedSource} · External source
                </p>
              )}
              {post.sharedPost.sharedTitle && (
                <p className="text-sm font-semibold text-slate-900 leading-snug">
                  {post.sharedPost.sharedTitle}
                </p>
              )}
              {post.sharedPost.sharedDescription && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  {post.sharedPost.sharedDescription}
                </p>
              )}
              <p className="mt-1.5 break-all text-xs text-blue-600">
                {post.sharedPost.sharedUrl}
              </p>
            </div>
          )}
        </Link>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-1">
        <Link
          href={`/post/${post.id}`}
          className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          💬 {post._count.comments} comment{post._count.comments !== 1 ? "s" : ""}
        </Link>
        <button
          type="button"
          onClick={handleLike}
          disabled={pendingAction !== null}
          className={`text-xs transition-colors ${liked ? "text-blue-600" : "text-slate-500 hover:text-blue-600"} disabled:text-slate-300`}
        >
          {liked ? "♥" : "♡"} {likeCount} like{likeCount !== 1 ? "s" : ""}
        </button>
        <button
          type="button"
          onClick={handleShare}
          disabled={pendingAction !== null || shared}
          className={`text-xs transition-colors ${shared ? "text-blue-600" : "text-slate-500 hover:text-blue-600"} disabled:text-slate-300`}
        >
          ↻ {shareCount} share{shareCount !== 1 ? "s" : ""}
          {shared ? "d" : ""}
        </button>
        <Link
          href={`/post/${post.id}`}
          className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          Discuss →
        </Link>
      </div>
      {actionError && (
        <p className="mt-2 text-xs text-red-600">{actionError}</p>
      )}
    </article>
  );
}
