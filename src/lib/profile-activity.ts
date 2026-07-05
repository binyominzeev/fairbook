import { Prisma } from "@/generated/prisma/client";
import {
  buildPostInclude,
  serializePost,
  serializeProfileComment,
  type SerializedCommentPreview,
  type SerializedPost,
  type SerializedProfileComment,
} from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";

export type ProfileActivityTab = "posts" | "likes" | "bookmarks" | "comments" | "hidden";
export type ProfileActivityViewMode = "normal" | "reels";

const PROFILE_POST_PAGE_SIZE = 20;
const PROFILE_LIKES_PAGE_SIZE = 20;
const PROFILE_COMMENTS_PAGE_SIZE = 30;
const PROFILE_HIDDEN_PAGE_SIZE = 20;
const PROFILE_BOOKMARKS_PAGE_SIZE = 20;

type PostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof buildPostInclude>;
}>;

type CommentRecord = Prisma.CommentGetPayload<{
  include: {
    post: {
      select: {
        id: true;
        permalinkSlug: true;
        createdAt: true;
        content: true;
        sharedTitle: true;
        sharedSource: true;
        author: { select: { id: true; slug: true; name: true; avatarUrl: true } };
      };
    };
  };
}>;

async function attachCommentPreviews(posts: SerializedPost[]): Promise<SerializedPost[]> {
  if (posts.length === 0) return posts;

  const postIds = posts.map((post) => post.id);
  const previewRows = await prisma.comment.findMany({
    where: {
      postId: { in: postIds },
      moderationStatus: "visible",
      parentId: null,
    },
    orderBy: { createdAt: "desc" },
    take: postIds.length * 12,
    include: {
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
    },
  });

  const previewsByPostId = new Map<string, SerializedCommentPreview[]>();
  for (const row of previewRows) {
    const bucket = previewsByPostId.get(row.postId) ?? [];
    if (bucket.length >= 3) continue;
    bucket.push({
      id: row.id,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      author: row.author,
    });
    previewsByPostId.set(row.postId, bucket);
  }

  return posts.map((post) => ({
    ...post,
    commentPreviews: previewsByPostId.get(post.id) ?? [],
  }));
}

function buildPostSearchWhere(query: string): Prisma.PostWhereInput {
  return {
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
  };
}

function buildProfileCommentSearchWhere(query: string): Prisma.CommentWhereInput {
  return {
    OR: [
      { content: { contains: query } },
      { post: buildPostSearchWhere(query) },
    ],
  };
}

export async function getProfileActivityAccess({
  viewerId,
  profileId,
  isPage,
}: {
  viewerId: string;
  profileId: string;
  isPage: boolean;
}) {
  const isOwnProfile = viewerId === profileId;

  if (isOwnProfile) {
    return {
      isOwnProfile: true,
      isFollowing: false,
      isFollowedBy: false,
      canViewActivity: !isPage,
    };
  }

  const [following, followedBy] = await Promise.all([
    prisma.connection.findUnique({
      where: {
        followerId_followingId: {
          followerId: viewerId,
          followingId: profileId,
        },
      },
    }),
    prisma.connection.findUnique({
      where: {
        followerId_followingId: {
          followerId: profileId,
          followingId: viewerId,
        },
      },
    }),
  ]);

  const isFollowing = Boolean(following);
  const isFollowedBy = Boolean(followedBy);

  return {
    isOwnProfile,
    isFollowing,
    isFollowedBy,
    canViewActivity: !isPage && isFollowing && isFollowedBy,
  };
}

