import { prisma } from "@/lib/prisma";
import { canUsersMessage } from "@/lib/messaging-eligibility";

export const CONVERSATION_PARTICIPANT_SELECT = {
  id: true,
  slug: true,
  name: true,
  avatarUrl: true,
} as const;

export class ConversationError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function assertParticipant(conversationId: string, userId: string) {
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!participant) {
    throw new ConversationError("Not a participant of this conversation.", 403);
  }
  return participant;
}

export async function findOrCreateDirectConversation(userAId: string, userBId: string) {
  if (userAId === userBId) {
    throw new ConversationError("Cannot start a conversation with yourself.", 400);
  }

  const eligible = await canUsersMessage(userAId, userBId);
  if (!eligible) {
    throw new ConversationError("You can only message people who follow you or whom you follow.", 403);
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      participants: { some: { userId: userAId } },
      AND: [{ participants: { some: { userId: userBId } } }],
    },
    include: { participants: true },
  });
  if (existing && existing.participants.length === 2) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      isGroup: false,
      participants: {
        create: [
          { userId: userAId, isCreator: true, isAdmin: true },
          { userId: userBId },
        ],
      },
    },
    include: { participants: true },
  });
}

export async function createGroupConversation(input: {
  creatorId: string;
  name: string;
  memberIds: string[];
}) {
  const { creatorId, name, memberIds } = input;
  const uniqueMemberIds = [...new Set(memberIds)].filter((id) => id !== creatorId);
  if (uniqueMemberIds.length < 2) {
    throw new ConversationError("A group conversation needs at least 2 other members.", 400);
  }
  if (!name.trim()) {
    throw new ConversationError("A group conversation needs a name.", 400);
  }

  const eligibility = await Promise.all(
    uniqueMemberIds.map((memberId) => canUsersMessage(creatorId, memberId))
  );
  if (eligibility.some((ok) => !ok)) {
    throw new ConversationError("You can only add people who follow you or whom you follow.", 403);
  }

  return prisma.conversation.create({
    data: {
      isGroup: true,
      name: name.trim(),
      participants: {
        create: [
          { userId: creatorId, isCreator: true, isAdmin: true },
          ...uniqueMemberIds.map((userId) => ({ userId })),
        ],
      },
    },
    include: { participants: true },
  });
}

async function assertGroupAdmin(conversationId: string, requesterId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation?.isGroup) {
    throw new ConversationError("Only group conversations support this action.", 400);
  }
  const requesterParticipant = await assertParticipant(conversationId, requesterId);
  if (!requesterParticipant.isAdmin && !requesterParticipant.isCreator) {
    throw new ConversationError("Only group admins can do this.", 403);
  }
  return requesterParticipant;
}

export async function addParticipant(conversationId: string, requesterId: string, newUserId: string) {
  await assertGroupAdmin(conversationId, requesterId);

  const eligible = await canUsersMessage(requesterId, newUserId);
  if (!eligible) {
    throw new ConversationError("You can only add people who follow you or whom you follow.", 403);
  }

  return prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId: newUserId } },
    create: { conversationId, userId: newUserId },
    update: {},
  });
}

export async function removeParticipant(conversationId: string, requesterId: string, targetUserId: string) {
  await assertGroupAdmin(conversationId, requesterId);

  const target = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) {
    throw new ConversationError("This user is not a member of the group.", 404);
  }
  if (target.isCreator) {
    throw new ConversationError("The group creator cannot be removed.", 400);
  }

  await prisma.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
}

export async function setParticipantAdmin(
  conversationId: string,
  requesterId: string,
  targetUserId: string,
  isAdmin: boolean
) {
  await assertGroupAdmin(conversationId, requesterId);

  const target = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
  });
  if (!target) {
    throw new ConversationError("This user is not a member of the group.", 404);
  }
  if (target.isCreator) {
    throw new ConversationError("The group creator's admin status cannot be changed.", 400);
  }

  return prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    data: { isAdmin },
  });
}

export async function leaveConversation(conversationId: string, userId: string) {
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation?.isGroup) {
    throw new ConversationError("You cannot leave a direct conversation.", 400);
  }
  const participant = await assertParticipant(conversationId, userId);
  if (participant.isCreator) {
    throw new ConversationError("The group creator cannot leave the group.", 400);
  }

  await prisma.conversationParticipant.delete({
    where: { conversationId_userId: { conversationId, userId } },
  });
}

export async function markConversationRead(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
}

export async function getUnreadCountForUser(userId: string): Promise<number> {
  const participations = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: { conversationId: true, lastReadAt: true },
  });
  if (participations.length === 0) return 0;

  const counts = await Promise.all(
    participations.map((participation) =>
      prisma.message.count({
        where: {
          conversationId: participation.conversationId,
          senderId: { not: userId },
          ...(participation.lastReadAt ? { createdAt: { gt: participation.lastReadAt } } : {}),
        },
      })
    )
  );

  return counts.reduce((sum, count) => sum + count, 0);
}
