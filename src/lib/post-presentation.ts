import { Prisma } from "@/generated/prisma/client";
import { buildPostPermalinkPath } from "@/lib/post-permalink";

export interface SerializedAuthor {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
}

export interface SerializedCommunity {
  id: string;
  permalinkSlug: string | null;
  name: string;
}

export interface SerializedSharedPost {
  id: string;
  permalinkPath: string;
  content: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedImageUrl: string | null;
  imageUrls: string[];
  isTextCard: boolean;
  createdAt: string;
  author: SerializedAuthor;
}

export interface SerializedCommentPreview {
  id: string;
  content: string;
  createdAt: string;
  author: SerializedAuthor;
}

export interface SerializedPost {
  id: string;
  permalinkSlug: string | null;
  permalinkPath: string;
  content: string | null;
  feedSourceId: string | null;
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedImageUrl: string | null;
  imageUrls: string[];
  isTextCard: boolean;
  createdAt: string;
  author: SerializedAuthor;
  likedByCurrentUser: boolean;
  bookmarkedByCurrentUser: boolean;
  sharedByCurrentUser: boolean;
  notificationsSubscribedByCurrentUser: boolean;
  canDeleteByViewer: boolean;
  sharedPost: SerializedSharedPost | null;
  community: SerializedCommunity | null;
  _count: { comments: number; likes: number; sharedBy: number };
  tags?: { id: string; name: string; color: string }[];
  commentPreviews?: SerializedCommentPreview[];
}

export interface SerializedProfileComment {
  id: string;
  content: string;
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  createdAt: string;
  post: {
    id: string;
    permalinkPath: string;
    content: string | null;
    sharedTitle: string | null;
    sharedSource: string | null;
    author: SerializedAuthor;
  };
}

export const buildPostInclude = (viewerId: string) =>
  ({
    author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
    sharedPost: {
      select: {
        id: true,
        permalinkSlug: true,
        content: true,
        sharedUrl: true,
        sharedTitle: true,
        sharedDescription: true,
        sharedSource: true,
        sharedImageUrl: true,
        imageUrls: true,
        isTextCard: true,
        createdAt: true,
        author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
        community: { select: { id: true, permalinkSlug: true } },
      },
    },
    postTags: { include: { tag: true } },
    likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
    bookmarkedBy: { where: { userId: viewerId }, select: { id: true }, take: 1 },
    sharedBy: {
      where: { authorId: viewerId },
      select: { id: true },
      take: 1,
    },
    notificationPreferences: {
      where: { userId: viewerId },
      select: { isSubscribed: true },
      take: 1,
    },
    _count: { select: { comments: true, likes: true, sharedBy: true } },
    community: {
      select: {
        id: true,
        permalinkSlug: true,
        name: true,
        members: {
          where: { userId: viewerId },
          select: { role: true },
          take: 1,
        },
      },
    },
  }) satisfies Prisma.PostInclude;

type PostForPresentation = {
  id: string;
  permalinkSlug: string | null;
  content: string | null;
  feedSourceId: string | null;
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedImageUrl: string | null;
  imageUrls: string | null;
  isTextCard: boolean;
  createdAt: Date;
  author: SerializedAuthor;
  likes: { id: string }[];
  bookmarkedBy: { id: string }[];
  sharedBy: { id: string }[];
  notificationPreferences: { isSubscribed: boolean }[];
  community: {
    id: string;
    permalinkSlug: string | null;
    name: string;
    members: { role: string }[];
  } | null;
  sharedPost: {
    id: string;
    permalinkSlug: string | null;
    content: string | null;
    sharedUrl: string | null;
    sharedTitle: string | null;
    sharedDescription: string | null;
    sharedSource: string | null;
    sharedImageUrl: string | null;
    imageUrls: string | null;
    isTextCard: boolean;
    createdAt: Date;
    author: SerializedAuthor;
    community: {
      id: string;
      permalinkSlug: string | null;
    } | null;
  } | null;
  _count: { comments: number; likes: number; sharedBy: number };
  postTags: { tag: { id: string; name: string; color: string } }[];
};

type CommentForPresentation = {
  id: string;
  content: string;
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  createdAt: Date;
  post: {
    id: string;
    permalinkSlug: string | null;
    createdAt: Date;
    content: string | null;
    sharedTitle: string | null;
    sharedSource: string | null;
    author: SerializedAuthor;
      community: {
        id: string;
        permalinkSlug: string | null;
      } | null;
  };
};

export function serializePost(post: PostForPresentation): SerializedPost {
  const parseImageUrls = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  };

  return {
    ...post,
    permalinkPath: buildPostPermalinkPath({
      author: post.author,
      community: post.community,
      createdAt: post.createdAt,
      slug: post.permalinkSlug,
      postId: post.id,
    }),
    imageUrls: parseImageUrls(post.imageUrls),
    createdAt: post.createdAt.toISOString(),
    likedByCurrentUser: post.likes.length > 0,
    bookmarkedByCurrentUser: post.bookmarkedBy.length > 0,
    sharedByCurrentUser: post.sharedBy.length > 0,
    notificationsSubscribedByCurrentUser:
      post.notificationPreferences[0]?.isSubscribed !== false,
    canDeleteByViewer:
      post.community?.members.some(
        (member) => member.role === "admin" || member.role === "moderator"
      ) ?? false,
    community: post.community
      ? {
          id: post.community.id,
          permalinkSlug: post.community.permalinkSlug,
          name: post.community.name,
        }
      : null,
    sharedPost: post.sharedPost
      ? {
          ...post.sharedPost,
          permalinkPath: buildPostPermalinkPath({
            author: post.sharedPost.author,
            community: post.sharedPost.community,
            createdAt: post.sharedPost.createdAt,
            slug: post.sharedPost.permalinkSlug,
            postId: post.sharedPost.id,
          }),
          imageUrls: parseImageUrls(post.sharedPost.imageUrls),
          createdAt: post.sharedPost.createdAt.toISOString(),
        }
      : null,
    tags: post.postTags?.map((pt) => ({ id: pt.tag.id, name: pt.tag.name, color: pt.tag.color })) ?? [],
  };
}

export function serializeProfileComment(
  comment: CommentForPresentation
): SerializedProfileComment {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    post: {
      ...comment.post,
      permalinkPath: buildPostPermalinkPath({
        author: comment.post.author,
        community: comment.post.community,
        createdAt: comment.post.createdAt,
        slug: comment.post.permalinkSlug,
        postId: comment.post.id,
      }),
    },
  };
}