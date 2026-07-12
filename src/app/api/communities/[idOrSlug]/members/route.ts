import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/members">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }],
    },
    select: {
      id: true,
      members: {
        where: { userId: session.userId },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  if (community.members.length === 0) {
    return Response.json({ error: "Only group members can search members." }, { status: 403 });
  }

  const members = await prisma.communityMember.findMany({
    where: {
      communityId: community.id,
      ...(query
        ? {
            user: {
              OR: [{ name: { contains: query } }, { email: { contains: query } }],
            },
          }
        : {}),
    },
    orderBy: [{ joinedAt: "desc" }],
    include: {
      user: {
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      },
    },
    take: 60,
  });

  return Response.json({
    members: members.map((member) => ({
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    })),
  });
}
