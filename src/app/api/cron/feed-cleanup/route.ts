import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/cron";
import { recomputeAllPostScores, refreshVisibleFeedPosts } from "@/lib/feed-ranking";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorized = await authorizeCronRequest(request);
  if (!authorized) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  await recomputeAllPostScores();
  const visibility = await refreshVisibleFeedPosts();
  await prisma.feedSyncState.upsert({
    where: { id: "default" },
    update: { lastCleanupAt: new Date() },
    create: { id: "default", lastCleanupAt: new Date() },
  });

  revalidatePath("/pages");
  revalidatePath("/feed");

  return Response.json({
    rescored: true,
    ...visibility,
  });
}