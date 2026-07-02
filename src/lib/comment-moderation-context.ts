import { prisma } from "@/lib/prisma";

export async function loadCommentModerationContext(commentId: string) {
  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      content: true,
      postId: true,
      parentId: true,
      moderationStatus: true,
      moderationReason: true,
      moderationExplanation: true,
      author: {
        select: { id: true, name: true, email: true },
      },
      post: {
        select: {
          id: true,
          content: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedUrl: true,
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
      },
      parent: {
        select: {
          id: true,
          content: true,
          author: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!comment) {
    return null;
  }

  const sharedContent = [
    comment.post.sharedTitle,
    comment.post.sharedDescription,
    comment.post.sharedSource,
    comment.post.sharedUrl,
    comment.post.sharedPost?.content,
    comment.post.sharedPost?.sharedTitle,
    comment.post.sharedPost?.sharedDescription,
    comment.post.sharedPost?.sharedSource,
    comment.post.sharedPost?.sharedUrl,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    comment,
    postContent: comment.post.content ?? undefined,
    sharedContent: sharedContent || undefined,
    parentComment: comment.parent?.content ?? undefined,
  };
}
