import { getSession } from "@/lib/auth";
import { moderatePost } from "@/lib/ai";
import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";

function buildModerationMessage(moderation: Awaited<ReturnType<typeof moderatePost>>) {
  if (moderation.source === "fallback") {
    return `Moderation issue: ${moderation.diagnostic ?? moderation.reasonShort}. Post is visible only to you until this is fixed.`;
  }

  if (moderation.status === "visible") {
    return "Post updated.";
  }

  return `Post updated and filtered: ${moderation.reasonShort}. Only you can see it.`;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildSharedContent(post: {
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedUrl: string | null;
  sharedPost:
    | {
        content: string | null;
        sharedTitle: string | null;
        sharedDescription: string | null;
        sharedSource: string | null;
        sharedUrl: string | null;
      }
    | null;
}) {
  return [
    post.sharedTitle,
    post.sharedDescription,
    post.sharedSource,
    post.sharedUrl,
    post.sharedPost?.content,
    post.sharedPost?.sharedTitle,
    post.sharedPost?.sharedDescription,
    post.sharedPost?.sharedSource,
    post.sharedPost?.sharedUrl,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPreModerationKey(input: {
  content: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
}) {
  return [
    input.content ?? "",
    input.sharedUrl ?? "",
    input.sharedTitle ?? "",
    input.sharedDescription ?? "",
    input.sharedSource ?? "",
  ].join("||");
}

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          permalinkSlug: true,
          content: true,
          feedSourceId: true,
          sharedUrl: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedImageUrl: true,
          imageUrls: true,
          createdAt: true,
          author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
        },
      },
      likes: { where: { userId: session.userId }, select: { id: true }, take: 1 },
      sharedBy: {
        where: { authorId: session.userId },
        select: { id: true },
        take: 1,
      },
      _count: { select: { comments: true, likes: true, sharedBy: true } },
      reflections: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.moderationStatus === "author_only" && post.author.id !== session.userId) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  return Response.json({ post });
}

export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/posts/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const payload = await req.json().catch(() => ({}));

  const content = normalizeOptionalString(payload?.content);
  const sharedUrl = normalizeOptionalString(payload?.sharedUrl);
  const sharedTitle = normalizeOptionalString(payload?.sharedTitle);
  const sharedDescription = normalizeOptionalString(payload?.sharedDescription);
  const sharedSource = normalizeOptionalString(payload?.sharedSource);
  const moderationKey = buildPreModerationKey({
    content,
    sharedUrl,
    sharedTitle,
    sharedDescription,
    sharedSource,
  });

  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      imageUrls: true,
      sharedImageUrl: true,
      sharedPost: {
        select: {
          content: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedUrl: true,
        },
      },
    },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const hasImages = typeof post.imageUrls === "string" && post.imageUrls.trim().length > 0;
  const hasSharedPost = Boolean(post.sharedPost);

  if (!content && !sharedUrl && !hasImages && !hasSharedPost) {
    return Response.json(
      { error: "Post must have content, images, or a shared URL." },
      { status: 400 }
    );
  }

  let moderation = null;
  if (
    payload?.preModeration &&
    typeof payload.preModeration === "object" &&
    payload.preModeration.moderation &&
    payload.preModeration.content === moderationKey
  ) {
    moderation = payload.preModeration.moderation;
  } else {
    moderation = await moderatePost({
      postContent: content ?? undefined,
      sharedContent:
        buildSharedContent({
          sharedTitle,
          sharedDescription,
          sharedSource,
          sharedUrl,
          sharedPost: post.sharedPost,
        }) || undefined,
    });
  }

  const updatedPost = await prisma.post.update({
    where: { id },
    data: {
      content,
      sharedUrl,
      sharedTitle,
      sharedDescription,
      sharedSource,
      moderationStatus: moderation.status,
      moderationReason:
        moderation.status === "author_only" ? moderation.reasonShort : null,
      moderationExplanation:
        moderation.status === "author_only" ? moderation.explanation : null,
      moderatedAt: new Date(),
    },
    include: buildPostInclude(session.userId),
  });

  return Response.json({
    post: serializePost(updatedPost),
    moderation,
    message: buildModerationMessage(moderation),
  });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/posts/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({ where: { id } });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });
  return Response.json({ success: true });
}
