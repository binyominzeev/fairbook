import { getSession } from "@/lib/auth";
import { ConversationError, removeParticipant, setParticipantAdmin } from "@/lib/conversations";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/participants/[userId]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id, userId } = await ctx.params;

  try {
    await removeParticipant(id, session.userId, userId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ConversationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]/participants/[userId]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id, userId } = await ctx.params;
  const body = await request.json().catch(() => null);
  const isAdmin = Boolean(body?.isAdmin);

  try {
    const participant = await setParticipantAdmin(id, session.userId, userId, isAdmin);
    return Response.json({ participant });
  } catch (error) {
    if (error instanceof ConversationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
