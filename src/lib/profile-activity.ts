import { Prisma } from "@/generated/prisma/client";
import {
  buildPostInclude,
  serializePost,
  serializeProfileComment,
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

  return {
    posts: items.map((post: PostRecord) => serializePost(post)),
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

  return {
    posts: items.map((like) => serializePost(like.post as PostRecord)),
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

  return {
    posts: items.map((hiddenPost) => serializePost(hiddenPost.post as PostRecord)),
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

  return {
    posts: items.map((bookmark) => serializePost(bookmark.post as PostRecord)),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}