import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/communities/[id]/join">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const community = await prisma.community.findUnique({ where: { id } });
  if (!community) {
    return Response.json({ error: "Community not found." }, { status: 404 });
  }
  if (community.isPrivate) {
    return Response.json(
      { error: "This community is invite-only." },
      { status: 403 }
    );
  }

  const existing = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: id, userId: session.userId } },
  });
  if (existing) {
    return Response.json({ error: "Already a member." }, { status: 409 });
  }

  await prisma.communityMember.create({
    data: { communityId: id, userId: session.userId, role: "member" },
  });

  return Response.json({ success: true }, { status: 201 });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/communities/[id]/join">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  await prisma.communityMember.deleteMany({
    where: { communityId: id, userId: session.userId },
  });

  return Response.json({ success: true });
}
