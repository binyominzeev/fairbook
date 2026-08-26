import { prisma } from "@/lib/prisma";

/**
 * Two users may message each other if either one follows the other (any
 * direction) and neither has blocked the other.
 */
export async function canUsersMessage(userAId: string, userBId: string): Promise<boolean> {
  if (userAId === userBId) return false;

  const [connection, block] = await Promise.all([
    prisma.connection.findFirst({
      where: {
        OR: [
          { followerId: userAId, followingId: userBId },
          { followerId: userBId, followingId: userAId },
        ],
      },
      select: { id: true },
    }),
    prisma.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: userAId, blockedId: userBId },
          { blockerId: userBId, blockedId: userAId },
        ],
      },
      select: { id: true },
    }),
  ]);

  return Boolean(connection) && !block;
}

export type EligibleContact = {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
};

/** Users the given user can start a conversation with: anyone in their follow graph, minus blocks. */
export async function getEligibleContacts(userId: string, query?: string): Promise<EligibleContact[]> {
  const [connectionRows, blockRows] = await Promise.all([
    prisma.connection.findMany({
      where: {
        OR: [{ followerId: userId }, { followingId: userId }],
      },
      select: { followerId: true, followingId: true },
    }),
    prisma.userBlock.findMany({
      where: {
        OR: [{ blockerId: userId }, { blockedId: userId }],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);

  const blockedIds = new Set<string>();
  for (const row of blockRows) {
    blockedIds.add(row.blockerId === userId ? row.blockedId : row.blockerId);
  }

  const contactIds = new Set<string>();
  for (const row of connectionRows) {
    const otherId = row.followerId === userId ? row.followingId : row.followerId;
    if (otherId !== userId && !blockedIds.has(otherId)) {
      contactIds.add(otherId);
    }
  }

  if (contactIds.size === 0) return [];

  const trimmedQuery = query?.trim();
  const contacts = await prisma.user.findMany({
    where: {
      id: { in: [...contactIds] },
      isPage: false,
      ...(trimmedQuery ? { name: { contains: trimmedQuery } } : {}),
    },
    select: { id: true, slug: true, name: true, avatarUrl: true },
    orderBy: { name: "asc" },
  });

  return contacts;
}
