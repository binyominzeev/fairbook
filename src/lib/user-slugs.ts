import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const MAX_USER_SLUG_LENGTH = 48;

function trimSlug(slug: string) {
  return slug.replace(/^-+|-+$/g, "");
}

export function slugifyUserValue(value: string) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "-")
    .replace(/[\s_-]+/g, "-")
    .replace(/-+/g, "-");

  return trimSlug(normalized).slice(0, MAX_USER_SLUG_LENGTH);
}

function buildSlugCandidate(baseSlug: string, suffix?: number) {
  if (!suffix) {
    return baseSlug;
  }

  const suffixValue = `-${suffix}`;
  return `${baseSlug.slice(0, MAX_USER_SLUG_LENGTH - suffixValue.length)}${suffixValue}`;
}

export function normalizeRequestedUserSlug(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("A slug csak szoveg lehet.");
  }

  const slug = slugifyUserValue(value);
  if (!slug) {
    throw new Error("Adj meg legalabb egy betut vagy szamot a slughoz.");
  }

  return slug;
}

export async function generateUniqueUserSlug(name: string, excludeUserId?: string) {
  const baseSlug = slugifyUserValue(name) || "user";

  for (let suffix = 0; suffix < 10_000; suffix += 1) {
    const candidate = buildSlugCandidate(baseSlug, suffix || undefined);
    const existing = await prisma.user.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === excludeUserId) {
      return candidate;
    }
  }

  throw new Error("Nem sikerult egyedi slugot generalni.");
}

export async function claimRequestedUserSlug(requestedSlug: unknown, excludeUserId?: string) {
  const slug = normalizeRequestedUserSlug(requestedSlug);
  const existing = await prisma.user.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (existing && existing.id !== excludeUserId) {
    throw new Error("Ez a slug mar foglalt.");
  }

  return slug;
}

export async function resolveUserByProfileIdentifier<T extends Prisma.UserSelect>(
  identifier: string,
  select: T
) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  const userBySlug = await prisma.user.findUnique({
    where: { slug: normalizedIdentifier },
    select,
  });
  if (userBySlug) {
    return userBySlug;
  }

  return prisma.user.findUnique({
    where: { id: identifier },
    select,
  });
}