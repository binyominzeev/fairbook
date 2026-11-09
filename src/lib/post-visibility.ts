import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export { POST_VISIBILITIES, normalizePostVisibility, resolveRequestedVisibility } from "@/lib/post-visibility-values";
export type { PostVisibility } from "@/lib/post-visibility-values";

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
