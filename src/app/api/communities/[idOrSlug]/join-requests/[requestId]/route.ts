import { getSession } from "@/lib/auth";
import { isCommunityModeratorRole } from "@/lib/communities";
import { createGroupJoinApprovedNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/join-requests/[requestId]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug, requestId } = await ctx.params;

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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action =
    typeof body === "object" && body !== null && "action" in body
      ? (body as { action?: unknown }).action
      : null;

  if (action !== "approve" && action !== "reject") {
    return Response.json({ error: "action must be approve or reject." }, { status: 400 });
  }

  const joinRequest = await prisma.communityJoinRequest.findFirst({
    where: {
      id: requestId,
      communityId: community.id,
    },
    select: {
      id: true,
      requesterId: true,
      status: true,
    },
  });

  if (!joinRequest) {
    return Response.json({ error: "Join request not found." }, { status: 404 });
  }

  if (joinRequest.status !== "pending") {
    return Response.json({ error: "Join request is no longer pending." }, { status: 409 });
  }

  const handledAt = new Date();

  if (action === "approve") {
    await prisma.$transaction(async (tx) => {
      await tx.communityMember.upsert({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: joinRequest.requesterId,
          },
        },
        create: {
          communityId: community.id,
          userId: joinRequest.requesterId,
          role: "member",
        },
        update: {},
      });

      await tx.communityJoinRequest.update({
        where: { id: joinRequest.id },
        data: {
          status: "approved",
          handledById: session.userId,
          handledAt,
        },
      });

      await tx.communityInvite.deleteMany({
        where: {
          communityId: community.id,
          inviteeId: joinRequest.requesterId,
          status: "pending",
        },
      });
    });

    await createGroupJoinApprovedNotification({
      actorId: session.userId,
      recipientId: joinRequest.requesterId,
      communityId: community.id,
    });

    return Response.json({ success: true, status: "approved" });
  }

  await prisma.communityJoinRequest.update({
    where: { id: joinRequest.id },
    data: {
      status: "rejected",
      handledById: session.userId,
      handledAt,
    },
  });

  return Response.json({ success: true, status: "rejected" });
}
