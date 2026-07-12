import { getSession } from "@/lib/auth";
import { isCommunityModeratorRole } from "@/lib/communities";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/members/[memberId]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug, memberId } = await ctx.params;

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

  const target = await prisma.communityMember.findFirst({
    where: {
      id: memberId,
      communityId: community.id,
    },
    select: { id: true, userId: true, role: true },
  });

  if (!target) {
    return Response.json({ error: "Member not found." }, { status: 404 });
  }

  if (target.userId === community.ownerId) {
    return Response.json({ error: "Owner cannot be removed." }, { status: 400 });
  }

  await prisma.communityMember.delete({ where: { id: target.id } });
  return Response.json({ success: true });
}
