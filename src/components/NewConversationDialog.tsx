"use client";

import Avatar from "@/components/Avatar";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { t } from "@/lib/i18n";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Contact = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
};

export default function NewConversationDialog({ onClose }: { onClose: () => void }) {
  const locale = useAppLocale();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      try {
        const response = await fetch(`/api/messages/eligible-contacts?${params.toString()}`);
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setContacts(data.contacts ?? []);
      } catch {
        // Ignore transient fetch errors.
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [query]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    if (selectedIds.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantIds: selectedIds,
          ...(selectedIds.length > 1 ? { name: groupName } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? t(locale, "messages.errorGeneric"));
        return;
      }
      router.push(`/messages/${data.conversation.id}`);
      onClose();
    } catch {
      setError(t(locale, "messages.errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t(locale, "messages.newConversation")}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700">
            ✕
          </button>
        </div>

        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t(locale, "messages.searchPlaceholder")}
          className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
        />

        <p className="mb-2 text-[11px] text-slate-400">{t(locale, "messages.selectPeople")}</p>

        <ul className="mb-3 max-h-56 space-y-1 overflow-y-auto">
          {contacts?.length === 0 && (
            <li className="px-1 py-4 text-center text-xs text-slate-400">{t(locale, "messages.noContacts")}</li>
          )}
          {contacts?.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                onClick={() => toggleSelected(contact.id)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${
                  selectedIds.includes(contact.id) ? "bg-slate-100" : ""
                }`}
              >
                <Avatar name={contact.name} avatarUrl={contact.avatarUrl} sizeClassName="h-7 w-7" />
                <span className="truncate">{contact.name}</span>
              </button>
            </li>
          ))}
        </ul>

        {selectedIds.length > 1 && (
          <input
            type="text"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder={t(locale, "messages.groupNamePlaceholder")}
            className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none"
          />
        )}

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        <button
          type="button"
          disabled={selectedIds.length === 0 || submitting}
          onClick={() => void submit()}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {selectedIds.length > 1 ? t(locale, "messages.createGroup") : t(locale, "messages.startConversation")}
        </button>
      </div>
    </div>
  );
}
