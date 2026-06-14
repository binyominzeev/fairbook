import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeCronRequest } from "@/lib/cron";
import { syncFeedBatch } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authorized = await authorizeCronRequest(request);
  if (!authorized) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const result = await syncFeedBatch();
  revalidatePath("/pages");
  revalidatePath("/feed");
  return Response.json(result);
}