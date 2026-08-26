import { getSession } from "@/lib/auth";
import { blockUser, unblockUser } from "@/lib/user-block";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/users/[id]/block">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (id === session.userId) {
    return Response.json({ error: "Cannot block yourself." }, { status: 400 });
  }

  await blockUser(session.userId, id);
  return Response.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/users/[id]/block">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  await unblockUser(session.userId, id);
  return Response.json({ ok: true });
}
