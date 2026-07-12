import { randomUUID } from "crypto";
import { getProfileIdentifier, type ProfileLinkable } from "@/lib/profile-path";

const MAX_SLUG_LENGTH = 72;

export interface PostPermalinkCommunityLinkable {
  id: string;
  permalinkSlug: string | null;
}

export interface PostPermalinkScope {
  authorId: string;
  communityId?: string | null;
}

function stripDiacritics(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function slugifyPostText(value: string) {
  const normalized = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");

  return normalized;
}

function randomSlugSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

export function buildInitialPostSlug(
  content: string | null | undefined,
  postId?: string | null
) {
  const fromContent = slugifyPostText((content ?? "").slice(0, 160));
  if (fromContent) {
    return fromContent;
  }

  const postHint = postId?.slice(-6).toLowerCase() ?? "";
  return `post-${postHint || randomSlugSuffix()}`;
}

export function ensureUniquePostSlug(baseSlug: string, isTaken: (slug: string) => Promise<boolean>) {
  return (async () => {
    const normalized = slugifyPostText(baseSlug);
    const fallbackBase = normalized || `post-${randomSlugSuffix()}`;

    if (!(await isTaken(fallbackBase))) {
      return fallbackBase;
    }

    for (let attempt = 2; attempt <= 50; attempt += 1) {
      const nextSlug = `${fallbackBase}-${attempt}`;
      if (!(await isTaken(nextSlug))) {
        return nextSlug;
      }
    }

    return `${fallbackBase}-${randomSlugSuffix()}`;
  })();
}

export function buildPostPermalinkScopeId({
  authorId,
  communityId,
}: PostPermalinkScope) {
  return communityId ? `community:${communityId}` : `user:${authorId}`;
}

export function buildPostPermalinkScopeWhere({
  authorId,
  communityId,
  slug,
  excludePostId,
}: PostPermalinkScope & {
  slug: string;
  excludePostId?: string;
}) {
  return {
    ...(communityId ? { communityId } : { authorId, communityId: null }),
    permalinkSlug: slug,
    ...(excludePostId ? { NOT: { id: excludePostId } } : {}),
  };
}

export function buildPostPermalinkPath({
  author,
  community,
  createdAt,
  slug,
  postId,
}: {
  author: ProfileLinkable;
  community?: PostPermalinkCommunityLinkable | null;
  createdAt: Date;
  slug: string | null | undefined;
  postId: string;
}) {
  const year = String(createdAt.getUTCFullYear());
  const month = String(createdAt.getUTCMonth() + 1).padStart(2, "0");
  const tail = slug?.trim() || postId;

  if (community) {
    const groupIdentifier = community.permalinkSlug ?? community.id;
    return `/groups/${groupIdentifier}/${year}/${month}/${tail}`;
  }

  const identifier = getProfileIdentifier(author);

  return `/profile/${identifier}/${year}/${month}/${tail}`;
}
