import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  const users = await prisma.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
          ],
        }
      : undefined,
    select: { id: true, name: true, email: true, bio: true, avatarUrl: true },
    take: 20,
    orderBy: { name: "asc" },
  });

  return Response.json({ users });
}
