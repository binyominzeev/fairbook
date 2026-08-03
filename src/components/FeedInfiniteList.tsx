"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import PostCard from "@/components/PostCard";
import PostCardList from "@/components/PostCardList";
import { useInfiniteCursorLoader } from "@/components/useInfiniteCursorLoader";
import {
  createAnonymousPostViewTracker,
  createRegisteredPostViewTracker,
} from "@/components/post-view-tracking";
import type { SerializedPost } from "@/lib/post-presentation";
import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

const NEW_VISIBLE_POST_EVENT = "fairbook:new-visible-post";

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
  topicId,
}: {
  initialPosts: SerializedPost[];
  initialNextCursor: string | null;
  currentUserId: string;
  mode: "all" | "following" | "group";
  groupId: string | null;
  query: string;
  topicId: string | null;
}) {
  const locale = useAppLocale();
  const tracker = useMemo(
    () =>
      currentUserId
        ? createRegisteredPostViewTracker("feed_card")
        : createAnonymousPostViewTracker(),
    [currentUserId]
  );

  useEffect(() => () => tracker.dispose(), [tracker]);

  const { items, prependItem, hasMore, isLoading, error, sentinelRef } =
    useInfiniteCursorLoader({
      initialItems: initialPosts,
      initialNextCursor,
      loadPage: async (cursor) => {
        const searchParams = new URLSearchParams({
          cursor,
          mode,
        });
        if (groupId) {
          searchParams.set("group", groupId);
        }
        if (query) {
          searchParams.set("q", query);
        }
        if (topicId) {
          searchParams.set("topic", topicId);
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

      prependItem(post, (candidate) => candidate.id === post.id);
    };

    window.addEventListener(NEW_VISIBLE_POST_EVENT, handleNewPost);
    return () => {
      window.removeEventListener(NEW_VISIBLE_POST_EVENT, handleNewPost);
    };
  }, [prependItem]);

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <p className="text-2xl mb-3">👋</p>
        <p className="font-medium text-slate-600">
          {query
            ? t(locale, "feed.list.empty.search")
            : mode === "following"
              ? t(locale, "feed.list.empty.following")
              : mode === "group"
                ? t(locale, "feed.list.empty.group")
                : t(locale, "feed.list.empty.default")}
        </p>
        <p className="text-sm mt-1">
          {query
            ? t(locale, "feed.list.tip.search")
            : mode === "following"
              ? t(locale, "feed.list.tip.following")
              : mode === "group"
                ? t(locale, "feed.list.tip.group")
                : t(locale, "feed.list.tip.default")}
        </p>
      </div>
    );
  }

  return (
    <div key={`${initialPosts[0]?.id ?? "empty"}:${initialNextCursor ?? "end"}`}>
      <PostCardList
        posts={items}
        wrapPost={(post, content) => (
          <TrackOnVisible onVisible={() => tracker.queue(post.id)}>{content}</TrackOnVisible>
        )}
        renderPost={(post) => (
          <PostCard
            post={post}
            currentUserId={currentUserId}
            showDelete
            highlightQuery={query}
            showUniqueViewerCount={false}
          />
        )}
      />

      <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
        {isLoading
          ? t(locale, "feed.list.loadingOlder")
          : hasMore
            ? t(locale, "feed.list.scrollOlder")
            : t(locale, "feed.list.noMore")}
      </div>

      {error && <p className="pb-4 text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}