export async function getProfilePostsPage({
  viewerId,
  profileId,
  isOwnProfile,
  cursor,
  query,
}: {
  viewerId: string;
  profileId: string;
  isOwnProfile: boolean;
  cursor?: string | null;
  query?: string;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  const trimmedQuery = query?.trim() ?? "";
  const batch = await prisma.post.findMany({
    where: {
      ...(isOwnProfile
        ? { authorId: profileId }
        : { authorId: profileId, moderationStatus: "visible" }),
      ...(trimmedQuery ? buildPostSearchWhere(trimmedQuery) : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_POST_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: buildPostInclude(viewerId),
  });

  const hasMore = batch.length > PROFILE_POST_PAGE_SIZE;
  const items = hasMore ? batch.slice(0, PROFILE_POST_PAGE_SIZE) : batch;
  const serialized = items.map((post: PostRecord) => serializePost(post));

  return {
    posts: await attachCommentPreviews(serialized),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getProfileLikedPostsPage({
  viewerId,
  profileId,
  isOwnProfile,
  canViewActivity,
  cursor,
  query,
}: {
  viewerId: string;
  profileId: string;
  isOwnProfile: boolean;
  canViewActivity: boolean;
  cursor?: string | null;
  query?: string;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  if (!canViewActivity) {
    return { posts: [], nextCursor: null };
  }

  const trimmedQuery = query?.trim() ?? "";

  const batch = await prisma.postLike.findMany({
    where: isOwnProfile
      ? {
          userId: profileId,
          ...(trimmedQuery ? { post: buildPostSearchWhere(trimmedQuery) } : {}),
        }
      : {
          userId: profileId,
          post: {
            AND: [
              {
                OR: [{ moderationStatus: "visible" }, { authorId: viewerId }],
              },
              ...(trimmedQuery ? [buildPostSearchWhere(trimmedQuery)] : []),
            ],
          },
        },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_LIKES_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      post: {
        include: buildPostInclude(viewerId),
      },
    },
  });

  const hasMore = batch.length > PROFILE_LIKES_PAGE_SIZE;
  const items = hasMore ? batch.slice(0, PROFILE_LIKES_PAGE_SIZE) : batch;
  const serialized = items.map((like) => serializePost(like.post as PostRecord));

  return {
    posts: await attachCommentPreviews(serialized),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getProfileCommentsPage({
  viewerId,
  profileId,
  isOwnProfile,
  canViewActivity,
  cursor,
  query,
}: {
  viewerId: string;
  profileId: string;
  isOwnProfile: boolean;
  canViewActivity: boolean;
  cursor?: string | null;
  query?: string;
}): Promise<{ comments: SerializedProfileComment[]; nextCursor: string | null }> {
  if (!canViewActivity) {
    return { comments: [], nextCursor: null };
  }

  const trimmedQuery = query?.trim() ?? "";

  const batch = await prisma.comment.findMany({
    where: {
      ...(isOwnProfile
        ? { authorId: profileId }
        : {
            authorId: profileId,
            moderationStatus: "visible",
            post: {
              OR: [{ moderationStatus: "visible" }, { authorId: viewerId }],
            },
          }),
      ...(trimmedQuery ? buildProfileCommentSearchWhere(trimmedQuery) : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_COMMENTS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      post: {
        select: {
          id: true,
          permalinkSlug: true,
          createdAt: true,
          content: true,
          sharedTitle: true,
          sharedSource: true,
          author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
        },
      },
    },
  });

  const hasMore = batch.length > PROFILE_COMMENTS_PAGE_SIZE;
  const items = hasMore ? batch.slice(0, PROFILE_COMMENTS_PAGE_SIZE) : batch;

  return {
    comments: items.map((comment: CommentRecord) => serializeProfileComment(comment)),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getProfileHiddenPostsPage({
  viewerId,
  profileId,
  isOwnProfile,
  cursor,
  query,
}: {
  viewerId: string;
  profileId: string;
  isOwnProfile: boolean;
  cursor?: string | null;
  query?: string;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  if (!isOwnProfile) {
    return { posts: [], nextCursor: null };
  }

  const trimmedQuery = query?.trim() ?? "";

  const batch = await prisma.hiddenPost.findMany({
    where: {
      userId: profileId,
      ...(trimmedQuery ? { post: buildPostSearchWhere(trimmedQuery) } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_HIDDEN_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      post: {
        include: buildPostInclude(viewerId),
      },
    },
  });

  const hasMore = batch.length > PROFILE_HIDDEN_PAGE_SIZE;
  const items = hasMore ? batch.slice(0, PROFILE_HIDDEN_PAGE_SIZE) : batch;
  const serialized = items.map((hiddenPost) => serializePost(hiddenPost.post as PostRecord));

  return {
    posts: await attachCommentPreviews(serialized),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}

export async function getProfileBookmarkedPostsPage({
  viewerId,
  profileId,
  isOwnProfile,
  cursor,
  query,
}: {
  viewerId: string;
  profileId: string;
  isOwnProfile: boolean;
  cursor?: string | null;
  query?: string;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  if (!isOwnProfile) {
    return { posts: [], nextCursor: null };
  }

  const trimmedQuery = query?.trim() ?? "";

  const batch = await prisma.bookmarkedPost.findMany({
    where: {
      userId: profileId,
      ...(trimmedQuery ? { post: buildPostSearchWhere(trimmedQuery) } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_BOOKMARKS_PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      post: {
        include: buildPostInclude(viewerId),
      },
    },
  });

  const hasMore = batch.length > PROFILE_BOOKMARKS_PAGE_SIZE;
  const items = hasMore ? batch.slice(0, PROFILE_BOOKMARKS_PAGE_SIZE) : batch;
  const serialized = items.map((bookmark) => serializePost(bookmark.post as PostRecord));

  return {
    posts: await attachCommentPreviews(serialized),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}