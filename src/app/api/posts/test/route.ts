import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { moderatePost } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { content, sharedUrl, sharedTitle, sharedDescription, sharedSource, sharedContent } = await request.json();

  if (!content?.trim() && !sharedUrl?.trim()) {
    return Response.json({ error: "Add some content or a link." }, { status: 400 });
  }

  const sharedContentText =
    typeof sharedContent === "string"
      ? sharedContent.trim()
      : [sharedTitle, sharedDescription, sharedSource, sharedUrl].filter(Boolean).join("\n");
  const moderation = await moderatePost({
    postContent: content ?? undefined,
    sharedContent: sharedContentText || undefined,
  });

  return Response.json({ moderation });
}
