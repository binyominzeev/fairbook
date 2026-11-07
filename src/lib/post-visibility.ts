import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const POST_VISIBILITIES = ["public", "members", "friends", "unlisted"] as const;
export type PostVisibility = (typeof POST_VISIBILITIES)[number];

export function normalizePostVisibility(value: unknown): PostVisibility | null {
  return typeof value === "string" && (POST_VISIBILITIES as readonly string[]).includes(value)
    ? (value as PostVisibility)
    : null;
}

/** Prisma filter selecting the posts a viewer (null = not logged in) may see. */
export function buildPostAudienceWhere(viewerId: string | null | undefined): Prisma.PostWhereInput {
  if (!viewerId || viewerId === "__guest__") {
    return { visibility: "public" };
  }

  return {
    OR: [
      { authorId: viewerId },
      { visibility: { in: ["public", "members"] } },
      {
        visibility: "unlisted",
        community: { is: { members: { some: { userId: viewerId } } } },
      },
      {
        visibility: "friends",
        author: {
          is: {
            followers: { some: { followerId: viewerId } },
            following: { some: { followingId: viewerId } },
          },
        },
      },
    ],
  };
}

export async function canViewerSeePostAudience(
  post: { authorId: string; visibility: string },
  viewerId: string | null | undefined
): Promise<boolean> {
  if (post.visibility === "public") return true;
  if (!viewerId || viewerId === "__guest__") return false;
  if (post.authorId === viewerId) return true;
  if (post.visibility !== "friends") return true;

  const [following, followedBy] = await Promise.all([
    prisma.connection.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: post.authorId } },
      select: { id: true },
    }),
    prisma.connection.findUnique({
      where: { followerId_followingId: { followerId: post.authorId, followingId: viewerId } },
      select: { id: true },
    }),
  ]);
  return Boolean(following && followedBy);
}

/** Resolves the client-requested visibility ("private" = author-only moderation state). */
export function resolveRequestedVisibility(
  requested: unknown,
  userDefault: string | null | undefined
): { visibility: PostVisibility; forcedPrivate: boolean } {
  if (requested === "private") {
    return { visibility: normalizePostVisibility(userDefault) ?? "members", forcedPrivate: true };
  }
  return {
    visibility: normalizePostVisibility(requested) ?? normalizePostVisibility(userDefault) ?? "members",
    forcedPrivate: false,
  };
}
