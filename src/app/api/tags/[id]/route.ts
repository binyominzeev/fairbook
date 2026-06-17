import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await context.params;
  const { name, color, description } = await request.json();

  try {
    const updateData: Record<string, string | null | undefined> = {};
    if (name?.trim()) updateData.name = name.trim();
    if (color?.trim()) updateData.color = color.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;

    const tag = await prisma.tag.update({ where: { id }, data: updateData });
    return Response.json({ tag });
  } catch {
    return Response.json({ error: "Could not update tag." }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "Forbidden." }, { status: 403 });

  const { id } = await context.params;
  try {
    await prisma.postTag.deleteMany({ where: { tagId: id } });
    await prisma.tag.delete({ where: { id } });
    return Response.json({});
  } catch {
    return Response.json({ error: "Could not delete tag." }, { status: 400 });
  }
}
