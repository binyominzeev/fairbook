import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { normalizeFeedGroupName } from "@/lib/feed-groups";
import { prisma } from "@/lib/prisma";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/feed-groups/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name =
    typeof body === "object" && body !== null && "name" in body
      ? normalizeFeedGroupName((body as { name?: unknown }).name)
      : "";

  if (!name) {
    return Response.json({ error: "Group name is required." }, { status: 400 });
  }

  const group = await prisma.feedGroup.findFirst({
    where: { id, userId: session.userId },
    select: { id: true },
  });
  if (!group) {
    return Response.json({ error: "Feed group not found." }, { status: 404 });
  }

  try {
    const updated = await prisma.feedGroup.update({
      where: { id },
      data: { name },
    });

    return Response.json({
      group: {
        id: updated.id,
        name: updated.name,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { error: "You already have a group with this name." },
        { status: 409 }
      );
    }

    return Response.json({ error: "Could not rename feed group." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/feed-groups/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const result = await prisma.feedGroup.deleteMany({
    where: {
      id,
      userId: session.userId,
    },
  });

  if (result.count === 0) {
    return Response.json({ error: "Feed group not found." }, { status: 404 });
  }

  return Response.json({ success: true });
}
