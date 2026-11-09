export const POST_VISIBILITIES = ["public", "members", "friends", "unlisted"] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

export function normalizePostVisibility(value: unknown): PostVisibility | null {
  return typeof value === "string" && (POST_VISIBILITIES as readonly string[]).includes(value)
    ? (value as PostVisibility)
    : null;
}

export function resolveRequestedVisibility(
  requested: unknown,
  userDefault: string | null | undefined,
  groupDefault?: string | null
): { visibility: PostVisibility; forcedPrivate: boolean } {
  const defaultVisibility = normalizePostVisibility(groupDefault) ?? normalizePostVisibility(userDefault) ?? "members";
  if (requested === "private") {
    return { visibility: defaultVisibility, forcedPrivate: true };
  }
  return {
    visibility: normalizePostVisibility(requested) ?? defaultVisibility,
    forcedPrivate: false,
  };
}
