import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? session.userId;
  const type = searchParams.get("type") ?? "following"; // following | followers

  if (type === "followers") {
    const rows = await prisma.connection.findMany({
      where: { followingId: userId },
      include: { follower: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: "desc" },
    });
    return Response.json({ users: rows.map((r) => r.follower) });
  }

  const rows = await prisma.connection.findMany({
    where: { followerId: userId },
    include: { following: { select: { id: true, name: true, avatarUrl: true } } },
    orderBy: { createdAt: "desc" },
  });
  return Response.json({ users: rows.map((r) => r.following) });
}
