"use client";

import Avatar from "@/components/Avatar";
import AddGroupMemberDialog from "@/components/AddGroupMemberDialog";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { t, tf } from "@/lib/i18n";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buildProfilePath } from "@/lib/profile-path";
import { useEffect, useRef, useState } from "react";

type Participant = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  isCreator: boolean;
  isAdmin: boolean;
};

type Message = {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; avatarUrl: string | null };
};

async function fetchMessages(conversationId: string): Promise<Message[] | null> {
  try {
    const response = await fetch(`/api/conversations/${conversationId}/messages`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.messages ?? [];
  } catch {
    return null;
  }
}

function timeAgo(dateIso: string, locale: "hu" | "en") {
  const diff = Date.now() - new Date(dateIso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t(locale, "notifications.time.justNow");
  if (mins < 60) return tf(locale, "notifications.time.minutesAgo", { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return tf(locale, "notifications.time.hoursAgo", { count: hours });
  return tf(locale, "notifications.time.daysAgo", { count: Math.floor(hours / 24) });
}

const MESSAGE_LINK_PATTERN = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
const TRAILING_LINK_PUNCTUATION = /[),.!?:;]+$/;

function renderMessageBody(body: string) {
  return body.split(MESSAGE_LINK_PATTERN).map((part, index) => {
    if (!/^(?:https?:\/\/|www\.)/i.test(part)) return part;

    const match = part.match(TRAILING_LINK_PUNCTUATION);
    const trailing = match?.[0] ?? "";
    const href = part.slice(0, part.length - trailing.length);
    const normalizedHref = /^www\./i.test(href) ? `https://${href}` : href;

    return (
      <span key={`${part}-${index}`}>
        <a
          href={normalizedHref}
          target="_blank"
          rel="noreferrer"
          className="break-all underline underline-offset-2"
        >
          {href}
        </a>
        {trailing}
      </span>
    );
  });
}

export default function ConversationThread({
  conversationId,
  isGroup,
  name,
  currentUserId,
  participants,
}: {
  conversationId: string;
  isGroup: boolean;
  name: string | null;
  currentUserId: string;
  participants: Participant[];
}) {
  const locale = useAppLocale();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const self = participants.find((p) => p.id === currentUserId);
  const otherParticipant = !isGroup ? participants.find((p) => p.id !== currentUserId) : null;
  const title = isGroup ? name || participants.map((p) => p.name).join(", ") : otherParticipant?.name ?? "";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const nextMessages = await fetchMessages(conversationId);
      if (!cancelled && nextMessages) setMessages(nextMessages);
    };

    void load();
    void fetch(`/api/conversations/${conversationId}/read`, { method: "POST" });
    window.dispatchEvent(new CustomEvent("fairbook:messages-unread-changed", { detail: { unreadCount: 0 } }));

    const interval = window.setInterval(() => {
      if (document.hidden) return;
      void load();
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (!menu) return;
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu.contains(target)) return;
      menu.removeAttribute("open");
      setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? t(locale, "messages.errorGeneric"));
        return;
      }
      setDraft("");
      const nextMessages = await fetchMessages(conversationId);
      if (nextMessages) setMessages(nextMessages);
    } catch {
      setError(t(locale, "messages.errorGeneric"));
    } finally {
      setSending(false);
    }
  };

  const leaveGroup = async () => {
    if (!window.confirm(t(locale, "messages.confirmLeave"))) return;
    await fetch(`/api/conversations/${conversationId}/participants`, { method: "DELETE" });
    window.location.href = "/messages";
  };

  const removeMember = async (userId: string) => {
    if (!window.confirm(t(locale, "messages.confirmRemoveMember"))) return;
    const response = await fetch(`/api/conversations/${conversationId}/participants/${userId}`, {
      method: "DELETE",
    });
    if (response.ok) window.location.reload();
  };

  const toggleAdmin = async (userId: string, makeAdmin: boolean) => {
    const response = await fetch(`/api/conversations/${conversationId}/participants/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAdmin: makeAdmin }),
    });
    if (response.ok) window.location.reload();
  };

  const toggleBlock = async (blocked: boolean) => {
    if (!otherParticipant) return;
    await fetch(`/api/users/${otherParticipant.id}/block`, { method: blocked ? "DELETE" : "POST" });
  };

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/messages"
            aria-label={t(locale, "messages.title")}
            className="-ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 lg:hidden"
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" strokeWidth={2} />
          </Link>
          <Avatar name={title} avatarUrl={isGroup ? null : otherParticipant?.avatarUrl} sizeClassName="h-8 w-8" />
          {isGroup ? (
            <span className="truncate text-sm font-semibold text-slate-900">{title}</span>
          ) : (
            <Link
              href={buildProfilePath({ id: otherParticipant?.id ?? "", slug: otherParticipant?.slug })}
              className="truncate text-sm font-semibold text-slate-900 hover:underline"
            >
              {title}
            </Link>
          )}
        </div>

        <details
          ref={menuRef}
          className="relative"
          onToggle={(event) => setIsMenuOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700">
            {t(locale, "messages.groupMembers")}
          </summary>
          <div className="absolute right-0 z-50 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
            {isGroup && (
              <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase text-slate-400">
                {t(locale, "messages.groupMembers")}
              </div>
            )}
            {isGroup &&
              participants.map((participant) => {
                const canManage =
                  isGroup &&
                  (self?.isAdmin || self?.isCreator) &&
                  participant.id !== currentUserId &&
                  !participant.isCreator;
                return (
                  <div key={participant.id} className="px-2.5 py-1.5 text-xs text-slate-700">
                    <div className="flex items-center gap-2">
                      <Avatar name={participant.name} avatarUrl={participant.avatarUrl} sizeClassName="h-5 w-5" />
                      <span className="truncate">{participant.name}</span>
                      {(participant.isCreator || participant.isAdmin) && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                          {t(locale, "messages.admin")}
                        </span>
                      )}
                    </div>
                    {canManage && (
                      <div className="mt-1 flex gap-2 pl-7 text-[11px]">
                        <button
                          type="button"
                          onClick={() => void toggleAdmin(participant.id, !participant.isAdmin)}
                          className="text-slate-500 hover:underline"
                        >
                          {participant.isAdmin ? t(locale, "messages.removeAdmin") : t(locale, "messages.makeAdmin")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeMember(participant.id)}
                          className="text-red-600 hover:underline"
                        >
                          {t(locale, "messages.removeMember")}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            {isGroup && (self?.isAdmin || self?.isCreator) && (
              <button
                type="button"
                onClick={() => setIsAddMemberOpen(true)}
                className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                {t(locale, "messages.addMember")}
              </button>
            )}
            {isGroup && !self?.isCreator && (
              <button
                type="button"
                onClick={() => void leaveGroup()}
                className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                {t(locale, "messages.leaveGroup")}
              </button>
            )}
            {!isGroup && (
              <button
                type="button"
                onClick={() => void toggleBlock(false)}
                className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-red-600 hover:bg-red-50"
              >
                {t(locale, "messages.block")}
              </button>
            )}
          </div>
        </details>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {messages.map((message) => {
          const isOwn = message.sender.id === currentUserId;
          return (
            <div key={message.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  isOwn ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800"
                }`}
              >
                {isGroup && !isOwn && (
                  <p className="mb-0.5 text-[11px] font-semibold text-slate-400">{message.sender.name}</p>
                )}
                <p className="whitespace-pre-wrap break-words">{renderMessageBody(message.body)}</p>
                <p className={`mt-1 text-[10px] ${isOwn ? "text-slate-300" : "text-slate-400"}`}>
                  {timeAgo(message.createdAt, locale)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="px-4 text-xs text-red-600">{error}</p>}

      <div className="flex items-end gap-2 border-t border-slate-200 p-3">
        <AutoResizeTextarea
          minRows={1}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={t(locale, "messages.sendPlaceholder")}
          className="max-h-40 flex-1 resize-none rounded-2xl border border-slate-200 px-4 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />
        <button
          type="button"
          disabled={sending || !draft.trim()}
          onClick={() => void sendMessage()}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {t(locale, "messages.send")}
        </button>
      </div>

      {isAddMemberOpen && (
        <AddGroupMemberDialog
          conversationId={conversationId}
          onClose={() => setIsAddMemberOpen(false)}
          onAdded={() => window.location.reload()}
        />
      )}
    </div>
  );
}
