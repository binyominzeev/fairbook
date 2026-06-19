import { prisma } from "@/lib/prisma";

type SuggestedPersonRow = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  createdAt: Date;
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
};

function compareSuggestedPeople(a: SuggestedPersonRow, b: SuggestedPersonRow) {
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

  for (const row of connectionRows) {
    excludedIds.add(row.followerId === viewerId ? row.followingId : row.followerId);
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

  const sortedPeople = people.sort(compareSuggestedPeople);
  const limitedPeople = typeof limit === "number" ? sortedPeople.slice(0, limit) : sortedPeople;

  return limitedPeople.map(({ id, slug, name, avatarUrl, bio }) => ({
    id,
    slug,
    name,
    avatarUrl,
    bio,
  }));
}