import { getSession } from "@/lib/auth";
import { isCommunityModeratorRole } from "@/lib/communities";
import { prisma } from "@/lib/prisma";
import { createGroupJoinRequestNotifications } from "@/lib/notifications";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/join-requests">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;
  const community = await prisma.community.findFirst({
    where: { OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }] },
    select: {
      id: true,
      isPrivate: true,
      members: { where: { userId: session.userId }, select: { id: true }, take: 1 },
    },
  });
  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }
  if (community.members.length > 0) {
    return Response.json({ success: true, membership: "joined" });
  }
  if (!community.isPrivate) {
    return Response.json({ error: "Join requests are only available for private groups." }, { status: 400 });
  }

  const request = await prisma.communityJoinRequest.findUnique({
    where: { communityId_requesterId: { communityId: community.id, requesterId: session.userId } },
    select: { status: true },
  });
  if (request?.status === "pending") {
    return Response.json({ success: true, membership: "pending" });
  }

  await prisma.communityJoinRequest.upsert({
    where: { communityId_requesterId: { communityId: community.id, requesterId: session.userId } },
    create: { communityId: community.id, requesterId: session.userId },
    update: { status: "pending", handledById: null, handledAt: null, createdAt: new Date() },
  });
  await createGroupJoinRequestNotifications({ actorId: session.userId, communityId: community.id });
  return Response.json({ success: true, membership: "pending" });
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/join-requests">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;

  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }],
    },
    include: {
      members: {
        where: { userId: session.userId },
        select: { role: true },
        take: 1,
      },
    },
  });

  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  if (!isCommunityModeratorRole(community.members[0]?.role)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const requests = await prisma.communityJoinRequest.findMany({
    where: {
      communityId: community.id,
      status: "pending",
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      requester: {
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      },
    },
    take: 100,
  });

  return Response.json({
    requests: requests.map((request) => ({
      id: request.id,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
      requester: request.requester,
    })),
  });
}
