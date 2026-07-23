"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import HighlightedText from "@/components/HighlightedText";
import PostCard from "@/components/PostCard";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";
import { useInfiniteCursorLoader } from "@/components/useInfiniteCursorLoader";
import {
  createAnonymousPostViewTracker,
  createRegisteredPostViewTracker,
} from "@/components/post-view-tracking";
import type {
  SerializedPost,
  SerializedProfileComment,
} from "@/lib/post-presentation";
import type {
  ProfileActivityTab,
  ProfileActivityViewMode,
} from "@/lib/profile-activity";

type ProfilePostTab = "posts" | "likes" | "bookmarks" | "hidden";

function TrackOnVisible({
  children,
  onVisible,
  disabled = false,
}: {
  children: ReactNode;
  onVisible: () => void;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (disabled) {
      return;
    }

    const element = rootRef.current;
    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          onVisible();
          observer.disconnect();
          break;
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [disabled, onVisible]);

  return <div ref={rootRef}>{children}</div>;
}

function getReelCoverImage(post: SerializedPost): string | null {
  return (
    post.imageUrls[0] ??
    post.sharedImageUrl ??
    post.sharedPost?.imageUrls[0] ??
    post.sharedPost?.sharedImageUrl ??
    null
  );
}

function getReelTitle(post: SerializedPost): string {
  return (
    post.sharedTitle ??
    post.content?.trim().slice(0, 120) ??
    post.sharedPost?.sharedTitle ??
    post.sharedPost?.content?.trim().slice(0, 120) ??
    "Untitled post"
  );
}

function InfinitePostActivityList({
  resetKey,
  profileId,
  activeTab,
  initialPosts,
  initialNextCursor,
  currentUserId,
  showDelete,
  emptyMessage,
  emptySearchMessage,
  initiallyHidden,
  requireAuthForInteractions,
  query,
  enableViewTracking,
  showUniqueViewerCount,
}: {
  resetKey: string;
  profileId: string;
  activeTab: "posts" | "likes" | "bookmarks" | "hidden";
  initialPosts: SerializedPost[];
  initialNextCursor: string | null;
  currentUserId: string;
  showDelete: (post: SerializedPost) => boolean;
  emptyMessage: string;
  emptySearchMessage: string;
  initiallyHidden: boolean;
  requireAuthForInteractions: boolean;
  query: string;
  enableViewTracking: boolean;
  showUniqueViewerCount: boolean;
}) {
  const tracker = useMemo(
    () =>
      currentUserId
        ? createRegisteredPostViewTracker("profile_card")
        : createAnonymousPostViewTracker(),
    [currentUserId]
  );

  useEffect(() => () => tracker.dispose(), [tracker]);

  const { items, hasMore, isLoading, error, sentinelRef } = useInfiniteCursorLoader({
    initialItems: initialPosts,
    initialNextCursor,
    loadPage: async (cursor) => {
      const response = await fetch(
        `/api/users/${profileId}/activity?tab=${activeTab}&cursor=${encodeURIComponent(cursor)}${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to load more posts.");
      }

      const data = (await response.json()) as {
        items: SerializedPost[];
        nextCursor: string | null;
      };

      return {
        items: data.items,
        nextCursor: data.nextCursor,
      };
    },
  });

  return (
    <div key={resetKey}>
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          {query ? emptySearchMessage : emptyMessage}
        </p>
      )}

      {items.map((post) => (
        <TrackOnVisible
          key={post.id}
          onVisible={() => tracker.queue(post.id)}
          disabled={!enableViewTracking}
        >
          <PostCard
            post={post}
            currentUserId={currentUserId}
            showDelete={showDelete(post)}
            initiallyHidden={initiallyHidden}
            requireAuthForInteractions={requireAuthForInteractions}
            highlightQuery={query}
            showUniqueViewerCount={showUniqueViewerCount}
          />
        </TrackOnVisible>
      ))}

      {items.length > 0 && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
          {isLoading ? "Loading older posts…" : hasMore ? "Scroll for older posts" : "No more posts"}
        </div>
      )}

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

function InfiniteCommentActivityList({
  resetKey,
  profileId,
  initialComments,
  initialNextCursor,
  emptyMessage,
  emptySearchMessage,
  query,
}: {
  resetKey: string;
  profileId: string;
  initialComments: SerializedProfileComment[];
  initialNextCursor: string | null;
  emptyMessage: string;
  emptySearchMessage: string;
  query: string;
}) {
  const { items, hasMore, isLoading, error, sentinelRef } = useInfiniteCursorLoader({
    initialItems: initialComments,
    initialNextCursor,
    loadPage: async (cursor) => {
      const response = await fetch(
        `/api/users/${profileId}/activity?tab=comments&cursor=${encodeURIComponent(cursor)}${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to load more comments.");
      }

      const data = (await response.json()) as {
        items: SerializedProfileComment[];
        nextCursor: string | null;
      };

      return {
        items: data.items,
        nextCursor: data.nextCursor,
      };
    },
  });

  return (
    <div key={resetKey}>
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          {query ? emptySearchMessage : emptyMessage}
        </p>
      )}

      {items.length > 0 && <div className="space-y-3">
        {items.map((comment) => (
          <article
            key={comment.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
              <span>{new Date(comment.createdAt).toLocaleString()}</span>
              <span>·</span>
              <span>On</span>
              <Link
                href={comment.post.permalinkPath}
                className="font-medium text-blue-600 hover:underline"
              >
                <HighlightedText
                  text={comment.post.sharedTitle ?? comment.post.content?.slice(0, 80) ?? "Untitled post"}
                  query={query}
                />
              </Link>
              <span>
                by <HighlightedText text={comment.post.author.name} query={query} />
              </span>
              {comment.post.sharedSource && (
                <span>
                  · <HighlightedText text={comment.post.sharedSource} query={query} />
                </span>
              )}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
              <HighlightedText text={comment.content} query={query} />
            </p>
            {comment.moderationStatus === "author_only" && (
              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p className="font-medium">
                  Filtered{comment.moderationReason ? ` · ${comment.moderationReason}` : ""}
                </p>
                <p className="mt-1 text-amber-800">
                  {comment.moderationExplanation ?? "Only you can see this comment."}
                </p>
              </div>
            )}
            <div className="mt-3">
              <Link
                href={comment.post.permalinkPath}
                className="text-xs text-slate-500 hover:text-blue-600"
              >
                Open discussion →
              </Link>
            </div>
          </article>
        ))}
      </div>}

      {items.length > 0 && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
          {isLoading ? "Loading older comments…" : hasMore ? "Scroll for older comments" : "No more comments"}
        </div>
      )}

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}

