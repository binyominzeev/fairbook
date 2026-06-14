import { NextRequest } from "next/server";
import { calculatePostScore } from "@/lib/feed-ranking";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moderatePost } from "@/lib/ai";

function buildModerationMessage(moderation: Awaited<ReturnType<typeof moderatePost>>) {
  if (moderation.source === "fallback") {
    return `Moderation issue: ${moderation.diagnostic ?? moderation.reasonShort}. Post is visible only to you until this is fixed.`;
  }

  if (moderation.status === "visible") {
    return "Post accepted.";
  }

  return `Post filtered: ${moderation.reasonShort}. Only you can see it.`;
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = 20;

  // Get users I follow
  const following = await prisma.connection.findMany({
    where: { followerId: session.userId },
    select: { followingId: true },
  });
  const followingIds = following.map((c) => c.followingId);
  // Include own posts
  const authorIds = [...followingIds, session.userId];

  const posts = await prisma.post.findMany({
    where: {
      AND: [
        { authorId: { in: authorIds } },
        {
          OR: [
            { authorId: session.userId },
            { moderationStatus: "visible" },
          ],
        },
        {
          OR: [{ feedSourceId: null }, { isFeedVisible: true }],
        },
      ],
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          content: true,
          sharedUrl: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedImageUrl: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      likes: { where: { userId: session.userId }, select: { id: true }, take: 1 },
      sharedBy: {
        where: { authorId: session.userId },
        select: { id: true },
        take: 1,
      },
      _count: { select: { comments: true, likes: true, sharedBy: true } },
    },
  });

  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return Response.json({ posts: items, nextCursor });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { content, sharedUrl, sharedTitle, sharedDescription, sharedSource, sharedImageUrl } =
    await request.json();

  if (!content && !sharedUrl) {
    return Response.json(
      { error: "Post must have content or a shared URL." },
      { status: 400 }
    );
  }

  const createdAt = new Date();
  const nextScore = calculatePostScore({ createdAt, sourceWeight: 1, commentCount: 0 });
  const sharedContent = [sharedTitle, sharedDescription, sharedSource, sharedUrl]
    .filter(Boolean)
    .join("\n");
  const moderation = await moderatePost({
    postContent: content ?? undefined,
    sharedContent: sharedContent || undefined,
  });

  const post = await prisma.post.create({
    data: {
      authorId: session.userId,
      content,
      sharedUrl,
      sharedTitle,
      sharedDescription,
      sharedSource,
      sharedImageUrl,
      moderationStatus: moderation.status,
      moderationReason:
        moderation.status === "author_only" ? moderation.reasonShort : null,
      moderationExplanation:
        moderation.status === "author_only" ? moderation.explanation : null,
      moderatedAt: new Date(),
      createdAt,
      fetchedAt: createdAt,
      ...nextScore,
      lastScoredAt: createdAt,
    },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          content: true,
          sharedUrl: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedImageUrl: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      likes: { where: { userId: session.userId }, select: { id: true }, take: 1 },
      sharedBy: {
        where: { authorId: session.userId },
        select: { id: true },
        take: 1,
      },
      _count: { select: { comments: true, likes: true, sharedBy: true } },
    },
  });

  return Response.json(
    {
      post,
      moderation,
      message: buildModerationMessage(moderation),
    },
    { status: 201 }
  );
}
