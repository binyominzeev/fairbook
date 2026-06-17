import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return Response.json({ tags });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "Forbidden." }, { status: 403 });

  const { name, color, keywords } = await request.json();
  if (!name || !name.trim()) return Response.json({ error: "Name is required." }, { status: 400 });

  try {
    const tag = await prisma.tag.create({ data: { name: name.trim(), color: color?.trim() || "#9CA3AF", keywords: keywords?.trim() || null } });
    return Response.json({ tag }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not create tag." }, { status: 400 });
  }
}
