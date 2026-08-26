"use client";

import Avatar from "@/components/Avatar";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";

type Contact = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
};

export default function AddGroupMemberDialog({
  conversationId,
  onClose,
  onAdded,
}: {
  conversationId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const locale = useAppLocale();
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

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

  const addContact = async (userId: string) => {
    setSubmittingId(userId);
    setError(null);
    try {
      const response = await fetch(`/api/conversations/${conversationId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? t(locale, "messages.errorGeneric"));
        return;
      }
      onAdded();
      onClose();
    } catch {
      setError(t(locale, "messages.errorGeneric"));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3">
      <div className="w-full max-w-sm rounded-xl bg-white p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">{t(locale, "messages.addMember")}</h2>
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

        {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {contacts?.length === 0 && (
            <li className="px-1 py-4 text-center text-xs text-slate-400">{t(locale, "messages.noContacts")}</li>
          )}
          {contacts?.map((contact) => (
            <li key={contact.id}>
              <button
                type="button"
                disabled={submittingId === contact.id}
                onClick={() => void addContact(contact.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                <Avatar name={contact.name} avatarUrl={contact.avatarUrl} sizeClassName="h-7 w-7" />
                <span className="truncate">{contact.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
