"use client";

import { useEffect, useRef, useState } from "react";

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function useInfiniteCursorLoader<T>({
  initialItems,
  initialNextCursor,
  loadPage,
}: {
  initialItems: T[];
  initialNextCursor: string | null;
  loadPage: (cursor: string) => Promise<CursorPage<T>>;
}) {
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    loadMoreRef.current = async () => {
      if (!nextCursor || isLoading) {
        return;
      }

      setIsLoading(true);
      setError("");

      try {
        const page = await loadPage(nextCursor);
        setItems((currentItems) => [...currentItems, ...page.items]);
        setNextCursor(page.nextCursor);
      } catch {
        setError("Failed to load more.");
      } finally {
        setIsLoading(false);
      }
    };
  }, [isLoading, loadPage, nextCursor]);

  useEffect(() => {
    const node = sentinelRef.current;

    if (!node || !nextCursor) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreRef.current?.();
        }
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, items.length]);

  return {
    items,
    hasMore: nextCursor !== null,
    isLoading,
    error,
    sentinelRef,
  };
}