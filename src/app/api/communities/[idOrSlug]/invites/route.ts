import { getSession } from "@/lib/auth";
import { isCommunityModeratorRole } from "@/lib/communities";
import { createGroupInviteNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/invites">
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

  const invites = await prisma.communityInvite.findMany({
    where: {
      communityId: community.id,
      status: "pending",
    },
    include: {
      invitee: {
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      },
      inviter: {
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });

  return Response.json({
    invites: invites.map((invite) => ({
      id: invite.id,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
      invitee: invite.invitee,
      inviter: invite.inviter,
    })),
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/invites">
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

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const inviteeId =
    typeof body === "object" && body !== null && "inviteeId" in body
      ? (body as { inviteeId?: unknown }).inviteeId
      : null;

  if (typeof inviteeId !== "string" || !inviteeId.trim()) {
    return Response.json({ error: "inviteeId is required." }, { status: 400 });
  }

  if (inviteeId === session.userId) {
    return Response.json({ error: "You are already in this group." }, { status: 400 });
  }

  const existingMember = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: inviteeId,
      },
    },
    select: { id: true },
  });

  if (existingMember) {
    return Response.json({ error: "User is already a member." }, { status: 409 });
  }

  const invite = await prisma.communityInvite.upsert({
    where: {
      communityId_inviteeId: {
        communityId: community.id,
        inviteeId,
      },
    },
    update: {
      inviterId: session.userId,
      status: "pending",
    },
    create: {
      communityId: community.id,
      inviterId: session.userId,
      inviteeId,
      status: "pending",
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  await createGroupInviteNotification({
    actorId: session.userId,
    recipientId: inviteeId,
    communityId: community.id,
  });

  return Response.json({
    invite: {
      id: invite.id,
      status: invite.status,
      createdAt: invite.createdAt.toISOString(),
    },
  });
}
