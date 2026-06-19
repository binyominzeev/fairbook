"use client";

import Avatar from "@/components/Avatar";
import { buildProfilePath } from "@/lib/profile-path";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

interface Author {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
}

interface SharedPostData {
  id: string;
  permalinkPath: string;
  content?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  imageUrls?: string[];
  createdAt: string;
  author: Author;
}

type ShareTestResult = {
  moderation?: {
    status: string;
    explanation?: string | null;
  };
};

interface PostData {
  id: string;
  permalinkSlug?: string | null;
  permalinkPath: string;
  content?: string | null;
  feedSourceId?: string | null;
  moderationStatus: string;
  moderationReason?: string | null;
  moderationExplanation?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  imageUrls?: string[];
  sharedPost?: SharedPostData | null;
  createdAt: string;
  author: Author;
  likedByCurrentUser: boolean;
  sharedByCurrentUser: boolean;
  _count: { comments: number; likes: number; sharedBy: number };
  tags?: { id: string; name: string; color: string }[];
}

interface Props {
  post: PostData;
  currentUserId: string;
  showDelete?: boolean;
  showPermalinkEditor?: boolean;
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

export default function PostCard({
  post,
  currentUserId,
  showDelete,
  showPermalinkEditor,
}: Props) {
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [liked, setLiked] = useState(post.likedByCurrentUser);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [shared, setShared] = useState(post.sharedByCurrentUser);
  const [shareCount, setShareCount] = useState(post._count.sharedBy);
  const [shareContent, setShareContent] = useState("");
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"like" | "share" | null>(null);
  const [shareTesting, setShareTesting] = useState(false);
  const [lastShareTestContent, setLastShareTestContent] = useState<string | null>(null);
  const [lastShareTestResult, setLastShareTestResult] = useState<ShareTestResult | null>(null);
  const [actionError, setActionError] = useState("");
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [permalinkDraft, setPermalinkDraft] = useState(post.permalinkSlug ?? "");
  const [permalinkSaving, setPermalinkSaving] = useState(false);
  const [permalinkMessage, setPermalinkMessage] = useState<string | null>(null);

  const canEditPermalink = Boolean(showPermalinkEditor && post.author.id === currentUserId);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!lightbox) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightbox((current) => {
          if (!current) return current;
          const prevIndex =
            (current.index - 1 + current.urls.length) % current.urls.length;
          return { ...current, index: prevIndex };
        });
      }

      if (event.key === "ArrowRight") {
        setLightbox((current) => {
          if (!current) return current;
          const nextIndex = (current.index + 1) % current.urls.length;
          return { ...current, index: nextIndex };
        });
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [lightbox]);

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

  const handleShareSubmit = async () => {
    setPendingAction("share");
    setActionError("");

    try {
      const body: Record<string, unknown> = { content: shareContent };
      if (lastShareTestContent === shareContent && lastShareTestResult) {
        body.preModeration = {
          content: lastShareTestContent,
          moderation: lastShareTestResult.moderation,
        };
      }

      const res = await fetch(`/api/posts/${post.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to share post.");
        return;
      }

      setShared(true);
      setShareCount(Number(data.shareCount ?? shareCount));
      setShareComposerOpen(false);
      setShareContent("");
      const params = new URLSearchParams();
      if (typeof data.message === "string" && data.message.length > 0) {
        params.set("notice", data.message);
      }
      params.set(
        "noticeKind",
        data.moderation?.status === "author_only" ? "warning" : "success"
      );
      router.push(`/feed?${params.toString()}`);
    } finally {
      setPendingAction(null);
    }
  };

  const handleShareTest = async () => {
    if (!shareContent.trim() || !post.feedSourceId) return;

    setShareTesting(true);
    setActionError("");

    try {
      const res = await fetch("/api/posts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: shareContent,
          sharedContent: post.content,
          sharedUrl: post.sharedUrl,
          sharedTitle: post.sharedTitle,
          sharedDescription: post.sharedDescription,
          sharedSource: post.sharedSource,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to test share.");
        return;
      }

      setLastShareTestContent(shareContent);
      setLastShareTestResult(data);
    } finally {
      setShareTesting(false);
    }
  };

  const handlePermalinkSave = async () => {
    if (!canEditPermalink) return;

    setPermalinkSaving(true);
    setPermalinkMessage(null);

    try {
      const response = await fetch(`/api/posts/${post.id}/permalink`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: permalinkDraft }),
      });
      const data = await response.json();

      if (!response.ok) {
        setPermalinkMessage(data.error ?? "Failed to update permalink.");
        return;
      }

      setPermalinkDraft(String(data.permalinkSlug ?? permalinkDraft));
      setPermalinkMessage("Permalink updated.");
      if (typeof data.permalinkPath === "string" && data.permalinkPath.length > 0) {
        router.push(data.permalinkPath);
      } else {
        router.refresh();
      }
    } finally {
      setPermalinkSaving(false);
    }
  };

  const openLightbox = (urls: string[], index: number) => {
    setLightbox({ urls, index });
  };

  const shiftLightbox = (direction: -1 | 1) => {
    setLightbox((current) => {
      if (!current) return current;
      const nextIndex =
        (current.index + direction + current.urls.length) % current.urls.length;
      return { ...current, index: nextIndex };
    });
  };

  const renderImageGallery = (imageUrls: string[]) => {
    if (imageUrls.length === 0) return null;

    const renderClickableImage = (url: string, index: number, className: string) => (
      <button
        type="button"
        onClick={() => openLightbox(imageUrls, index)}
        className="block h-full w-full"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={`Post image ${index + 1}`} className={className} />
      </button>
    );

    if (imageUrls.length === 1) {
      return (
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {renderClickableImage(imageUrls[0], 0, "h-80 w-full object-cover")}
        </div>
      );
    }

    if (imageUrls.length === 2) {
      return (
        <div className="mb-3 grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
          {imageUrls.map((url, index) => (
            <div key={`${url}:${index}`} className="border border-slate-200 bg-slate-100">
              {renderClickableImage(url, index, "h-56 w-full object-cover")}
            </div>
          ))}
        </div>
      );
    }

    const visibleImages = imageUrls.slice(0, 4);
    const remainingCount = imageUrls.length - visibleImages.length;

    return (
      <div className="mb-3 grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
        {visibleImages.map((url, index) => {
          const shouldShowOverlay = index === 3 && remainingCount > 0;
          return (
            <div key={`${url}:${index}`} className="relative border border-slate-200 bg-slate-100">
              {renderClickableImage(url, index, "h-44 w-full object-cover sm:h-48")}
              {shouldShowOverlay && (
                <button
                  type="button"
                  onClick={() => openLightbox(imageUrls, index)}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-xl font-semibold text-white"
                >
                  +{remainingCount}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (deleted) return null;

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 px-3"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              shiftLightbox(-1);
            }}
            className="mr-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            aria-label="Previous image"
          >
            ←
          </button>

          <div className="max-h-[90vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.urls[lightbox.index]}
              alt={`Expanded image ${lightbox.index + 1}`}
              className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-xs text-slate-200">
              {lightbox.index + 1} / {lightbox.urls.length}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              shiftLightbox(1);
            }}
            className="ml-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            aria-label="Next image"
          >
            →
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute right-3 top-3 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            aria-label="Close lightbox"
          >
            ✕
          </button>
        </div>
      )}

      {shareComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Share to your feed</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add your own note above the shared post.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pendingAction === null) {
                    setShareComposerOpen(false);
                  }
                }}
                className="text-sm text-slate-400 transition-colors hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <textarea
                value={shareContent}
                onChange={(e) => setShareContent(e.target.value)}
                placeholder="Say something about this…"
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              {post.feedSourceId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p>
                    Test the moderation result before sharing this RSS article with your note.
                  </p>
                  <button
                    type="button"
                    onClick={handleShareTest}
                    disabled={shareTesting || !shareContent.trim()}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:border-amber-100 disabled:text-amber-300"
                  >
                    {shareTesting ? "Testing…" : "Test"}
                  </button>
                </div>
              )}

              {lastShareTestResult?.moderation?.explanation && lastShareTestContent === shareContent && (
                <p
                  className={`text-xs ${lastShareTestResult.moderation.status === "author_only" ? "text-amber-700" : "text-emerald-700"}`}
                >
                  {lastShareTestResult.moderation.explanation}
                </p>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  <span>Sharing from</span>
                  <span className="font-medium text-slate-600">{post.author.name}</span>
                  <span>·</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>

                {post.content && (
                  renderTextWithLinks(post.content, "whitespace-pre-wrap text-sm text-slate-800")
                )}

                {post.imageUrls && post.imageUrls.length > 0 && renderImageGallery(post.imageUrls)}

                {post.sharedUrl && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                    {post.sharedSource && (
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        {post.sharedSource} · External source
                      </p>
                    )}
                    {post.sharedTitle && (
                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        {post.sharedTitle}
                      </p>
                    )}
                    {post.sharedDescription && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        {post.sharedDescription}
                      </p>
                    )}
                    <p className="mt-1.5 break-all text-xs text-blue-600">{post.sharedUrl}</p>
                  </div>
                )}

                {post.sharedPost && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <span>Includes a shared post from</span>
                      <span className="font-medium text-slate-600">
                        {post.sharedPost.author.name}
                      </span>
                    </div>

                    {post.sharedPost.content && (
                      renderTextWithLinks(
                        post.sharedPost.content,
                        "whitespace-pre-wrap text-sm text-slate-800"
                      )
                    )}

                    {post.sharedPost.imageUrls &&
                      post.sharedPost.imageUrls.length > 0 &&
                      renderImageGallery(post.sharedPost.imageUrls)}

                    {post.sharedPost.sharedUrl && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                  </div>
                )}
              </div>
            </div>

            {actionError && <p className="mt-3 text-xs text-red-600">{actionError}</p>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShareComposerOpen(false)}
                disabled={pendingAction !== null}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:border-slate-100 disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShareSubmit}
                disabled={pendingAction !== null}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {pendingAction === "share" ? "Sharing…" : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}

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
                <Link href={post.permalinkPath} className="hover:text-slate-600 hover:underline">
                  {timeAgo(post.createdAt)}
                </Link>
              </div>
            </div>
          </div>
          {post.tags && post.tags.length > 0 && (
            <div className="ml-3 flex flex-wrap items-center gap-2">
              {post.tags.map((t) => (
                <span key={t.id} className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: t.color, color: "white" }}>
                  {t.name}
                </span>
              ))}
            </div>
          )}
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
        {post.content && renderTextWithLinks(post.content, "mb-3 whitespace-pre-wrap text-sm text-slate-800")}

        {post.imageUrls && post.imageUrls.length > 0 && renderImageGallery(post.imageUrls)}

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
          href={post.sharedPost.permalinkPath}
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
            renderTextWithLinks(
              post.sharedPost.content,
              "whitespace-pre-wrap text-sm text-slate-800"
            )
          )}

          {post.sharedPost.imageUrls &&
            post.sharedPost.imageUrls.length > 0 &&
            renderImageGallery(post.sharedPost.imageUrls)}

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

      {canEditPermalink && (
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Permalink slug
          </p>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={permalinkDraft}
              onChange={(e) => setPermalinkDraft(e.target.value)}
              placeholder="pl. a-bejegyzes-cime"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handlePermalinkSave}
              disabled={permalinkSaving}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
            >
              {permalinkSaving ? "Saving…" : "Save"}
            </button>
          </div>
          {permalinkMessage && (
            <p className="mt-1.5 text-[11px] text-slate-500">{permalinkMessage}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-1">
        <Link
          href={post.permalinkPath}
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
          onClick={() => {
            setActionError("");
            setShareComposerOpen(true);
          }}
          disabled={pendingAction !== null || shared}
          className={`text-xs transition-colors ${shared ? "text-blue-600" : "text-slate-500 hover:text-blue-600"} disabled:text-slate-300`}
        >
          ↻ {shareCount} share{shareCount !== 1 ? "s" : ""}
          {shared ? "d" : ""}
        </button>
        <Link
          href={post.permalinkPath}
          className="text-xs text-slate-500 hover:text-blue-600 transition-colors"
        >
          Discuss →
        </Link>
      </div>
      {actionError && (
        <p className="mt-2 text-xs text-red-600">{actionError}</p>
      )}
      </article>
    </>
  );
}
