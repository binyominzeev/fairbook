import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  ctx: RouteContext<"/api/child-safety-reports/[id]">
) {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const handled = (body as { handled?: unknown }).handled;
  if (typeof handled !== "boolean") {
    return Response.json({ error: "Invalid handled flag." }, { status: 400 });
  }

  const report = await prisma.childSafetyReport.findUnique({ where: { id } });
  if (!report) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  const updated = await prisma.childSafetyReport.update({
    where: { id },
    data: {
      status: handled ? "reviewing" : "open",
      reviewedAt: handled ? new Date() : null,
    },
    select: {
      id: true,
      status: true,
      reviewedAt: true,
    },
  });

  return Response.json({
    report: {
      id: updated.id,
      status: updated.status,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
    },
  });
}

export async function DELETE(
  _req: Request,
  ctx: RouteContext<"/api/child-safety-reports/[id]">
) {
  const session = await getSession();
  if (!session || !isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const { id } = await ctx.params;

  const report = await prisma.childSafetyReport.findUnique({ where: { id } });
  if (!report) {
    return Response.json({ error: "Report not found." }, { status: 404 });
  }

  await prisma.childSafetyReport.delete({ where: { id } });
  return Response.json({ ok: true });
}
