import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { loadPostModerationContext } from "@/lib/post-moderation-context";
import { getPromptContent } from "@/lib/ai-prompts";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const [openAppeals, ownBlockedPosts, moderationPrompt] = await Promise.all([
    prisma.postAppeal.findMany({
      where: { status: "open" },
      orderBy: { createdAt: "desc" },
      include: {
        requester: { select: { id: true, name: true, email: true } },
        post: {
          select: {
            id: true,
            content: true,
            moderationReason: true,
            moderationExplanation: true,
            moderationStatus: true,
            createdAt: true,
            author: { select: { id: true, name: true, email: true } },
          },
        },
      },
      take: 40,
    }),
    prisma.post.findMany({
      where: {
        authorId: session.userId,
        moderationStatus: "author_only",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, content: true, createdAt: true },
      take: 20,
    }),
    getPromptContent("comment_moderation"),
  ]);

  const ownBlockedPostIds = ownBlockedPosts.map((post) => post.id);
  const openOwnAppealRows = ownBlockedPostIds.length
    ? await prisma.postAppeal.findMany({
        where: {
          postId: { in: ownBlockedPostIds },
          status: "open",
          requesterId: session.userId,
        },
        select: { postId: true },
      })
    : [];
  const openOwnAppealSet = new Set(openOwnAppealRows.map((row) => row.postId));

  const ownBlocked = ownBlockedPosts.map((post) => ({
    id: post.id,
    content: post.content,
    createdAt: post.createdAt,
    hasOpenAppeal: openOwnAppealSet.has(post.id),
  }));

  const appealsWithContext = await Promise.all(
    openAppeals.map(async (appeal) => {
      const context = await loadPostModerationContext(appeal.postId);
      return {
        id: appeal.id,
        status: appeal.status,
        requestText: appeal.requestText,
        createdAt: appeal.createdAt,
        requester: appeal.requester,
        post: appeal.post,
        context: context
          ? {
              postContent: context.postContent,
              sharedContent: context.sharedContent,
            }
          : null,
      };
    })
  );

  return Response.json({
    moderationPrompt,
    openAppeals: appealsWithContext,
    ownBlockedPosts: ownBlocked,
  });
}
