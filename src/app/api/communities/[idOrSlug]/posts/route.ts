import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/communities/[idOrSlug]/posts">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { idOrSlug } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const query = (searchParams.get("q") ?? "").trim();

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

  const isMember = community.members.length > 0;
  if (community.isPrivate && !isMember) {
    return Response.json({ error: "Group not found." }, { status: 404 });
  }

  if (query && !isMember) {
    return Response.json(
      { error: "Only group members can search inside a group." },
      { status: 403 }
    );
  }

  const rows = await prisma.post.findMany({
    where: {
      communityId: community.id,
      ...(query
        ? {
            OR: [
              { content: { contains: query } },
              { sharedTitle: { contains: query } },
              { sharedDescription: { contains: query } },
              { sharedSource: { contains: query } },
              { author: { name: { contains: query } } },
              {
                postTags: {
                  some: {
                    tag: {
                      name: { contains: query },
                    },
                  },
                },
              },
            ],
          }
        : {}),
      OR: [{ moderationStatus: "visible" }, { authorId: session.userId }],
      hiddenBy: {
        none: {
          userId: session.userId,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: buildPostInclude(session.userId),
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return Response.json({
    posts: items.map((row) => serializePost(row)),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  });
}
