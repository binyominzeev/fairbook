import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const communities = await prisma.community.findMany({
    where: { isPrivate: false },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true, posts: true } },
    },
  });

  return Response.json({ communities });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { name, description, isPrivate } = await request.json();

  if (!name?.trim()) {
    return Response.json({ error: "Community name is required." }, { status: 400 });
  }

  const community = await prisma.community.create({
    data: {
      name,
      description,
      isPrivate: !!isPrivate,
      ownerId: session.userId,
      members: {
        create: { userId: session.userId, role: "admin" },
      },
    },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true, posts: true } },
    },
  });

  return Response.json({ community }, { status: 201 });
}
