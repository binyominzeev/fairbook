import { getSession } from "@/lib/auth";
import {
  ensureUniqueCommunitySlug,
  isCommunityModeratorRole,
  slugifyCommunityPermalink,
} from "@/lib/communities";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/permalink">
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

  const requestedSlugRaw =
    typeof body === "object" && body !== null && "slug" in body
      ? (body as { slug?: unknown }).slug
      : "";
  const requestedSlug = slugifyCommunityPermalink(
    typeof requestedSlugRaw === "string" ? requestedSlugRaw : ""
  );

  if (!requestedSlug) {
    return Response.json(
      { error: "Permalink slug must contain letters or numbers." },
      { status: 400 }
    );
  }

  const uniqueSlug = await ensureUniqueCommunitySlug(requestedSlug, {
    excludeCommunityId: community.id,
  });

  const updated = await prisma.community.update({
    where: { id: community.id },
    data: { permalinkSlug: uniqueSlug },
    select: { id: true, permalinkSlug: true },
  });

  return Response.json({
    communityId: updated.id,
    permalinkSlug: updated.permalinkSlug,
    permalinkPath: `/groups/${updated.permalinkSlug ?? updated.id}`,
  });
}
