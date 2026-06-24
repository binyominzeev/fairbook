import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import {
  getFeedGroupsForUser,
  getUserFeedSubscriptions,
  normalizeFeedGroupName,
} from "@/lib/feed-groups";
import { prisma } from "@/lib/prisma";

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const [groups, availableSources] = await Promise.all([
    getFeedGroupsForUser(session.userId),
    getUserFeedSubscriptions(session.userId),
  ]);

  return Response.json({ groups, availableSources });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

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

  try {
    const group = await prisma.feedGroup.create({
      data: {
        userId: session.userId,
        name,
      },
    });

    return Response.json(
      {
        group: {
          id: group.id,
          name: group.name,
          feedSourceIds: [],
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { error: "You already have a group with this name." },
        { status: 409 }
      );
    }

    return Response.json({ error: "Could not create feed group." }, { status: 500 });
  }
}
