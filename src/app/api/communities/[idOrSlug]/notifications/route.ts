import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function resolveCommunityForMember(idOrSlug: string, userId: string) {
  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }],
    },
    select: {
      id: true,
      members: {
        where: { userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!community) {
    return null;
  }

  if (community.members.length === 0) {
    return null;
  }

  return community;
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/notifications">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;
  const community = await resolveCommunityForMember(idOrSlug, session.userId);
  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  const preference = await prisma.communityNotificationPreference.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: session.userId,
      },
    },
    select: { isSubscribed: true },
  });

  return Response.json({
    subscribed: preference?.isSubscribed !== false,
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/notifications">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;
  const community = await resolveCommunityForMember(idOrSlug, session.userId);
  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const subscribed = Boolean(body?.subscribed);

  if (subscribed) {
    await prisma.communityNotificationPreference.deleteMany({
      where: {
        communityId: community.id,
        userId: session.userId,
      },
    });
  } else {
    await prisma.communityNotificationPreference.upsert({
      where: {
        communityId_userId: {
          communityId: community.id,
          userId: session.userId,
        },
      },
      create: {
        communityId: community.id,
        userId: session.userId,
        isSubscribed: false,
      },
      update: {
        isSubscribed: false,
      },
    });
  }

  return Response.json({ subscribed });
}
