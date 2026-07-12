"use client";

import { useEffect } from "react";
import PostCard from "@/components/PostCard";
import { useInfiniteCursorLoader } from "@/components/useInfiniteCursorLoader";
import type { SerializedPost } from "@/lib/post-presentation";

const NEW_VISIBLE_POST_EVENT = "fairbook:new-visible-post";

export default function GroupPostsInfiniteList({
  currentUserId,
  groupIdOrSlug,
  groupId,
  groupPath,
  query,
  initialPosts,
  initialNextCursor,
}: {
  currentUserId: string;
  groupIdOrSlug: string;
  groupId: string;
  groupPath: string;
  query: string;
  initialPosts: SerializedPost[];
  initialNextCursor: string | null;
}) {
  const { items, prependItem, hasMore, isLoading, error, sentinelRef } = useInfiniteCursorLoader({
    initialItems: initialPosts,
    initialNextCursor,
    loadPage: async (cursor) => {
      const params = new URLSearchParams({ cursor });
      if (query) {
        params.set("q", query);
      }

      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/posts?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error("Failed to load group posts.");
      }

      const data = (await response.json()) as {
        posts: SerializedPost[];
        nextCursor: string | null;
      };

      return {
        items: data.posts,
        nextCursor: data.nextCursor,
      };
    },
  });

  useEffect(() => {
    const handleNewPost = (event: Event) => {
      const customEvent = event as CustomEvent<SerializedPost>;
      const post = customEvent.detail;
      if (!post?.id) {
        return;
      }

      // Keep live prepend scoped to the current group view.
      if (post.community?.id !== groupId) {
        return;
      }

      // Query-filtered views are refreshed via server fetch to avoid false matches.
      if (query.trim().length > 0) {
        return;
      }

      prependItem(post, (candidate) => candidate.id === post.id);
    };

    window.addEventListener(NEW_VISIBLE_POST_EVENT, handleNewPost);
    return () => {
      window.removeEventListener(NEW_VISIBLE_POST_EVENT, handleNewPost);
    };
  }, [groupId, prependItem, query]);

  if (items.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-slate-500">
        {query ? "No group posts match this search." : "No posts in this group yet."}
      </div>
    );
  }

  return (
    <div>
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          showDelete
          highlightQuery={query}
          defaultShareCommunityId={groupId}
          shareRedirectPath={groupPath}
          showCommunityHeader={false}
        />
      ))}

      <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
        {isLoading ? "Loading older posts..." : hasMore ? "Scroll for older posts" : "No more posts"}
      </div>

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
