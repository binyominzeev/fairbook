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
  createdAt: string;
  author: SerializedAuthor;
}

export interface SerializedPost {
  id: string;
  content: string | null;
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedImageUrl: string | null;
  createdAt: string;
  author: SerializedAuthor;
  likedByCurrentUser: boolean;
  sharedByCurrentUser: boolean;
  sharedPost: SerializedSharedPost | null;
  _count: { comments: number; likes: number; sharedBy: number };
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
        createdAt: true,
        author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      },
    },
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
  moderationStatus: string;
  moderationReason: string | null;
  moderationExplanation: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  sharedImageUrl: string | null;
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
    createdAt: Date;
    author: SerializedAuthor;
  } | null;
  _count: { comments: number; likes: number; sharedBy: number };
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
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    likedByCurrentUser: post.likes.length > 0,
    sharedByCurrentUser: post.sharedBy.length > 0,
    sharedPost: post.sharedPost
      ? {
          ...post.sharedPost,
          createdAt: post.sharedPost.createdAt.toISOString(),
        }
      : null,
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