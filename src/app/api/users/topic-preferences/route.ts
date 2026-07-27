import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isHexColor } from "@/lib/topics";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const rows = await prisma.userTopicPreference.findMany({
    where: { userId: session.userId },
    select: {
      topicId: true,
      buttonColor: true,
    },
  });

  return Response.json({
    preferences: rows.map((row) => ({
      topicId: row.topicId,
      buttonColor: row.buttonColor,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const topicId = (body as { topicId?: unknown }).topicId;
  const buttonColor = (body as { buttonColor?: unknown }).buttonColor;

  if (typeof topicId !== "string" || !topicId.trim()) {
    return Response.json({ error: "Topic is required." }, { status: 400 });
  }

  if (buttonColor !== null && buttonColor !== undefined && !isHexColor(buttonColor)) {
    return Response.json({ error: "Color must be a hex value like #1E40AF." }, { status: 400 });
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true },
  });

  if (!topic) {
    return Response.json({ error: "Topic not found." }, { status: 404 });
  }

  const saved = await prisma.userTopicPreference.upsert({
    where: {
      userId_topicId: {
        userId: session.userId,
        topicId: topic.id,
      },
    },
    update: {
      buttonColor: buttonColor ?? null,
    },
    create: {
      userId: session.userId,
      topicId: topic.id,
      buttonColor: buttonColor ?? null,
    },
    select: {
      topicId: true,
      buttonColor: true,
    },
  });

  return Response.json({ preference: saved });
}