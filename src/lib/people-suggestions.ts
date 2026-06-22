import { prisma } from "@/lib/prisma";

type SuggestedPersonRow = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
  followsViewer: boolean;
  _count: {
    followers: number;
    following: number;
  };
};

export type SuggestedPerson = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  followsViewer: boolean;
};

function compareSuggestedPeople(a: SuggestedPersonRow, b: SuggestedPersonRow) {
  const followsViewerDiff = Number(b.followsViewer) - Number(a.followsViewer);
  if (followsViewerDiff !== 0) return followsViewerDiff;

  const avatarDiff = Number(Boolean(b.avatarUrl)) - Number(Boolean(a.avatarUrl));
  if (avatarDiff !== 0) return avatarDiff;

  const followerDiff = b._count.followers - a._count.followers;
  if (followerDiff !== 0) return followerDiff;

  const followingDiff = b._count.following - a._count.following;
  if (followingDiff !== 0) return followingDiff;

  const createdAtDiff = b.createdAt.getTime() - a.createdAt.getTime();
  if (createdAtDiff !== 0) return createdAtDiff;

  return a.name.localeCompare(b.name, "hu");
}

export async function getSuggestedPeople(viewerId: string, limit?: number) {
  const connectionRows = await prisma.connection.findMany({
    where: {
      OR: [{ followerId: viewerId }, { followingId: viewerId }],
    },
    select: {
      followerId: true,
      followingId: true,
    },
  });

  const excludedIds = new Set([viewerId]);
  const followerIds = new Set<string>();

  for (const row of connectionRows) {
    if (row.followerId === viewerId) {
      excludedIds.add(row.followingId);
      continue;
    }

    if (row.followingId === viewerId) {
      followerIds.add(row.followerId);
    }
  }

  const people = await prisma.user.findMany({
    where: {
      isPage: false,
      id: { notIn: [...excludedIds] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      avatarUrl: true,
      bio: true,
      createdAt: true,
      _count: {
        select: {
          followers: true,
          following: true,
        },
      },
    },
  });

  const sortedPeople = people
    .map((person) => ({
      ...person,
      followsViewer: followerIds.has(person.id),
    }))
    .sort(compareSuggestedPeople);
  const limitedPeople = typeof limit === "number" ? sortedPeople.slice(0, limit) : sortedPeople;

  return limitedPeople.map(({ id, slug, name, avatarUrl, bio, followsViewer }) => ({
    id,
    slug,
    name,
    avatarUrl,
    bio,
    followsViewer,
  }));
}