function InfiniteReelsPostActivityList({
  resetKey,
  profileId,
  activeTab,
  initialPosts,
  initialNextCursor,
  currentUserId,
  showDelete,
  emptyMessage,
  emptySearchMessage,
  initiallyHidden,
  requireAuthForInteractions,
  query,
  enableViewTracking,
  showUniqueViewerCount,
}: {
  resetKey: string;
  profileId: string;
  activeTab: ProfilePostTab;
  initialPosts: SerializedPost[];
  initialNextCursor: string | null;
  currentUserId: string;
  showDelete: (post: SerializedPost) => boolean;
  emptyMessage: string;
  emptySearchMessage: string;
  initiallyHidden: boolean;
  requireAuthForInteractions: boolean;
  query: string;
  enableViewTracking: boolean;
  showUniqueViewerCount: boolean;
}) {
  const [selectedPost, setSelectedPost] = useState<SerializedPost | null>(null);
  const tracker = useMemo(
    () =>
      currentUserId
        ? createRegisteredPostViewTracker("profile_card")
        : createAnonymousPostViewTracker(),
    [currentUserId]
  );

  useEffect(() => () => tracker.dispose(), [tracker]);

  const { items, hasMore, isLoading, error, sentinelRef } = useInfiniteCursorLoader({
    initialItems: initialPosts,
    initialNextCursor,
    loadPage: async (cursor) => {
      const response = await fetch(
        `/api/users/${profileId}/activity?tab=${activeTab}&cursor=${encodeURIComponent(cursor)}${query ? `&q=${encodeURIComponent(query)}` : ""}`
      );

      if (!response.ok) {
        throw new Error("Failed to load more posts.");
      }

      const data = (await response.json()) as {
        items: SerializedPost[];
        nextCursor: string | null;
      };

      return {
        items: data.items,
        nextCursor: data.nextCursor,
      };
    },
  });

  return (
    <div key={resetKey}>
      {items.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-400">
          {query ? emptySearchMessage : emptyMessage}
        </p>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((post) => {
            const imageUrl = getReelCoverImage(post);
            const title = getReelTitle(post);

            return (
              <TrackOnVisible
                key={post.id}
                onVisible={() => tracker.queue(post.id)}
                disabled={!enableViewTracking}
              >
                <button
                  type="button"
                  onClick={() => setSelectedPost(post)}
                  className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-slate-200 bg-slate-100 text-left"
                  aria-label="Open post preview"
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 px-3 text-center text-xs font-medium text-slate-500">
                      No image
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/40 to-transparent p-2 text-white">
                    <p className="line-clamp-2 text-xs font-medium">{title}</p>
                    <p className="mt-1 text-[11px] text-slate-300">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </button>
              </TrackOnVisible>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
          {isLoading ? "Loading older posts…" : hasMore ? "Scroll for older posts" : "No more posts"}
        </div>
      )}

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}

      {selectedPost && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 px-3 py-6"
          role="dialog"
          aria-modal="true"
          aria-label="Selected post"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedPost(null)}
              className="sticky top-2 z-10 ml-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:text-slate-900"
              aria-label="Close preview"
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                <path
                  fillRule="evenodd"
                  d="M4.28 4.22a.75.75 0 0 1 1.06 0L10 8.94l4.66-4.72a.75.75 0 1 1 1.06 1.06L11.06 10l4.66 4.72a.75.75 0 0 1-1.06 1.06L10 11.06l-4.66 4.72a.75.75 0 0 1-1.06-1.06L8.94 10 4.28 5.28a.75.75 0 0 1 0-1.06Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <PostCard
              post={selectedPost}
              currentUserId={currentUserId}
              showDelete={showDelete(selectedPost)}
              initiallyHidden={initiallyHidden}
              requireAuthForInteractions={requireAuthForInteractions}
              highlightQuery={query}
              showUniqueViewerCount={showUniqueViewerCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProfileActivitySection({
  profileId,
  activeTab,
  profileViewMode,
  initialPosts,
  initialComments,
  initialNextCursor,
  currentUserId,
  isOwnProfile,
  requireAuthForInteractions = false,
  query,
}: {
  profileId: string;
  activeTab: ProfileActivityTab;
  profileViewMode: ProfileActivityViewMode;
  initialPosts: SerializedPost[];
  initialComments: SerializedProfileComment[];
  initialNextCursor: string | null;
  currentUserId: string;
  isOwnProfile: boolean;
  requireAuthForInteractions?: boolean;
  query: string;
}) {
  const resetKey = `${activeTab}:${query}:${initialNextCursor ?? "end"}:${initialPosts[0]?.id ?? initialComments[0]?.id ?? "empty"}`;

  const searchPlaceholder =
    activeTab === "comments"
      ? "Search comments and discussed posts"
      : "Search posts, source, author or tags";

  if (activeTab === "comments") {
    return (
      <>
        <div className="px-1">
          <QuerySyncSearchInput
            initialValue={query}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          />
        </div>
        <InfiniteCommentActivityList
          key={resetKey}
          resetKey={resetKey}
          profileId={profileId}
          initialComments={initialComments}
          initialNextCursor={initialNextCursor}
          emptyMessage={isOwnProfile ? "You have not commented yet." : "No public comments yet."}
          emptySearchMessage={`No comments found for "${query}".`}
          query={query}
        />
      </>
    );
  }

  const postTab = activeTab as ProfilePostTab;

  const showDelete =
    postTab === "likes"
      ? (post: SerializedPost) => post.author.id === currentUserId
      : postTab === "bookmarks"
        ? () => false
      : postTab === "hidden"
        ? () => false
      : () => isOwnProfile;

  const emptyMessage =
    postTab === "likes"
      ? isOwnProfile
        ? "You have not liked any posts yet."
        : "No visible liked posts yet."
      : postTab === "bookmarks"
        ? "You have not bookmarked any posts yet."
      : postTab === "hidden"
        ? "You have not hidden any posts."
      : "No posts yet.";

  const isReelsMode = profileViewMode === "reels";
  const showUniqueViewerCount = isOwnProfile && postTab === "posts";
  const enableViewTracking = true;

  return (
    <>
      <div className="px-1">
        <QuerySyncSearchInput
          initialValue={query}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
        />
      </div>
      {isReelsMode ? (
        <InfiniteReelsPostActivityList
          key={resetKey}
          resetKey={resetKey}
          profileId={profileId}
          activeTab={postTab}
          initialPosts={initialPosts}
          initialNextCursor={initialNextCursor}
          currentUserId={currentUserId}
          showDelete={showDelete}
          emptyMessage={emptyMessage}
          emptySearchMessage={`No results found for "${query}".`}
          initiallyHidden={postTab === "hidden"}
          requireAuthForInteractions={requireAuthForInteractions}
          query={query}
          enableViewTracking={enableViewTracking}
          showUniqueViewerCount={showUniqueViewerCount}
        />
      ) : (
        <InfinitePostActivityList
          key={resetKey}
          resetKey={resetKey}
          profileId={profileId}
          activeTab={postTab}
          initialPosts={initialPosts}
          initialNextCursor={initialNextCursor}
          currentUserId={currentUserId}
          showDelete={showDelete}
          emptyMessage={emptyMessage}
          emptySearchMessage={`No results found for "${query}".`}
          initiallyHidden={postTab === "hidden"}
          requireAuthForInteractions={requireAuthForInteractions}
          query={query}
          enableViewTracking={enableViewTracking}
          showUniqueViewerCount={showUniqueViewerCount}
        />
      )}
    </>
  );
}