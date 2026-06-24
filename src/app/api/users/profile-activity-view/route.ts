import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeMode(value: unknown): "normal" | "reels" | null {
  if (value === "normal" || value === "reels") {
    return value;
  }

  return null;
}

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { profileActivityViewMode: true },
  });

  if (!user) return Response.json({ error: "User not found." }, { status: 404 });

  return Response.json({
    mode: normalizeMode(user.profileActivityViewMode) ?? "normal",
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nextMode = normalizeMode((body as { mode?: unknown }).mode);

  if (!nextMode) {
    return Response.json({ error: "Invalid mode." }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { profileActivityViewMode: nextMode },
    });

    return Response.json({ mode: nextMode });
  } catch {
    return Response.json({ error: "Could not update profile view mode." }, { status: 400 });
  }
}
