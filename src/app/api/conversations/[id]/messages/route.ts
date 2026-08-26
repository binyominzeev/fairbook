import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUsersMessage } from "@/lib/messaging-eligibility";

const MAX_MESSAGE_LENGTH = 4000;
const PAGE_SIZE = 40;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: id, userId: session.userId } },
  });
  if (!participant) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const before = searchParams.get("before");

  const messages = await prisma.message.findMany({
    where: {
      conversationId: id,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { sender: { select: { id: true, slug: true, name: true, avatarUrl: true } } },
  });

  return Response.json({ messages: messages.reverse() });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]/messages">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    include: { participants: true },
  });
  if (!conversation) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const self = conversation.participants.find((p) => p.userId === session.userId);
  if (!self) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  if (!conversation.isGroup) {
    const other = conversation.participants.find((p) => p.userId !== session.userId);
    if (other) {
      const eligible = await canUsersMessage(session.userId, other.userId);
      if (!eligible) {
        return Response.json({ error: "You cannot message this user." }, { status: 403 });
      }
    }
  }

  const body = await request.json().catch(() => null);
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return Response.json({ error: "Message body is required." }, { status: 400 });
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    return Response.json({ error: "Message is too long." }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: { conversationId: id, senderId: session.userId, body: text },
    include: { sender: { select: { id: true, slug: true, name: true, avatarUrl: true } } },
  });

  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  return Response.json({ message });
}
