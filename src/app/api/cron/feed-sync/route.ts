import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/cron";
import { recordFeedSyncCronRun } from "@/lib/feed-cron-logs";
import { syncFeedBatch } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorized = await authorizeCronRequest(request);
  if (!authorized) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const startedAt = new Date();
  const result = await syncFeedBatch();
  await recordFeedSyncCronRun({ startedAt, result });
  revalidatePath("/pages");
  revalidatePath("/feed");
  return Response.json(result);
}