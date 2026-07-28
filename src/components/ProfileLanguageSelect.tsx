"use client";

import { useState, useTransition } from "react";
import { APP_LOCALES, getLocaleLabel, t, type AppLocale } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

export default function ProfileLanguageSelect({
  initialLocale,
}: {
  initialLocale: AppLocale;
}) {
  const uiLocale = useAppLocale();
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const saveLocale = (nextLocale: AppLocale) => {
    setLocale(nextLocale);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/users/language", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale: nextLocale }),
        });

        if (!response.ok) {
          throw new Error("Could not save locale.");
        }

        // Force a full reload so all server/client text updates become immediately visible.
        window.location.reload();
      } catch {
        setLocale(initialLocale);
        setError(t(uiLocale, "settings.languageSaveError"));
      }
    });
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <label className="sr-only" htmlFor="profile-language-preference">
        {t(uiLocale, "settings.language")}
      </label>
      <div className="relative">
        <select
          id="profile-language-preference"
          value={locale}
          onChange={(event) => saveLocale(event.target.value as AppLocale)}
          disabled={isSaving}
          className="min-w-36 appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          aria-label={t(uiLocale, "settings.language")}
        >
          {APP_LOCALES.map((value) => (
            <option key={value} value={value}>
              {value === locale ? "✓ " : ""}
              {getLocaleLabel(value)}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.094l3.71-3.864a.75.75 0 1 1 1.08 1.04l-4.25 4.425a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
