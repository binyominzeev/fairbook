"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

export default function GroupSettingsEditor({
  groupIdOrSlug,
  initialSlug,
  initialDescription,
  initialIsPrivate,
}: {
  groupIdOrSlug: string;
  initialSlug: string | null;
  initialDescription: string | null;
  initialIsPrivate: boolean;
}) {
  const router = useRouter();
  const locale = useAppLocale();

  const [slug, setSlug] = useState(initialSlug ?? "");
  const [description, setDescription] = useState(initialDescription ?? "");
  const [visibility, setVisibility] = useState<"public" | "closed">(
    initialIsPrivate ? "closed" : "public"
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      let currentIdentifier = groupIdOrSlug;

      if (slug.trim() !== (initialSlug ?? "")) {
        const permalinkRes = await fetch(
          `/api/communities/${encodeURIComponent(groupIdOrSlug)}/permalink`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: slug.trim() }),
          }
        );
        const permalinkData = await permalinkRes.json();

        if (!permalinkRes.ok) {
          setError(permalinkData.error ?? "Failed to update permalink.");
          return;
        }

        const nextSlug = permalinkData.permalinkSlug ?? slug;
        setSlug(nextSlug);
        currentIdentifier = nextSlug;
      }

      if (
        description !== (initialDescription ?? "") ||
        visibility !== (initialIsPrivate ? "closed" : "public")
      ) {
        const descRes = await fetch(
          `/api/communities/${encodeURIComponent(currentIdentifier)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description, visibility }),
          }
        );
        const descData = await descRes.json();

        if (!descRes.ok) {
          setError(descData.error ?? "Failed to update settings.");
          return;
        }
      }

      setMessage(t(locale, "groupSettings.saved"));
      startTransition(() => {
        router.push(`/groups/${encodeURIComponent(currentIdentifier)}?settings=1`);
        router.refresh();
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <h2 className="text-sm font-semibold text-slate-800">{t(locale, "groupSettings.title")}</h2>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            {t(locale, "groupSettings.permalink")}
          </label>
          <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 focus-within:border-blue-500 focus-within:bg-white">
            <span className="text-xs text-slate-400 select-none mr-1">/groups/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="group-slug"
              className="w-full bg-transparent text-sm text-slate-900 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            {t(locale, "groupSettings.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t(locale, "groupCreate.descriptionPlaceholder")}
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1">
            {t(locale, "groupSettings.visibility")}
          </label>
          <div className="flex items-center gap-4 text-sm text-slate-700">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === "public"}
                onChange={() => setVisibility("public")}
              />
              {t(locale, "groupSettings.visibility.public")}
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="visibility"
                value="closed"
                checked={visibility === "closed"}
                onChange={() => setVisibility("closed")}
              />
              {t(locale, "groupSettings.visibility.closed")}
            </label>
          </div>
        </div>

        {message && <p className="text-xs text-emerald-700">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:bg-slate-300"
        >
          {saving ? t(locale, "groupSettings.saving") : t(locale, "groupSettings.save")}
        </button>
      </form>
    </div>
  );
}