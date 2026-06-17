import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { moderatePost } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { content, sharedUrl, sharedTitle, sharedDescription, sharedSource } = await request.json();

  if (!content?.trim() && !sharedUrl?.trim()) {
    return Response.json({ error: "Add some content or a link." }, { status: 400 });
  }

  const sharedContent = [sharedTitle, sharedDescription, sharedSource, sharedUrl].filter(Boolean).join("\n");
  const moderation = await moderatePost({ postContent: content ?? undefined, sharedContent: sharedContent || undefined });

  return Response.json({ moderation });
}
