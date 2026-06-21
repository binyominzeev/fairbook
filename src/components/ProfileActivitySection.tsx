"use client";

import Link from "next/link";
import PostCard from "@/components/PostCard";
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
  initiallyHidden,
}: {
  resetKey: string;
  profileId: string;
  activeTab: "posts" | "likes" | "hidden";
  initialPosts: SerializedPost[];
  initialNextCursor: string | null;
  currentUserId: string;
  showDelete: (post: SerializedPost) => boolean;
  emptyMessage: string;
  initiallyHidden: boolean;
}) {
  const { items, hasMore, isLoading, error, sentinelRef } = useInfiniteCursorLoader({
    initialItems: initialPosts,
    initialNextCursor,
    loadPage: async (cursor) => {
      const response = await fetch(
        `/api/users/${profileId}/activity?tab=${activeTab}&cursor=${encodeURIComponent(cursor)}`
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
        <p className="py-8 text-center text-sm text-slate-400">{emptyMessage}</p>
      )}

      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          showDelete={showDelete(post)}
          initiallyHidden={initiallyHidden}
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
}: {
  resetKey: string;
  profileId: string;
  initialComments: SerializedProfileComment[];
  initialNextCursor: string | null;
  emptyMessage: string;
}) {
  const { items, hasMore, isLoading, error, sentinelRef } = useInfiniteCursorLoader({
    initialItems: initialComments,
    initialNextCursor,
    loadPage: async (cursor) => {
      const response = await fetch(
        `/api/users/${profileId}/activity?tab=comments&cursor=${encodeURIComponent(cursor)}`
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
        <p className="py-8 text-center text-sm text-slate-400">{emptyMessage}</p>
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
                {comment.post.sharedTitle ?? comment.post.content?.slice(0, 80) ?? "Untitled post"}
              </Link>
              <span>by {comment.post.author.name}</span>
              {comment.post.sharedSource && <span>· {comment.post.sharedSource}</span>}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
              {comment.content}
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
}: {
  profileId: string;
  activeTab: ProfileActivityTab;
  initialPosts: SerializedPost[];
  initialComments: SerializedProfileComment[];
  initialNextCursor: string | null;
  currentUserId: string;
  isOwnProfile: boolean;
}) {
  const resetKey = `${activeTab}:${initialNextCursor ?? "end"}:${initialPosts[0]?.id ?? initialComments[0]?.id ?? "empty"}`;

  if (activeTab === "comments") {
    return (
      <InfiniteCommentActivityList
        resetKey={resetKey}
        profileId={profileId}
        initialComments={initialComments}
        initialNextCursor={initialNextCursor}
        emptyMessage={isOwnProfile ? "You have not commented yet." : "No public comments yet."}
      />
    );
  }

  return (
    <InfinitePostActivityList
      resetKey={resetKey}
      profileId={profileId}
      activeTab={activeTab}
      initialPosts={initialPosts}
      initialNextCursor={initialNextCursor}
      currentUserId={currentUserId}
      showDelete={
        activeTab === "likes"
          ? (post) => post.author.id === currentUserId
          : activeTab === "hidden"
            ? () => false
          : () => isOwnProfile
      }
      emptyMessage={
        activeTab === "likes"
          ? isOwnProfile
            ? "You have not liked any posts yet."
            : "No visible liked posts yet."
          : activeTab === "hidden"
            ? "You have not hidden any posts."
          : "No posts yet."
      }
      initiallyHidden={activeTab === "hidden"}
    />
  );
}