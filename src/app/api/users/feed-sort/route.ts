import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { normalizeFeedSortMode } from "@/lib/feed-posts";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { feedSortMode: true },
  });

  if (!user) return Response.json({ error: "User not found." }, { status: 404 });

  return Response.json({ mode: normalizeFeedSortMode(user.feedSortMode) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nextMode = normalizeFeedSortMode((body as { mode?: unknown }).mode as string | null | undefined);

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { feedSortMode: nextMode },
    });

    return Response.json({ mode: nextMode });
  } catch {
    return Response.json({ error: "Could not update feed sort mode." }, { status: 400 });
  }
}