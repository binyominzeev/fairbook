import { getSession } from "@/lib/auth";
import {
  isCommunityModeratorRole,
  normalizeCommunityAvatarUrl,
  normalizeCommunityDescription,
  normalizeCommunityName,
} from "@/lib/communities";
import { prisma } from "@/lib/prisma";

async function findCommunity(idOrSlug: string, viewerId: string) {
  return prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }],
    },
    include: {
      owner: {
        select: { id: true, slug: true, name: true, avatarUrl: true },
      },
      members: {
        where: { userId: viewerId },
        select: { id: true, role: true },
        take: 1,
      },
      invites: {
        where: {
          inviteeId: viewerId,
          status: "pending",
        },
        select: { id: true },
        take: 1,
      },
      joinRequests: {
        where: {
          requesterId: viewerId,
          status: "pending",
        },
        select: { id: true },
        take: 1,
      },
      _count: {
        select: { members: true, posts: true },
      },
    },
  });
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;
  const community = await findCommunity(idOrSlug, session.userId);

  if (!community) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  return Response.json({
    community: {
      id: community.id,
      name: community.name,
      permalinkSlug: community.permalinkSlug,
      description: community.description,
      avatarUrl: community.avatarUrl,
      isPrivate: community.isPrivate,
      createdAt: community.createdAt.toISOString(),
      owner: community.owner,
      membershipRole: community.members[0]?.role ?? null,
      isMember: community.members.length > 0,
      isModerator: isCommunityModeratorRole(community.members[0]?.role),
      hasPendingInvite: community.invites.length > 0,
      hasPendingRequest: community.joinRequests.length > 0,
      memberCount: community._count.members,
      postCount: community._count.posts,
    },
  });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]">
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

  const role = community.members[0]?.role;
  if (!isCommunityModeratorRole(role)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const nextName =
    typeof body === "object" && body !== null && "name" in body
      ? normalizeCommunityName((body as { name?: unknown }).name)
      : community.name;

  const nextDescription =
    typeof body === "object" && body !== null && "description" in body
      ? normalizeCommunityDescription((body as { description?: unknown }).description)
      : (community.description ?? "");

  const visibility =
    typeof body === "object" && body !== null && "visibility" in body
      ? (body as { visibility?: unknown }).visibility
      : community.isPrivate
        ? "closed"
        : "public";
  const shouldUpdateAvatar =
    typeof body === "object" && body !== null && "avatarUrl" in body;

  let avatarUrl: string | null | undefined;
  if (shouldUpdateAvatar) {
    try {
      avatarUrl = normalizeCommunityAvatarUrl((body as { avatarUrl?: unknown }).avatarUrl);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid avatar." },
        { status: 400 }
      );
    }
  }

  if (!nextName) {
    return Response.json({ error: "Group name is required." }, { status: 400 });
  }

  if (!nextDescription) {
    return Response.json({ error: "Group description is required." }, { status: 400 });
  }

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: {
      name: nextName,
      description: nextDescription,
      ...(shouldUpdateAvatar ? { avatarUrl } : {}),
      isPrivate: visibility === "closed",
    },
    select: {
      id: true,
      name: true,
      description: true,
      avatarUrl: true,
      isPrivate: true,
      permalinkSlug: true,
    },
  });

  return Response.json({ community: updated });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]">
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

  if (community.ownerId !== session.userId) {
    return Response.json({ error: "Only the owner can delete this group." }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.communityJoinRequest.deleteMany({ where: { communityId: community.id } });
    await tx.communityInvite.deleteMany({ where: { communityId: community.id } });
    await tx.communityNotificationPreference.deleteMany({ where: { communityId: community.id } });
    await tx.communityMember.deleteMany({ where: { communityId: community.id } });
    await tx.post.updateMany({
      where: { communityId: community.id },
      data: { communityId: null },
    });
    await tx.notification.deleteMany({ where: { communityId: community.id } });
    await tx.community.delete({ where: { id: community.id } });
  });

  return Response.json({ success: true });
}
