"use client";

import Link from "next/link";
import HighlightedText from "@/components/HighlightedText";
import PostCard from "@/components/PostCard";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";
import { useInfiniteCursorLoader } from "@/components/useInfiniteCursorLoader";
import type {
  SerializedPost,
  SerializedProfileComment,
} from "@/lib/post-presentation";
import type { ProfileActivityTab } from "@/lib/profile-activity";

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
  query,
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
  query: string;
}) {
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
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          showDelete={showDelete(post)}
          initiallyHidden={initiallyHidden}
          highlightQuery={query}
        />
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

export default function ProfileActivitySection({
  profileId,
  activeTab,
  initialPosts,
  initialComments,
  initialNextCursor,
  currentUserId,
  isOwnProfile,
  query,
}: {
  profileId: string;
  activeTab: ProfileActivityTab;
  initialPosts: SerializedPost[];
  initialComments: SerializedProfileComment[];
  initialNextCursor: string | null;
  currentUserId: string;
  isOwnProfile: boolean;
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

  return (
    <>
      <div className="px-1">
        <QuerySyncSearchInput
          initialValue={query}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
        />
      </div>
      <InfinitePostActivityList
        key={resetKey}
        resetKey={resetKey}
        profileId={profileId}
        activeTab={activeTab}
        initialPosts={initialPosts}
        initialNextCursor={initialNextCursor}
        currentUserId={currentUserId}
        showDelete={
          activeTab === "likes"
            ? (post) => post.author.id === currentUserId
            : activeTab === "bookmarks"
              ? () => false
            : activeTab === "hidden"
              ? () => false
            : () => isOwnProfile
        }
        emptyMessage={
          activeTab === "likes"
            ? isOwnProfile
              ? "You have not liked any posts yet."
              : "No visible liked posts yet."
            : activeTab === "bookmarks"
              ? "You have not bookmarked any posts yet."
            : activeTab === "hidden"
              ? "You have not hidden any posts."
            : "No posts yet."
        }
        emptySearchMessage={`No results found for "${query}".`}
        initiallyHidden={activeTab === "hidden"}
        query={query}
      />
    </>
  );
}