import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { normalizePostVisibility } from "@/lib/post-visibility";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const visibility = normalizePostVisibility((body as { visibility?: unknown }).visibility);
  if (!visibility || visibility === "unlisted") {
    return Response.json({ error: "Invalid visibility." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { defaultPostVisibility: visibility },
  });

  return Response.json({ visibility });
}
