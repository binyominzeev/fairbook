import { NextRequest } from "next/server";
import { calculatePostScore } from "@/lib/feed-ranking";
import { getSession } from "@/lib/auth";
import { getFeedGroupSourceIdsForUser } from "@/lib/feed-groups";
import { getFeedPage, normalizeFeedSortMode } from "@/lib/feed-posts";
import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import {
  buildInitialPostSlug,
  buildPostPermalinkScopeId,
  buildPostPermalinkScopeWhere,
  ensureUniquePostSlug,
} from "@/lib/post-permalink";
import { createGroupPostNotifications } from "@/lib/notifications";
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
  const mode = searchParams.get("mode");
  const groupId = searchParams.get("group");
  const query = (searchParams.get("q") ?? "").trim();
  const sortMode = normalizeFeedSortMode(searchParams.get("sort"));

  let viewMode: "all" | "following" | "group" =
    mode === "following" ? "following" : "all";
  let groupSourceIds: string[] | undefined;
  if (groupId) {
    const resolvedGroupSourceIds = await getFeedGroupSourceIdsForUser(
      session.userId,
      groupId
    );
    if (resolvedGroupSourceIds) {
      viewMode = "group";
      groupSourceIds = resolvedGroupSourceIds;
    }
  }

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
    viewMode,
    feedSourceIds: groupSourceIds,
    query,
    sortMode,
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
    isTextCard,
    communityId,
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

  let resolvedCommunityId: string | null = null;
  if (typeof communityId === "string" && communityId.trim()) {
    const membership = await prisma.communityMember.findUnique({
      where: {
        communityId_userId: {
          communityId,
          userId: session.userId,
        },
      },
      select: { id: true },
    });

    if (!membership) {
      return Response.json(
        { error: "You must join the group before posting there." },
        { status: 403 }
      );
    }

    resolvedCommunityId = communityId;
  }

  const initialPermalinkSlug = await ensureUniquePostSlug(
    buildInitialPostSlug(typeof content === "string" ? content : null, null),
    async (candidate) => {
      const existing = await prisma.post.findFirst({
        where: buildPostPermalinkScopeWhere({
          authorId: session.userId,
          communityId: resolvedCommunityId,
          slug: candidate,
        }),
        select: { id: true },
      });
      return Boolean(existing);
    }
  );

  const post = await prisma.post.create({
    data: {
      authorId: session.userId,
      communityId: resolvedCommunityId,
      permalinkScopeId: buildPostPermalinkScopeId({
        authorId: session.userId,
        communityId: resolvedCommunityId,
      }),
      permalinkSlug: initialPermalinkSlug,
      content,
      sharedUrl,
      sharedTitle,
      sharedDescription,
      sharedSource,
      sharedImageUrl,
      imageUrls: normalizedImageUrls.length > 0 ? JSON.stringify(normalizedImageUrls) : null,
      isTextCard: isTextCard === true,
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
    include: buildPostInclude(session.userId),
  });

  if (moderation.status === "visible" && resolvedCommunityId) {
    void createGroupPostNotifications({
      actorId: session.userId,
      communityId: resolvedCommunityId,
      postId: post.id,
    });
  }

  return Response.json(
    {
      post: serializePost(post),
      moderation,
      message: buildModerationMessage(moderation),
    },
    { status: 201 }
  );
}
