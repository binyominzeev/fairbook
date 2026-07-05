"use client";

import { useEffect } from "react";
import PostCard from "@/components/PostCard";
import { useInfiniteCursorLoader } from "@/components/useInfiniteCursorLoader";
import type { SerializedPost } from "@/lib/post-presentation";
import type { FeedSortMode } from "@/lib/feed-posts";

const NEW_VISIBLE_POST_EVENT = "fairbook:new-visible-post";

export default function FeedInfiniteList({
  initialPosts,
  initialNextCursor,
  currentUserId,
  mode,
  groupId,
  query,
  sort,
}: {
  initialPosts: SerializedPost[];
  initialNextCursor: string | null;
  currentUserId: string;
  mode: "all" | "following" | "group";
  groupId: string | null;
  query: string;
  sort: FeedSortMode;
}) {
  const { items, prependItem, hasMore, isLoading, error, sentinelRef } =
    useInfiniteCursorLoader({
      initialItems: initialPosts,
      initialNextCursor,
      loadPage: async (cursor) => {
        const searchParams = new URLSearchParams({
          cursor,
          mode,
          sort,
        });
        if (groupId) {
          searchParams.set("group", groupId);
        }
        if (query) {
          searchParams.set("q", query);
        }

        const response = await fetch(`/api/posts?${searchParams.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to load feed page.");
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

      if (sort === "likes" || sort === "comments") {
        return;
      }

      prependItem(post, (candidate) => candidate.id === post.id);
    };

    window.addEventListener(NEW_VISIBLE_POST_EVENT, handleNewPost);
    return () => {
      window.removeEventListener(NEW_VISIBLE_POST_EVENT, handleNewPost);
    };
  }, [prependItem, sort]);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-2xl mb-3">👋</p>
        <p className="font-medium text-slate-600">
          {query
            ? "No posts match this search."
            : mode === "following"
              ? "Your Following feed is empty."
              : mode === "group"
                ? "This RSS group is empty."
                : "Your feed is empty."}
        </p>
        <p className="text-sm mt-1">
          {query
            ? "Try shorter keywords or clear the search field."
            : mode === "following"
              ? "Follow people to see their posts here."
              : mode === "group"
                ? "Add followed RSS sources to this group to populate it."
                : "Follow people or pages to see posts here."}
        </p>
      </div>
    );
  }

  return (
    <div key={`${initialPosts[0]?.id ?? "empty"}:${initialNextCursor ?? "end"}`}>
      {items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          showDelete
          highlightQuery={query}
        />
      ))}

      <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
        {isLoading ? "Loading older posts…" : hasMore ? "Scroll for older posts" : "No more posts"}
      </div>

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}