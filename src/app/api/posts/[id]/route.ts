import { getSession } from "@/lib/auth";
import { moderatePost } from "@/lib/ai";
import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import { applyAuthorTopicColors } from "@/lib/topic-color-resolution";
import { prisma } from "@/lib/prisma";
import { normalizeTopicKey, normalizeTopicName } from "@/lib/topics";
import { unlink } from "fs/promises";
import path from "path";

const MAX_IMAGE_COUNT = 4;

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

function parseImageUrls(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.startsWith("/uploads/posts/"));
  } catch {
    return [];
  }
}

function normalizeImageUrls(value: unknown) {
  if (!Array.isArray(value)) return [];

  const normalized = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.startsWith("/uploads/posts/"));

  return normalized.slice(0, MAX_IMAGE_COUNT);
}

function toAbsoluteUploadPath(imageUrl: string) {
  const relativePath = imageUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", relativePath);
}

async function cleanupDeletedPostImages(post: {
  id: string;
  imageUrls: string | null;
  sharedImageUrl: string | null;
}) {
  const candidates = new Set(parseImageUrls(post.imageUrls));
  if (post.sharedImageUrl && post.sharedImageUrl.startsWith("/uploads/posts/")) {
    candidates.add(post.sharedImageUrl);
  }

  if (candidates.size === 0) {
    return;
  }

  for (const imageUrl of candidates) {
    const referencedElsewhere = await prisma.post.count({
      where: {
        id: { not: post.id },
        OR: [
          { imageUrls: { contains: imageUrl } },
          { sharedImageUrl: imageUrl },
        ],
      },
    });

    if (referencedElsewhere > 0) {
      continue;
    }

    const absolutePath = toAbsoluteUploadPath(imageUrl);
    try {
      await unlink(absolutePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        console.warn("Failed to delete uploaded image file:", absolutePath, err.message);
      }
    }
  }
}

async function cleanupRemovedPostImages(input: {
  postId: string;
  previousImageUrls: string[];
  nextImageUrls: string[];
}) {
  const nextSet = new Set(input.nextImageUrls);
  const removedUrls = input.previousImageUrls.filter((url) => !nextSet.has(url));

  if (removedUrls.length === 0) {
    return;
  }

  for (const imageUrl of removedUrls) {
    const referencedElsewhere = await prisma.post.count({
      where: {
        id: { not: input.postId },
        OR: [
          { imageUrls: { contains: imageUrl } },
          { sharedImageUrl: imageUrl },
        ],
      },
    });

    if (referencedElsewhere > 0) {
      continue;
    }

    const absolutePath = toAbsoluteUploadPath(imageUrl);
    try {
      await unlink(absolutePath);
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code !== "ENOENT") {
        console.warn("Failed to delete removed image file:", absolutePath, err.message);
      }
    }
  }
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
    include: buildPostInclude(session.userId),
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.moderationStatus === "author_only" && post.author.id !== session.userId) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.community?.isPrivate && post.community.members.length === 0) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const [serializedPost] = await applyAuthorTopicColors([serializePost(post)]);

  return Response.json({ post: serializedPost });
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
  const hasTopicSelectionInPayload =
    typeof payload === "object" &&
    payload !== null &&
    (Object.hasOwn(payload, "topicId") || Object.hasOwn(payload, "newTopicName"));
  const requestedTopicId =
    typeof payload?.topicId === "string" ? payload.topicId.trim() : "";
  const requestedNewTopicName = normalizeTopicName(payload?.newTopicName);
  const hasImageUrlsInPayload = Array.isArray(payload?.imageUrls);
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

  if (hasTopicSelectionInPayload && requestedTopicId && requestedNewTopicName) {
    return Response.json(
      { error: "Choose an existing topic or create a new one, not both." },
      { status: 400 }
    );
  }

  let resolvedTopicId: string | null = null;
  if (hasTopicSelectionInPayload) {
    if (requestedTopicId) {
      const existingTopic = await prisma.topic.findUnique({
        where: { id: requestedTopicId },
        select: { id: true },
      });
      if (!existingTopic) {
        return Response.json({ error: "Topic not found." }, { status: 404 });
      }
      resolvedTopicId = existingTopic.id;
    }

    if (requestedNewTopicName) {
      const normalizedName = normalizeTopicKey(requestedNewTopicName);
      const createdOrExistingTopic = await prisma.topic.upsert({
        where: { normalizedName },
        update: {},
        create: {
          name: requestedNewTopicName,
          normalizedName,
        },
        select: { id: true },
      });
      resolvedTopicId = createdOrExistingTopic.id;
    }
  }

  const previousImageUrls = parseImageUrls(post.imageUrls);
  const normalizedImageUrls = hasImageUrlsInPayload
    ? normalizeImageUrls(payload?.imageUrls)
    : previousImageUrls;
  const hasImages = normalizedImageUrls.length > 0;
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
      ...(hasTopicSelectionInPayload ? { topicId: resolvedTopicId } : {}),
      imageUrls: normalizedImageUrls.length > 0 ? JSON.stringify(normalizedImageUrls) : null,
      moderationStatus: moderation.status,
      moderationReason:
        moderation.status === "author_only" ? moderation.reasonShort : null,
      moderationExplanation:
        moderation.status === "author_only" ? moderation.explanation : null,
      moderatedAt: new Date(),
    },
    include: buildPostInclude(session.userId),
  });

  await cleanupRemovedPostImages({
    postId: post.id,
    previousImageUrls,
    nextImageUrls: normalizedImageUrls,
  });

  const [serializedPost] = await applyAuthorTopicColors([serializePost(updatedPost)]);

  return Response.json({
    post: serializedPost,
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
  const post = await prisma.post.findUnique({
    where: { id },
    select: {
      id: true,
      authorId: true,
      imageUrls: true,
      sharedImageUrl: true,
      community: {
        select: {
          id: true,
          members: {
            where: { userId: session.userId },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }
  const membershipRole = post.community?.members[0]?.role;
  const canModerateCommunity = membershipRole === "admin" || membershipRole === "moderator";

  if (post.authorId !== session.userId && !canModerateCommunity) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  await prisma.post.delete({ where: { id } });
  await cleanupDeletedPostImages(post);
  return Response.json({ success: true });
}
