import { getSession } from "@/lib/auth";
import { getUserFeedSubscriptions } from "@/lib/feed-groups";
import { prisma } from "@/lib/prisma";

function normalizeSourceIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/feed-groups/[id]/sources">
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }

    const { id } = await ctx.params;

    const group = await prisma.feedGroup.findFirst({
      where: {
        id,
        userId: session.userId,
      },
      select: { id: true },
    });
    if (!group) {
      return Response.json({ error: "Feed group not found." }, { status: 404 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const requestedSourceIds =
      typeof body === "object" && body !== null && "feedSourceIds" in body
        ? normalizeSourceIds((body as { feedSourceIds?: unknown }).feedSourceIds)
        : [];

    const allowedSources = await getUserFeedSubscriptions(session.userId);
    const allowedSourceIds = new Set(allowedSources.map((source) => source.id));
    const selectedSourceIds = requestedSourceIds.filter((sourceId) =>
      allowedSourceIds.has(sourceId)
    );

    await prisma.$transaction(async (tx) => {
      await tx.feedGroupFeedSource.deleteMany({
        where: { feedGroupId: id },
      });

      if (selectedSourceIds.length > 0) {
        await tx.feedGroupFeedSource.createMany({
          data: selectedSourceIds.map((feedSourceId) => ({
            feedGroupId: id,
            feedSourceId,
          })),
        });
      }
    });

    return Response.json({
      feedSourceIds: selectedSourceIds,
    });
  } catch {
    return Response.json({ error: "Could not save group sources." }, { status: 500 });
  }
}
