import { prisma } from "@/lib/prisma";

export async function getRecipientsMutingActor(actorId: string, recipientIds: string[]) {
  if (recipientIds.length === 0) {
    return new Set<string>();
  }

  const rows = await prisma.userNotificationMute.findMany({
    where: { mutedUserId: actorId, userId: { in: recipientIds } },
    select: { userId: true },
  });

  return new Set(rows.map((row) => row.userId));
}

export async function hasMutedActor(recipientId: string, actorId: string) {
  const row = await prisma.userNotificationMute.findUnique({
    where: { userId_mutedUserId: { userId: recipientId, mutedUserId: actorId } },
    select: { id: true },
  });

  return row !== null;
}
