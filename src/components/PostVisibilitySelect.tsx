"use client";

import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

export type PostVisibilityChoice = "default" | "public" | "members" | "friends" | "unlisted" | "private";

export function normalizeVisibilityChoice(value: string): PostVisibilityChoice {
  return value === "public" ||
    value === "members" ||
    value === "friends" ||
    value === "unlisted" ||
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
  includeUnlisted = false,
  defaultLabel,
  groupDefaultVisibility,
}: {
  value: PostVisibilityChoice;
  onChange: (value: PostVisibilityChoice) => void;
  className?: string;
  includeDefault?: boolean;
  includePrivate?: boolean;
  includeUnlisted?: boolean;
  defaultLabel?: string;
  groupDefaultVisibility?: string | null;
}) {
  const locale = useAppLocale();
  const groupDefaultKey = groupDefaultVisibility === "public" ? "composer.visibilityPublic"
    : groupDefaultVisibility === "members" ? "composer.visibilityMembers"
    : groupDefaultVisibility === "friends" ? "composer.visibilityFriends"
    : groupDefaultVisibility === "unlisted" ? "composer.visibilityUnlisted"
    : null;
  return (
    <select
      value={value}
      onChange={(event) => onChange(normalizeVisibilityChoice(event.target.value))}
      className={className}
    >
      {includeDefault && <option value="default">{groupDefaultKey
        ? `${t(locale, "composer.groupVisibilityDefault")} — ${t(locale, groupDefaultKey)}`
        : defaultLabel ?? t(locale, "composer.visibilityDefault")}</option>}
      <option value="public">{t(locale, "composer.visibilityPublic")}</option>
      <option value="members">{t(locale, "composer.visibilityMembers")}</option>
      <option value="friends">{t(locale, "composer.visibilityFriends")}</option>
      {includeUnlisted && <option value="unlisted">{t(locale, "composer.visibilityUnlisted")}</option>}
      {includePrivate && <option value="private">{t(locale, "composer.visibilityPrivate")}</option>}
    </select>
  );
}
