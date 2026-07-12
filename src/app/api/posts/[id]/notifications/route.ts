import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function resolvePostForViewer(postId: string, userId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      authorId: true,
      moderationStatus: true,
      community: {
        select: {
          isPrivate: true,
          members: {
            where: { userId },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  if (!post) {
    return null;
  }

  if (post.moderationStatus === "author_only" && post.authorId !== userId) {
    return null;
  }

  if (post.community?.isPrivate && post.community.members.length === 0) {
    return null;
  }

  return post;
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/posts/[id]/notifications">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const post = await resolvePostForViewer(id, session.userId);
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const preference = await prisma.postNotificationPreference.findUnique({
    where: {
      postId_userId: {
        postId: id,
        userId: session.userId,
      },
    },
    select: { isSubscribed: true },
  });

  return Response.json({
    subscribed: preference?.isSubscribed !== false,
  });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/posts/[id]/notifications">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const post = await resolvePostForViewer(id, session.userId);
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const subscribed = Boolean(body?.subscribed);

  if (subscribed) {
    await prisma.postNotificationPreference.deleteMany({
      where: {
        postId: id,
        userId: session.userId,
      },
    });
  } else {
    await prisma.postNotificationPreference.upsert({
      where: {
        postId_userId: {
          postId: id,
          userId: session.userId,
        },
      },
      create: {
        postId: id,
        userId: session.userId,
        isSubscribed: false,
      },
      update: {
        isSubscribed: false,
      },
    });
  }

  return Response.json({ subscribed });
}
