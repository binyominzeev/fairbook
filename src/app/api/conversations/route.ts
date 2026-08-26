import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ConversationError,
  CONVERSATION_PARTICIPANT_SELECT,
  createGroupConversation,
  findOrCreateDirectConversation,
} from "@/lib/conversations";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: session.userId } } },
    orderBy: { updatedAt: "desc" },
    include: {
      participants: {
        include: { user: { select: CONVERSATION_PARTICIPANT_SELECT } },
      },
      messages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });

  const conversationsWithUnread = await Promise.all(
    conversations.map(async (conversation) => {
      const self = conversation.participants.find((p) => p.userId === session.userId);
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: session.userId },
          ...(self?.lastReadAt ? { createdAt: { gt: self.lastReadAt } } : {}),
        },
      });

      return {
        id: conversation.id,
        isGroup: conversation.isGroup,
        name: conversation.name,
        updatedAt: conversation.updatedAt,
        participants: conversation.participants
          .filter((p) => p.userId !== session.userId)
          .map((p) => p.user),
        lastMessage: conversation.messages[0] ?? null,
        unreadCount,
      };
    })
  );

  return Response.json({ conversations: conversationsWithUnread });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const participantIds = Array.isArray(body?.participantIds)
    ? body.participantIds.filter((id: unknown): id is string => typeof id === "string")
    : [];
  const name = typeof body?.name === "string" ? body.name : "";

  if (participantIds.length === 0) {
    return Response.json({ error: "At least one participant is required." }, { status: 400 });
  }

  try {
    const conversation =
      participantIds.length === 1
        ? await findOrCreateDirectConversation(session.userId, participantIds[0])
        : await createGroupConversation({ creatorId: session.userId, name, memberIds: participantIds });

    return Response.json({ conversation });
  } catch (error) {
    if (error instanceof ConversationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
