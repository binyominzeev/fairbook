import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/communities/invites/[id]/accept">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const invite = await prisma.communityInvite.findUnique({
    where: { id },
    select: {
      id: true,
      communityId: true,
      inviteeId: true,
      status: true,
    },
  });

  if (!invite || invite.inviteeId !== session.userId) {
    return Response.json({ error: "Invite not found." }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return Response.json({ error: "Invite is no longer pending." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.communityMember.upsert({
      where: {
        communityId_userId: {
          communityId: invite.communityId,
          userId: session.userId,
        },
      },
      create: {
        communityId: invite.communityId,
        userId: session.userId,
        role: "member",
      },
      update: {},
    }),
    prisma.communityInvite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    }),
  ]);

  return Response.json({ success: true });
}
