"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Author {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface Community {
  id: string;
  name: string;
}

interface PostData {
  id: string;
  content?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  createdAt: string;
  author: Author;
  community?: Community | null;
  _count: { comments: number };
}

interface Props {
  post: PostData;
  currentUserId: string;
  showDelete?: boolean;
}

export default function PostCard({ post, currentUserId, showDelete }: Props) {
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
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

  if (deleted) return null;

  return (
    <article className="bg-white rounded-xl border border-slate-200 p-4">
      {/* Author row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600 flex-shrink-0">
            {post.author.name[0]?.toUpperCase()}
          </div>
          <div>
            <Link
              href={`/profile/${post.author.id}`}
              className="text-sm font-semibold text-slate-900 hover:underline"
            >
              {post.author.name}
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <span>{timeAgo(post.createdAt)}</span>
              {post.community && (
                <>
                  <span>·</span>
                  <Link
                    href={`/communities`}
                    className="text-blue-600 hover:underline"
                  >
                    {post.community.name}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        {showDelete && post.author.id === currentUserId && (
          <button
            onClick={handleDelete}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors"
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
            <p className="text-xs text-blue-600 mt-1.5 truncate">
              {post.sharedUrl}
            </p>
          </div>
        </a>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1 border-t border-slate-100 mt-2">
        <Link
          href={`/post/${post.id}`}
          className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          💬 {post._count.comments} comment{post._count.comments !== 1 ? "s" : ""}
        </Link>
        <Link
          href={`/post/${post.id}`}
          className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          Discuss →
        </Link>
      </div>
    </article>
  );
}
