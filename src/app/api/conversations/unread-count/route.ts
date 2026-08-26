import { getSession } from "@/lib/auth";
import { getUnreadCountForUser } from "@/lib/conversations";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const unreadCount = await getUnreadCountForUser(session.userId);
  return Response.json({ unreadCount });
}
