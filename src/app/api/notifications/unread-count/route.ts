import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const unreadCount = await prisma.notification.count({
    where: {
      recipientId: session.userId,
      isRead: false,
    },
  });

  return Response.json({ unreadCount });
}
