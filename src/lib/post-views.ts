import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type PostUniqueViewBreakdown = {
  registered: number;
  anonymous: number;
  total: number;
};

export async function getPostUniqueViewBreakdown(
  postId: string
): Promise<PostUniqueViewBreakdown> {
  const [registered, anonymousRows] = await Promise.all([
    prisma.postUniqueView.count({ where: { postId } }),
    prisma.$queryRaw<Array<{ anonymousCount: bigint | number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT s."visitorKeyHash") as "anonymousCount"
      FROM "TrafficEvent" e
      INNER JOIN "TrafficSession" s ON s."id" = e."sessionId"
      WHERE e."postId" = ${postId}
        AND e."eventType" = 'page_view'
        AND e."userId" IS NULL
    `),
  ]);

  const anonymous = Number(anonymousRows[0]?.anonymousCount ?? 0);

  return {
    registered,
    anonymous,
    total: registered + anonymous,
  };
}
