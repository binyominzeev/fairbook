"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";
import PostVisibilitySelect, { type PostVisibilityChoice } from "@/components/PostVisibilitySelect";

export default function DefaultPostVisibilitySelect({
  initialValue,
}: {
  initialValue: "public" | "members" | "friends";
}) {
  const locale = useAppLocale();
  const [value, setValue] = useState<PostVisibilityChoice>(initialValue);
  const [error, setError] = useState(false);

  const save = async (next: PostVisibilityChoice) => {
    if (next === "default" || next === "private") return;
    const previous = value;
    setValue(next);
    setError(false);
    try {
      const res = await fetch("/api/users/default-post-visibility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (!res.ok) throw new Error("save failed");
    } catch {
      setValue(previous);
      setError(true);
    }
  };

  return (
    <label className="flex items-center gap-2 text-xs text-slate-600">
      {t(locale, "profile.defaultVisibility")}
      <PostVisibilitySelect
        value={value}
        onChange={save}
        includeDefault={false}
        includePrivate={false}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <span className="text-red-600">{t(locale, "profile.defaultVisibilityError")}</span>}
    </label>
  );
}
