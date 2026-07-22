"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import PostCard from "@/components/PostCard";
import { useInfiniteCursorLoader } from "@/components/useInfiniteCursorLoader";
import type { SerializedPost } from "@/lib/post-presentation";
import type { FeedSortMode } from "@/lib/feed-posts";

const NEW_VISIBLE_POST_EVENT = "fairbook:new-visible-post";
const FEED_TRACK_BATCH_SIZE = 20;
const FEED_TRACK_FLUSH_DELAY_MS = 500;

const trackedFeedPostIdsBySession = new Set<string>();

function useFeedPostViewTracking(enabled: boolean, currentUserId: string) {
  const pendingPostIdsRef = useRef(new Set<string>());
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPending = useCallback(() => {
    if (!enabled || !currentUserId) {
      pendingPostIdsRef.current.clear();
      return;
    }

    const postIds = Array.from(pendingPostIdsRef.current);
    if (postIds.length === 0) {
      return;
    }

    pendingPostIdsRef.current.clear();
    void fetch("/api/posts/views/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({ postIds, source: "feed_card" }),
    }).catch(() => {
      // Ignore transient tracking failures to keep feed scrolling smooth.
    });
  }, [currentUserId, enabled]);

  const markVisible = useCallback(
    (postId: string) => {
      if (!enabled || !currentUserId) {
        return;
      }

      if (trackedFeedPostIdsBySession.has(postId)) {
        return;
      }

      trackedFeedPostIdsBySession.add(postId);
      pendingPostIdsRef.current.add(postId);

      if (pendingPostIdsRef.current.size >= FEED_TRACK_BATCH_SIZE) {
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        flushPending();
        return;
      }

      if (!flushTimeoutRef.current) {
        flushTimeoutRef.current = setTimeout(() => {
          flushTimeoutRef.current = null;
          flushPending();
        }, FEED_TRACK_FLUSH_DELAY_MS);
      }
    },
    [currentUserId, enabled, flushPending]
  );

  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      flushPending();
    };
  }, [flushPending]);

  return markVisible;
}

function TrackOnVisible({
  children,
  onVisible,
}: {
  children: ReactNode;
  onVisible: () => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
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
  }, [onVisible]);

  return <div ref={rootRef}>{children}</div>;
}

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
  const markFeedPostVisible = useFeedPostViewTracking(true, currentUserId);

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
        <TrackOnVisible
          key={post.id}
          onVisible={() => markFeedPostVisible(post.id)}
        >
          <PostCard
            post={post}
            currentUserId={currentUserId}
            showDelete
            highlightQuery={query}
          />
        </TrackOnVisible>
      ))}

      <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
        {isLoading ? "Loading older posts…" : hasMore ? "Scroll for older posts" : "No more posts"}
      </div>

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}