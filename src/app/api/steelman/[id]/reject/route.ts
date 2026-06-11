import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  ctx: RouteContext<"/api/steelman/[id]/reject">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const steelman = await prisma.steelmanRequest.findUnique({ where: { id } });

  if (!steelman) {
    return Response.json({ error: "Steelman request not found." }, { status: 404 });
  }
  if (steelman.targetId !== session.userId) {
    return Response.json(
      { error: "Only the target user can reject this steelman." },
      { status: 403 }
    );
  }

  const updated = await prisma.steelmanRequest.update({
    where: { id },
    data: { status: "rejected" },
  });

  return Response.json({ steelman: updated });
}
