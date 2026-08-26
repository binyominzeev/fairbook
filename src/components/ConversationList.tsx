"use client";

import Avatar from "@/components/Avatar";
import NewConversationDialog from "@/components/NewConversationDialog";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { t, tf } from "@/lib/i18n";
import Link from "next/link";
import { useEffect, useState } from "react";

type ConversationContact = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
};

type ConversationItem = {
  id: string;
  isGroup: boolean;
  name: string | null;
  updatedAt: string;
  participants: ConversationContact[];
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
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

function conversationTitle(conversation: ConversationItem) {
  if (conversation.isGroup) {
    return conversation.name || conversation.participants.map((p) => p.name).join(", ");
  }
  return conversation.participants[0]?.name ?? "";
}

export default function ConversationList({
  currentUserId,
  activePathname,
}: {
  currentUserId: string;
  activePathname?: string;
}) {
  const locale = useAppLocale();
  const [conversations, setConversations] = useState<ConversationItem[] | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/conversations");
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setConversations(data.conversations ?? []);
      } catch {
        // Ignore transient fetch errors.
      }
    };

    void load();
    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void load();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-semibold text-slate-900">{t(locale, "messages.title")}</h1>
        <button
          type="button"
          onClick={() => setIsDialogOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
        >
          {t(locale, "messages.newConversation")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {conversations && conversations.length === 0 && (
          <p className="rounded-lg border border-slate-200 bg-white px-4 py-6 text-center text-sm text-slate-500">
            {t(locale, "messages.empty")}
          </p>
        )}

        <ul className="space-y-1">
          {conversations?.map((conversation) => {
            const isActive = activePathname === `/messages/${conversation.id}`;
            return (
              <li key={conversation.id}>
                <Link
                  href={`/messages/${conversation.id}`}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                    isActive
                      ? "border-slate-300 bg-slate-100"
                      : "border-transparent hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Avatar
                    name={conversationTitle(conversation)}
                    avatarUrl={conversation.isGroup ? null : conversation.participants[0]?.avatarUrl}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">
                        {conversationTitle(conversation)}
                      </span>
                      {conversation.lastMessage && (
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {timeAgo(conversation.lastMessage.createdAt, locale)}
                        </span>
                      )}
                    </div>
                    {conversation.lastMessage && (
                      <p className="truncate text-xs text-slate-500">
                        {conversation.lastMessage.senderId === currentUserId ? `${t(locale, "messages.you")}: ` : ""}
                        {conversation.lastMessage.body}
                      </p>
                    )}
                  </div>
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {isDialogOpen && <NewConversationDialog onClose={() => setIsDialogOpen(false)} />}
    </div>
  );
}
