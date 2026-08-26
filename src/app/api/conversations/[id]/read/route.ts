import { getSession } from "@/lib/auth";
import { ConversationError, markConversationRead } from "@/lib/conversations";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/conversations/[id]/read">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;

  try {
    await markConversationRead(id, session.userId);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ConversationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
