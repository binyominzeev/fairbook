import type { Prisma } from "@/generated/prisma/client";

type CommunityAccessRecord =
  | {
      isPrivate: boolean;
      members?: readonly unknown[];
    }
  | null
  | undefined;

export function canViewerAccessCommunity(community: CommunityAccessRecord) {
  if (!community?.isPrivate) {
    return true;
  }

  return Array.isArray(community.members) && community.members.length > 0;
}

export function canViewerAccessCommunityPost(
  community: CommunityAccessRecord,
  visibility: string
) {
  if (visibility === "unlisted" && community) {
    return community.isPrivate || (Array.isArray(community.members) && community.members.length > 0);
  }
  return canViewerAccessCommunity(community);
}

export function buildVisibleCommunityPostWhere(viewerId: string): Prisma.PostWhereInput {
  return {
    OR: [
      { communityId: null },
      {
        community: {
          is: {
            members: {
              some: { userId: viewerId },
            },
          },
        },
      },
    ],
  };
}