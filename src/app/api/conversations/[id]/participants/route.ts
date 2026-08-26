import { getSession } from "@/lib/auth";
import { addParticipant, ConversationError, leaveConversation } from "@/lib/conversations";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/conversations/[id]/participants">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) {
    return Response.json({ error: "userId is required." }, { status: 400 });
  }

  try {
    const participant = await addParticipant(id, session.userId, userId);
    return Response.json({ participant });
  } catch (error) {
    if (error instanceof ConversationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/participants">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await leaveConversation(id, session.userId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ConversationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
