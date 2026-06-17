import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const { mode, tagIds } = await request.json();
  if (mode && mode !== "whitelist" && mode !== "blacklist") {
    return Response.json({ error: "Invalid mode." }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id: session.userId }, data: { tagFilterMode: mode ?? null, tagFilterTags: tagIds ? JSON.stringify(tagIds) : null } });
    return Response.json({});
  } catch {
    return Response.json({ error: "Could not update preferences." }, { status: 400 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { tagFilterMode: true, tagFilterTags: true } });
  if (!user) return Response.json({ error: "User not found." }, { status: 404 });

  return Response.json({ mode: user.tagFilterMode, tagIds: user.tagFilterTags ? JSON.parse(user.tagFilterTags) : [] });
}
