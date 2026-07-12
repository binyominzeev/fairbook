import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1200;
const MAX_SLUG_LENGTH = 72;

function stripDiacritics(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeCommunityName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_NAME_LENGTH);
}

export function normalizeCommunityDescription(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, MAX_DESCRIPTION_LENGTH);
}

export function slugifyCommunityPermalink(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

function randomSlugSuffix() {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

export async function ensureUniqueCommunitySlug(
  baseSlug: string,
  opts?: { excludeCommunityId?: string }
) {
  const normalized = slugifyCommunityPermalink(baseSlug);
  const fallbackBase = normalized || `group-${randomSlugSuffix()}`;

  const isTaken = async (candidate: string) => {
    const row = await prisma.community.findFirst({
      where: {
        permalinkSlug: candidate,
        ...(opts?.excludeCommunityId
          ? { NOT: { id: opts.excludeCommunityId } }
          : {}),
      },
      select: { id: true },
    });

    return Boolean(row);
  };

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
}

export function isCommunityModeratorRole(role: string | null | undefined) {
  return role === "admin" || role === "moderator";
}
