import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/join">
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
    select: { id: true },
  });

  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  await prisma.communityMember.upsert({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: session.userId,
      },
    },
    create: {
      communityId: community.id,
      userId: session.userId,
      role: "member",
    },
    update: {},
  });

  return Response.json({ success: true });
}
