import { prisma } from "@/lib/prisma";

export async function loadPostModerationContext(postId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      content: true,
      moderationStatus: true,
      moderationReason: true,
      moderationExplanation: true,
      author: {
        select: { id: true, name: true, email: true },
      },
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
  });

  if (!post) {
    return null;
  }

  const sharedContent = [
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

  return {
    post,
    postContent: post.content ?? undefined,
    sharedContent: sharedContent || undefined,
  };
}
