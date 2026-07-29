"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { t, tf } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

const MENU_ROOT_ATTR = "data-notification-menu-root";

function base64UrlToUint8Array(base64String: string) {
  const normalized = base64String.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);

  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }

  return array;
}

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
  profilePath?: string | null;
  post: {
    id: string;
    permalinkPath: string;
    targetPath: string;
    previewText?: string | null;
  } | null;
  community: {
    id: string;
    name: string;
    targetPath: string;
  } | null;
  comment: {
    id: string;
    content: string;
  } | null;
};

function timeAgo(dateIso: string, locale: "hu" | "en") {
  const diff = Date.now() - new Date(dateIso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t(locale, "notifications.time.justNow");
  if (mins < 60) return tf(locale, "notifications.time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tf(locale, "notifications.time.hoursAgo", { count: hours });
  return tf(locale, "notifications.time.daysAgo", { count: Math.floor(hours / 24) });
}

function buildLabel(item: NotificationItem, locale: "hu" | "en") {
  if (item.type === "comment_reply") {
    return tf(locale, "notifications.label.comment_reply", { actorName: item.actor.name });
  }

  if (item.type === "followed_user_commented") {
    return tf(locale, "notifications.label.followed_user_commented", { actorName: item.actor.name });
  }

  if (item.type === "followed_user_new_post") {
    return tf(locale, "notifications.label.followed_user_new_post", { actorName: item.actor.name });
  }

  if (item.type === "post_liked") {
    return tf(locale, "notifications.label.post_liked", { actorName: item.actor.name });
  }

  if (item.type === "comment_liked") {
    return tf(locale, "notifications.label.comment_liked", { actorName: item.actor.name });
  }

  if (item.type === "group_invited") {
    return tf(locale, "notifications.label.group_invited", { actorName: item.actor.name });
  }

  if (item.type === "group_new_post") {
    return tf(locale, "notifications.label.group_new_post", { actorName: item.actor.name });
  }

  if (item.type === "group_join_requested") {
    return tf(locale, "notifications.label.group_join_requested", { actorName: item.actor.name });
  }

  if (item.type === "group_join_approved") {
    return tf(locale, "notifications.label.group_join_approved", { actorName: item.actor.name });
  }

  if (item.type === "group_invite_accepted") {
    return tf(locale, "notifications.label.group_invite_accepted", { actorName: item.actor.name });
  }

  if (item.type === "post_subscribed_commented") {
    return tf(locale, "notifications.label.post_subscribed_commented", { actorName: item.actor.name });
  }

  if (item.type === "user_followed_you") {
    return tf(locale, "notifications.label.user_followed_you", { actorName: item.actor.name });
  }

  return tf(locale, "notifications.label.default", { actorName: item.actor.name });
}

function buildContext(item: NotificationItem, locale: "hu" | "en") {
  if (item.type === "post_liked") {
    return item.post?.previewText?.trim() || t(locale, "notifications.context.postLikedFallback");
  }

  if (item.type === "comment_liked" || item.type === "comment_reply") {
    return item.comment?.content?.trim() || t(locale, "notifications.context.commentFallback");
  }

  if (item.type === "followed_user_commented") {
    return item.comment?.content?.trim() || item.post?.previewText?.trim() || t(locale, "notifications.context.openPost");
  }

  if (item.type === "followed_user_new_post") {
    return item.post?.previewText?.trim() || t(locale, "notifications.context.openPost");
  }

  if (item.type === "group_invited") {
    return item.community?.name
      ? tf(locale, "notifications.context.groupName", { name: item.community.name })
      : t(locale, "notifications.context.openGroup");
  }

  if (item.type === "group_new_post") {
    return item.post?.previewText?.trim() || item.community?.name || t(locale, "notifications.context.openGroupPost");
  }

  if (item.type === "group_join_requested") {
    return item.community?.name
      ? tf(locale, "notifications.context.groupName", { name: item.community.name })
      : t(locale, "notifications.context.openGroup");
  }

  if (item.type === "group_join_approved") {
    return item.community?.name
      ? tf(locale, "notifications.context.groupName", { name: item.community.name })
      : t(locale, "notifications.context.openGroup");
  }

  if (item.type === "group_invite_accepted") {
    return item.community?.name
      ? tf(locale, "notifications.context.groupName", { name: item.community.name })
      : t(locale, "notifications.context.openGroup");
  }

  if (item.type === "post_subscribed_commented") {
    return item.comment?.content?.trim() || item.post?.previewText?.trim() || t(locale, "notifications.context.openPost");
  }

  if (item.type === "user_followed_you") {
    return t(locale, "notifications.context.openProfile");
  }

  return item.post?.previewText?.trim() || item.comment?.content?.trim() || t(locale, "notifications.context.openGeneric");
}

export default function NotificationsPanel({
  initialNotifications,
  initialNextCursor,
}: {
  initialNotifications: NotificationItem[];
  initialNextCursor: string | null;
}) {
  const locale = useAppLocale();
  const [items, setItems] = useState(initialNotifications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingRead, setMarkingRead] = useState(false);
  const [isStandaloneApp] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const standaloneByMedia =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const standaloneByNavigator =
      "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    return standaloneByMedia || standaloneByNavigator;
  });
  const [pushPermission, setPushPermission] = useState<NotificationPermission | "unsupported">(
    () => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
      }

      return Notification.permission;
    }
  );
  const [phonePushEnabled, setPhonePushEnabled] = useState(false);
  const [togglingPhonePush, setTogglingPhonePush] = useState(false);
  const [activeMenuItemId, setActiveMenuItemId] = useState<string | null>(null);
  const [updatingType, setUpdatingType] = useState<string | null>(null);
  const [unsubscribedTypes, setUnsubscribedTypes] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const readPhonePushState = useCallback(async () => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      return { permission: "unsupported" as const, enabled: false };
    }

    const permission = Notification.permission;

    if (permission !== "granted") {
      return { permission, enabled: false };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return { permission, enabled: Boolean(subscription) };
  }, []);

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
        throw new Error(data.error ?? t(locale, "notifications.markReadFailed"));
      }

      applyUnreadCount(Number(data.unreadCount ?? 0));
    },
    [applyUnreadCount, locale]
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

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const state = await readPhonePushState();

      if (!cancelled) {
        setPushPermission(state.permission);
        setPhonePushEnabled(state.enabled);
      }
    })();

    void (async () => {
      try {
        const response = await fetch("/api/notifications/push-preferences");
        const data = await response.json();
        if (!response.ok || cancelled) {
          return;
        }

        const nextState: Record<string, boolean> = {};
        const preferences = Array.isArray(data.preferences) ? data.preferences : [];
        for (const preference of preferences) {
          if (
            preference &&
            typeof preference.type === "string" &&
            preference.enabled === false
          ) {
            nextState[preference.type] = true;
          }
        }

        if (!cancelled) {
          setUnsubscribedTypes((current) => ({
            ...nextState,
            ...current,
          }));
        }
      } catch {
        // Non-blocking: menu actions still work without initial preference fetch.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [readPhonePushState]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void (async () => {
          const state = await readPhonePushState();
          setPushPermission(state.permission);
          setPhonePushEnabled(state.enabled);
        })();
      }
    };

    const handleWindowFocus = () => {
      void (async () => {
        const state = await readPhonePushState();
        setPushPermission(state.permission);
        setPhonePushEnabled(state.enabled);
      })();
    };

    window.addEventListener("focus", handleWindowFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleWindowFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [readPhonePushState]);

  useEffect(() => {
    if (!activeMenuItemId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setActiveMenuItemId(null);
        return;
      }

      if (target.closest(`[${MENU_ROOT_ATTR}="true"]`)) {
        return;
      }

      setActiveMenuItemId(null);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveMenuItemId(null);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [activeMenuItemId]);

  const togglePhonePush = async () => {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setError(t(locale, "notifications.phoneUnsupported"));
      return;
    }

    const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) {
      setError(t(locale, "notifications.phoneNotConfigured"));
      return;
    }

    setTogglingPhonePush(true);
    setError("");
    setInfo("");

    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();

      if (phonePushEnabled) {
        if (existingSubscription) {
          await existingSubscription.unsubscribe();

          const response = await fetch("/api/push/subscriptions", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: existingSubscription.endpoint }),
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            setError(data.error ?? t(locale, "notifications.disableFailed"));
            return;
          }
        }

        setPhonePushEnabled(false);
        setInfo(t(locale, "notifications.disabled"));
        return;
      }

      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== "granted") {
        setPhonePushEnabled(false);
        setError(t(locale, "notifications.permissionDenied"));
        return;
      }

      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToUint8Array(publicKey),
        }));

      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? t(locale, "notifications.registerFailed"));
        return;
      }

      setPhonePushEnabled(true);
      setInfo(t(locale, "notifications.enabled"));
    } catch {
      setError(t(locale, "notifications.updateFailed"));
    } finally {
      setTogglingPhonePush(false);
    }
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError("");
    try {
      const response = await fetch(`/api/notifications?cursor=${encodeURIComponent(nextCursor)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? t(locale, "notifications.loadFailed"));
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
      setError(err instanceof Error ? err.message : t(locale, "notifications.markReadFailed"));
    } finally {
      setMarkingRead(false);
    }
  };

  const updateTypePreference = async (type: string, enabled: boolean) => {
    setUpdatingType(type);
    setError("");
    try {
      const response = await fetch("/api/notifications/push-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, enabled }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? t(locale, "notifications.preferenceUpdateFailed"));
        return;
      }

      setUnsubscribedTypes((current) => ({
        ...current,
        [type]: !Boolean(data.enabled),
      }));
      setActiveMenuItemId(null);
    } catch {
      setError(t(locale, "notifications.preferenceUpdateFailed"));
    } finally {
      setUpdatingType(null);
    }
  };

  const openNotification = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    item: NotificationItem
  ) => {
    event.preventDefault();
    setError("");

    if (!item.isRead) {
      try {
        await markNotificationsRead([item.id]);
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.id === item.id ? { ...currentItem, isRead: true } : currentItem
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : t(locale, "notifications.openFailed"));
        return;
      }
    }

    const targetPath = item.community?.targetPath || item.post?.targetPath || item.post?.permalinkPath || item.profilePath;
    if (!targetPath) {
      setError(t(locale, "notifications.openFailed"));
      return;
    }

    window.location.assign(targetPath);
  };

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        {t(locale, "notifications.none")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        {isStandaloneApp && pushPermission !== "unsupported" && (
          <button
            type="button"
            onClick={() => {
              void togglePhonePush();
            }}
            disabled={togglingPhonePush}
            className={`mr-2 rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:text-slate-300 ${
              phonePushEnabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                : "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
            }`}
          >
            {togglingPhonePush
              ? phonePushEnabled
                ? t(locale, "notifications.phoneDisabling")
                : t(locale, "notifications.phoneEnabling")
              : phonePushEnabled
                ? t(locale, "notifications.phoneEnabled")
                : t(locale, "notifications.phoneEnable")}
          </button>
        )}
        <button
          type="button"
          onClick={markAllRead}
          disabled={markingRead}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:text-slate-300"
        >
          {markingRead ? t(locale, "notifications.marking") : t(locale, "notifications.markAll")}
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => {
          const pushMutedForType = unsubscribedTypes[item.type] === true;

          return (
          <Link
            key={item.id}
            href={item.community?.targetPath || item.post?.targetPath || item.post?.permalinkPath || item.profilePath || "/notifications"}
            onClick={(event) => {
              void openNotification(event, item);
            }}
            className={`relative block rounded-xl border p-4 pr-14 transition-colors ${item.isRead ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50"}`}
          >
            <div className="absolute right-2 top-2" data-notification-menu-root="true">
              <button
                type="button"
                aria-label={t(locale, "notifications.options")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveMenuItemId((current) => (current === item.id ? null : item.id));
                }}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-700"
              >
                <span aria-hidden="true">•••</span>
              </button>

              {activeMenuItemId === item.id && (
                <div
                  data-notification-menu-root="true"
                  className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    disabled={updatingType === item.type}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void updateTypePreference(item.type, pushMutedForType);
                    }}
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-slate-700 transition-colors hover:bg-slate-100 disabled:text-slate-400"
                  >
                    {updatingType === item.type
                      ? t(locale, "notifications.menuWorking")
                      : pushMutedForType
                        ? t(locale, "notifications.menuSubscribeType")
                        : t(locale, "notifications.menuUnsubscribeType")}
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-900">{buildLabel(item, locale)}</p>
              <span className="text-xs text-slate-400">{timeAgo(item.createdAt, locale)}</span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600">{buildContext(item, locale)}</p>
            {pushMutedForType && (
              <p className="mt-2 text-[11px] font-medium text-amber-700">{t(locale, "notifications.typeMuted")}</p>
            )}
          </Link>
          );
        })}
      </div>

      {nextCursor && (
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:text-slate-300"
          >
            {loadingMore ? t(locale, "notifications.loading") : t(locale, "notifications.loadMore")}
          </button>
        </div>
      )}

      {error && <p className="text-center text-xs text-red-600">{error}</p>}
      {info && <p className="text-center text-xs text-emerald-600">{info}</p>}
    </div>
  );
}
