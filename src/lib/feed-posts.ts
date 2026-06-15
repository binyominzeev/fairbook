import { Prisma } from "@/generated/prisma/client";
import { filterViolentFeedPostsForUser } from "@/lib/feed-content-filter";
import {
  buildPostInclude,
  serializePost,
  type SerializedPost,
} from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";

export const FEED_PAGE_SIZE = 20;

type FeedPostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof buildPostInclude>;
}>;

export async function getFeedPage({
  viewerId,
  hideViolentFeed,
  cursor,
}: {
  viewerId: string;
  hideViolentFeed: boolean;
  cursor?: string | null;
}): Promise<{ posts: SerializedPost[]; nextCursor: string | null }> {
  const following = await prisma.connection.findMany({
    where: { followerId: viewerId },
    select: { followingId: true },
  });
  const authorIds = [viewerId, ...following.map((connection) => connection.followingId)];
  const postInclude = buildPostInclude(viewerId);

  const chunkSize = hideViolentFeed ? 60 : FEED_PAGE_SIZE + 1;
  const collected: FeedPostRecord[] = [];
  let nextDbCursor = cursor ?? null;
  let exhausted = false;

  while (collected.length < FEED_PAGE_SIZE + 1 && !exhausted) {
    const batch = (await prisma.post.findMany({
      where: {
        AND: [
          { authorId: { in: authorIds } },
          {
            OR: [{ authorId: viewerId }, { moderationStatus: "visible" }],
          },
          {
            OR: [{ feedSourceId: null }, { isFeedVisible: true }],
          },
        ],
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      include: postInclude,
      take: chunkSize,
      ...(nextDbCursor ? { cursor: { id: nextDbCursor }, skip: 1 } : {}),
    })) as FeedPostRecord[];

    if (batch.length < chunkSize) {
      exhausted = true;
    }

    if (batch.length === 0) {
      break;
    }

    collected.push(...filterViolentFeedPostsForUser(batch, hideViolentFeed));
    nextDbCursor = batch[batch.length - 1]?.id ?? null;
  }

  const hasMore = collected.length > FEED_PAGE_SIZE;
  const items = hasMore ? collected.slice(0, FEED_PAGE_SIZE) : collected;

  return {
    posts: items.map(serializePost),
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}