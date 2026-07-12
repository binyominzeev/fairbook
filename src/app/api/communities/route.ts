import { getSession } from "@/lib/auth";
import {
  ensureUniqueCommunitySlug,
  normalizeCommunityDescription,
  normalizeCommunityName,
} from "@/lib/communities";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  const scope = (searchParams.get("scope") ?? "all").trim();

  const communities = await prisma.community.findMany({
    where: {
      ...(scope === "joined"
        ? {
            members: {
              some: {
                userId: session.userId,
              },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      owner: {
        select: { id: true, slug: true, name: true, avatarUrl: true },
      },
      members: {
        where: { userId: session.userId },
        select: { id: true, role: true },
        take: 1,
      },
      invites: {
        where: {
          inviteeId: session.userId,
          status: "pending",
        },
        select: { id: true },
        take: 1,
      },
      joinRequests: {
        where: {
          requesterId: session.userId,
          status: "pending",
        },
        select: { id: true },
        take: 1,
      },
      _count: {
        select: { members: true, posts: true },
      },
    },
    take: 80,
  });

  return Response.json({
    communities: communities.map((community) => ({
      id: community.id,
      name: community.name,
      permalinkSlug: community.permalinkSlug,
      description: community.description,
      isPrivate: community.isPrivate,
      createdAt: community.createdAt.toISOString(),
      owner: community.owner,
      membershipRole: community.members[0]?.role ?? null,
      isMember: community.members.length > 0,
      hasPendingInvite: community.invites.length > 0,
      hasPendingRequest: community.joinRequests.length > 0,
      memberCount: community._count.members,
      postCount: community._count.posts,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name =
    typeof body === "object" && body !== null && "name" in body
      ? normalizeCommunityName((body as { name?: unknown }).name)
      : "";
  const description =
    typeof body === "object" && body !== null && "description" in body
      ? normalizeCommunityDescription((body as { description?: unknown }).description)
      : "";
  const visibility =
    typeof body === "object" && body !== null && "visibility" in body
      ? (body as { visibility?: unknown }).visibility
      : "public";

  if (!name) {
    return Response.json({ error: "Group name is required." }, { status: 400 });
  }

  if (!description) {
    return Response.json({ error: "Group description is required." }, { status: 400 });
  }

  const isPrivate = visibility === "closed";
  const permalinkSlug = await ensureUniqueCommunitySlug(name);

  const community = await prisma.community.create({
    data: {
      name,
      description,
      isPrivate,
      permalinkSlug,
      ownerId: session.userId,
      members: {
        create: {
          userId: session.userId,
          role: "admin",
        },
      },
    },
    include: {
      members: {
        where: { userId: session.userId },
        select: { role: true },
        take: 1,
      },
      _count: {
        select: { members: true, posts: true },
      },
    },
  });

  return Response.json(
    {
      community: {
        id: community.id,
        name: community.name,
        permalinkSlug: community.permalinkSlug,
        description: community.description,
        isPrivate: community.isPrivate,
        createdAt: community.createdAt.toISOString(),
        membershipRole: community.members[0]?.role ?? null,
        isMember: true,
        memberCount: community._count.members,
        postCount: community._count.posts,
      },
    },
    { status: 201 }
  );
}
