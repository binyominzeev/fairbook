import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeTopicKey, normalizeTopicName } from "@/lib/topics";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function GET() {
  const session = await getSession();

  const topics = await prisma.topic.findMany({
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
  });

  let preferredColorByTopicId = new Map<string, string | null>();
  if (session?.userId && topics.length > 0) {
    const preferences = await prisma.userTopicPreference.findMany({
      where: {
        userId: session.userId,
        topicId: { in: topics.map((topic) => topic.id) },
      },
      select: {
        topicId: true,
        buttonColor: true,
      },
    });

    preferredColorByTopicId = new Map(
      preferences.map((preference) => [preference.topicId, preference.buttonColor])
    );
  }

  return Response.json({
    topics: topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      defaultColor: topic.defaultColor,
      buttonColor: preferredColorByTopicId.get(topic.id) ?? null,
      postCount: topic._count.posts,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const name = normalizeTopicName((body as { name?: unknown }).name);
  if (!name) {
    return Response.json({ error: "Topic name is required." }, { status: 400 });
  }

  const normalizedName = normalizeTopicKey(name);

  try {
    const created = await prisma.topic.create({
      data: {
        name,
        normalizedName,
      },
      select: {
        id: true,
        name: true,
        defaultColor: true,
      },
    });

    return Response.json({ topic: created }, { status: 201 });
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      return Response.json({ error: "Could not create topic." }, { status: 500 });
    }

    const existing = await prisma.topic.findUnique({
      where: { normalizedName },
      select: { id: true, name: true, defaultColor: true },
    });

    if (!existing) {
      return Response.json({ error: "Could not create topic." }, { status: 500 });
    }

    return Response.json({ topic: existing }, { status: 200 });
  }
}