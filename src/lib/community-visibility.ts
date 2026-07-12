import { Prisma } from "@/generated/prisma/client";

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

export function buildVisibleCommunityPostWhere(viewerId: string): Prisma.PostWhereInput {
  return {
    OR: [
      { communityId: null },
      { community: { is: { isPrivate: false } } },
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