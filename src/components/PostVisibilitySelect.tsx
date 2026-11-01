"use client";

import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

export type PostVisibilityChoice = "default" | "public" | "members" | "friends" | "private";

export function normalizeVisibilityChoice(value: string): PostVisibilityChoice {
  return value === "public" ||
    value === "members" ||
    value === "friends" ||
    value === "private"
    ? value
    : "default";
}

export default function PostVisibilitySelect({
  value,
  onChange,
  className,
  includeDefault = true,
  includePrivate = true,
}: {
  value: PostVisibilityChoice;
  onChange: (value: PostVisibilityChoice) => void;
  className?: string;
  includeDefault?: boolean;
  includePrivate?: boolean;
}) {
  const locale = useAppLocale();
  return (
    <select
      value={value}
      onChange={(event) => onChange(normalizeVisibilityChoice(event.target.value))}
      className={className}
    >
      {includeDefault && <option value="default">{t(locale, "composer.visibilityDefault")}</option>}
      <option value="public">{t(locale, "composer.visibilityPublic")}</option>
      <option value="members">{t(locale, "composer.visibilityMembers")}</option>
      <option value="friends">{t(locale, "composer.visibilityFriends")}</option>
      {includePrivate && <option value="private">{t(locale, "composer.visibilityPrivate")}</option>}
    </select>
  );
}
