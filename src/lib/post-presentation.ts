import { Prisma } from "@/generated/prisma/client";
import { buildPostPermalinkPath } from "@/lib/post-permalink";

export interface SerializedAuthor {
  id: string;
  slug: string | null;
  name: string;
  avatarUrl: string | null;
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
  createdAt: Date;
  author: SerializedAuthor;
  likes: { id: string }[];
  sharedBy: { id: string }[];
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
    permalinkSlug: string | null;
    createdAt: Date;
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
    permalinkPath: buildPostPermalinkPath({
      author: post.author,
      createdAt: post.createdAt,
      slug: post.permalinkSlug,
      postId: post.id,
    }),
    imageUrls: parseImageUrls(post.imageUrls),
    createdAt: post.createdAt.toISOString(),
    likedByCurrentUser: post.likes.length > 0,
    sharedByCurrentUser: post.sharedBy.length > 0,
    sharedPost: post.sharedPost
      ? {
          ...post.sharedPost,
          permalinkPath: buildPostPermalinkPath({
            author: post.sharedPost.author,
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
        createdAt: comment.post.createdAt,
        slug: comment.post.permalinkSlug,
        postId: comment.post.id,
      }),
    },
  };
}