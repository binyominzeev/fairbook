import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/leave">
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
    select: { id: true, ownerId: true },
  });

  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  if (community.ownerId === session.userId) {
    return Response.json({ error: "Owner cannot leave their own group." }, { status: 400 });
  }

  await prisma.communityMember.deleteMany({
    where: {
      communityId: community.id,
      userId: session.userId,
    },
  });

  await prisma.communityNotificationPreference.deleteMany({
    where: {
      communityId: community.id,
      userId: session.userId,
    },
  });

  return Response.json({ success: true });
}
