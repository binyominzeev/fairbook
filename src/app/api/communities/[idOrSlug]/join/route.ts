import { getSession } from "@/lib/auth";
import {
  createGroupInviteAcceptedNotification,
} from "@/lib/notifications";
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
    include: {
      members: {
        where: { userId: session.userId },
        select: { id: true },
        take: 1,
      },
      invites: {
        where: {
          inviteeId: session.userId,
          status: "pending",
        },
        select: { id: true, inviterId: true },
        take: 1,
      },
    },
  });

  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  if (community.members.length > 0) {
    return Response.json({ success: true, membership: "joined" });
  }

  const pendingInviteId = community.invites[0]?.id ?? null;
  const pendingInviteInviterId = community.invites[0]?.inviterId ?? null;

  if (community.isPrivate && !pendingInviteId) {
    return Response.json(
      { error: "This group is invite-only." },
      { status: 403 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityMember.upsert({
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

    if (pendingInviteId) {
      await tx.communityInvite.update({
        where: { id: pendingInviteId },
        data: { status: "accepted" },
      });
    }

    await tx.communityJoinRequest.deleteMany({
      where: {
        communityId: community.id,
        requesterId: session.userId,
      },
    });
  });

  if (pendingInviteInviterId) {
    await createGroupInviteAcceptedNotification({
      actorId: session.userId,
      recipientId: pendingInviteInviterId,
      communityId: community.id,
    });
  }

  return Response.json({
    success: true,
    membership: "joined",
    via: pendingInviteId ? "invite" : "public",
  });
}
