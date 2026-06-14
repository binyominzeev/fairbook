import { NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/auth";

export async function authorizeCronRequest(request: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET?.trim();
  const url = new URL(request.url);
  const suppliedSecret =
    request.headers.get("x-cron-secret")?.trim() ?? url.searchParams.get("secret")?.trim();

  if (configuredSecret && suppliedSecret === configuredSecret) {
    return true;
  }

  const session = await getSession();
  return Boolean(session && isAdminEmail(session.email));
}