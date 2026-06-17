import { NextRequest } from "next/server";
import { calculatePostScore } from "@/lib/feed-ranking";
import { getSession } from "@/lib/auth";
import { getFeedPage } from "@/lib/feed-posts";
import { prisma } from "@/lib/prisma";
import { moderatePost } from "@/lib/ai";

const MAX_IMAGE_COUNT = 4;

function normalizeImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.startsWith("/uploads/posts/"));

  return normalized.slice(0, MAX_IMAGE_COUNT);
}

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

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { hideViolentFeed: true },
  });
  if (!user) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const page = await getFeedPage({
    viewerId: session.userId,
    hideViolentFeed: user.hideViolentFeed,
    cursor,
  });

  return Response.json(page);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const {
    content,
    sharedUrl,
    sharedTitle,
    sharedDescription,
    sharedSource,
    sharedImageUrl,
    imageUrls,
    preModeration,
  } =
    await request.json();
  const normalizedImageUrls = normalizeImageUrls(imageUrls);

  if (!content && !sharedUrl && normalizedImageUrls.length === 0) {
    return Response.json(
      { error: "Post must have content, images, or a shared URL." },
      { status: 400 }
    );
  }

  const createdAt = new Date();
  const nextScore = calculatePostScore({ createdAt, sourceWeight: 1, commentCount: 0 });
  const sharedContent = [sharedTitle, sharedDescription, sharedSource, sharedUrl]
    .filter(Boolean)
    .join("\n");

  const key = `${(content ?? "").trim()}||${(sharedUrl ?? "").trim()}`;
  let moderation = null;
  if (
    preModeration &&
    typeof preModeration === "object" &&
    preModeration.moderation &&
    preModeration.content === key
  ) {
    moderation = preModeration.moderation;
  } else {
    moderation = await moderatePost({
      postContent: content ?? undefined,
      sharedContent: sharedContent || undefined,
    });
  }

  const post = await prisma.post.create({
    data: {
      authorId: session.userId,
      content,
      sharedUrl,
      sharedTitle,
      sharedDescription,
      sharedSource,
      sharedImageUrl,
      imageUrls: normalizedImageUrls.length > 0 ? JSON.stringify(normalizedImageUrls) : null,
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
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          content: true,
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
