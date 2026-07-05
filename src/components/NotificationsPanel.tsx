"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type NotificationItem = {
  id: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  actor: {
    id: string;
    slug?: string | null;
    name: string;
    avatarUrl?: string | null;
  };
  post: {
    id: string;
    permalinkPath: string;
    targetPath: string;
    previewText?: string | null;
  };
  comment: {
    id: string;
    content: string;
  } | null;
};

function timeAgo(dateIso: string) {
  const diff = Date.now() - new Date(dateIso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function buildLabel(item: NotificationItem) {
  if (item.type === "comment_reply") {
    return `${item.actor.name} replied to your comment`;
  }

  if (item.type === "followed_user_commented") {
    return `${item.actor.name} commented on a post`;
  }

  if (item.type === "post_liked") {
    return `${item.actor.name} liked your post`;
  }

  if (item.type === "comment_liked") {
    return `${item.actor.name} liked your comment`;
  }

  return `${item.actor.name} sent an update`;
}

function buildContext(item: NotificationItem) {
  if (item.type === "post_liked") {
    return item.post.previewText?.trim() || "Your post was liked.";
  }

  if (item.type === "comment_liked" || item.type === "comment_reply") {
    return item.comment?.content?.trim() || "Your comment was updated.";
  }

  if (item.type === "followed_user_commented") {
    return item.comment?.content?.trim() || item.post.previewText?.trim() || "Open post";
  }

  return item.post.previewText?.trim() || item.comment?.content?.trim() || "Open";
}

export default function NotificationsPanel({
  initialNotifications,
  initialNextCursor,
}: {
  initialNotifications: NotificationItem[];
  initialNextCursor: string | null;
}) {
  const [items, setItems] = useState(initialNotifications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [error, setError] = useState("");

  const applyUnreadCount = useCallback((unreadCount: number) => {
    window.dispatchEvent(
      new CustomEvent("fairbook:notifications-unread-changed", {
        detail: { unreadCount },
      })
    );
  }, []);

  const markNotificationsRead = useCallback(
    async (ids: string[] = []) => {
      const response = await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ids.length > 0 ? { ids } : {}),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Failed to mark notifications as read.");
      }

      applyUnreadCount(Number(data.unreadCount ?? 0));
    },
    [applyUnreadCount]
  );

  useEffect(() => {
    const unreadIds = initialNotifications
      .filter((item) => !item.isRead)
      .map((item) => item.id);

    if (unreadIds.length === 0) return;

    let cancelled = false;
    void (async () => {
      try {
        await markNotificationsRead(unreadIds);
        if (!cancelled) {
          setItems((current) => current.map((item) => ({ ...item, isRead: true })));
        }
      } catch {
        // Keep UI usable even if auto-mark fails.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialNotifications, markNotificationsRead]);

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/notifications?cursor=${encodeURIComponent(nextCursor)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to load notifications.");
        return;
      }

      setItems((current) => [...current, ...(data.notifications ?? [])]);
      setNextCursor(data.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  };

  const markAllRead = async () => {
    if (markingRead) return;

    setMarkingRead(true);
    setError("");
    try {
      await markNotificationsRead();

      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark notifications as read.");
    } finally {
      setMarkingRead(false);
    }
  };

  const openNotification = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NotificationItem
  ) => {
    if (item.isRead) return;

    event.preventDefault();
    setError("");
    try {
      await markNotificationsRead([item.id]);
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.id === item.id ? { ...currentItem, isRead: true } : currentItem
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open notification.");
      return;
    }

    window.location.assign(item.post.targetPath || item.post.permalinkPath);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={markAllRead}
          disabled={markingRead}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:text-slate-300"
        >
          {markingRead ? "Marking..." : "Mark all as read"}
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.post.targetPath || item.post.permalinkPath}
            onClick={(event) => {
              void openNotification(event, item);
            }}
            className={`block rounded-xl border p-4 transition-colors ${item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">{buildLabel(item)}</p>
              <span className="text-xs text-slate-400">{timeAgo(item.createdAt)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{buildContext(item)}</p>
          </Link>
        ))}
      </div>

      {nextCursor && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:text-slate-300"
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
      )}

      {error && <p className="text-center text-xs text-red-600">{error}</p>}
    </div>
  );
}
