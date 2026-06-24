import { prisma } from "@/lib/prisma";

export type FeedGroupWithSources = {
  id: string;
  name: string;
  feedSourceIds: string[];
};

export type UserFeedSubscription = {
  id: string;
  title: string;
  pageName: string;
  pageSlug: string | null;
};

export function normalizeFeedGroupName(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, 64);
}

export async function getFeedGroupsForUser(userId: string): Promise<FeedGroupWithSources[]> {
  const groups = await prisma.feedGroup.findMany({
    where: { userId },
    orderBy: [{ name: "asc" }],
    include: {
      sources: {
        select: {
          feedSourceId: true,
        },
      },
    },
  });

  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    feedSourceIds: group.sources.map((source) => source.feedSourceId),
  }));
}

export async function getFeedGroupSourceIdsForUser(userId: string, groupId: string) {
  const group = await prisma.feedGroup.findFirst({
    where: {
      id: groupId,
      userId,
    },
    select: {
      sources: {
        select: { feedSourceId: true },
      },
    },
  });

  if (!group) {
    return null;
  }

  return group.sources.map((source) => source.feedSourceId);
}

export async function getUserFeedSubscriptions(userId: string): Promise<UserFeedSubscription[]> {
  const followingRows = await prisma.connection.findMany({
    where: {
      followerId: userId,
      following: {
        isPage: true,
        feedSource: {
          isNot: null,
        },
      },
    },
    orderBy: {
      following: {
        name: "asc",
      },
    },
    select: {
      following: {
        select: {
          name: true,
          slug: true,
          feedSource: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  return followingRows
    .map((row) => {
      const source = row.following.feedSource;
      if (!source) {
        return null;
      }

      return {
        id: source.id,
        title: source.title,
        pageName: row.following.name,
        pageSlug: row.following.slug,
      };
    })
    .filter((item): item is UserFeedSubscription => Boolean(item));
}
