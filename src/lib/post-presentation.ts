import { Prisma } from "@/generated/prisma/client";

export interface SerializedAuthor {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
}

export interface SerializedSharedPost {
  id: string;
  content: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedImageUrl: string | null;
  imageUrls: string[];
  createdAt: string;
  author: SerializedAuthor;
}

export interface SerializedPost {
  id: string;
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
  createdAt: string;
  author: SerializedAuthor;
  likedByCurrentUser: boolean;
  sharedByCurrentUser: boolean;
  sharedPost: SerializedSharedPost | null;
  _count: { comments: number; likes: number; sharedBy: number };
  tags?: { id: string; name: string; color: string }[];
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
    postTags: { include: { tag: true } },
    likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
    sharedBy: {
      where: { authorId: viewerId },
      select: { id: true },
      take: 1,
    },
    _count: { select: { comments: true, likes: true, sharedBy: true } },
  }) satisfies Prisma.PostInclude;

type PostForPresentation = {
  id: string;
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
  createdAt: Date;
  author: SerializedAuthor;
  likes: { id: string }[];
  sharedBy: { id: string }[];
  sharedPost: {
    id: string;
    content: string | null;
    sharedUrl: string | null;
    sharedTitle: string | null;
    sharedDescription: string | null;
    sharedSource: string | null;
    sharedImageUrl: string | null;
    imageUrls: string | null;
    createdAt: Date;
    author: SerializedAuthor;
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
    content: string | null;
    sharedTitle: string | null;
    sharedSource: string | null;
    author: SerializedAuthor;
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
    imageUrls: parseImageUrls(post.imageUrls),
    createdAt: post.createdAt.toISOString(),
    likedByCurrentUser: post.likes.length > 0,
    sharedByCurrentUser: post.sharedBy.length > 0,
    sharedPost: post.sharedPost
      ? {
          ...post.sharedPost,
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
  };
}