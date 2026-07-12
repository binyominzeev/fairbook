import { getSession } from "@/lib/auth";
import { isCommunityModeratorRole } from "@/lib/communities";
import { prisma } from "@/lib/prisma";

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
